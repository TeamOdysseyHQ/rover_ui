import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { ProfiledDriveController } from '../src/lib/services/profiledDriveController.js';

// Exercise the actual component's handlers with fake timers and motor outputs.
// This does not emulate Svelte rendering/reactivity or send physical commands.
const source = readFileSync(new URL('../src/lib/components/sections/DrivingControls.svelte', import.meta.url), 'utf8')
    .split('<script lang="ts">')[1].split('</script>')[0]
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '')
    .replace(/const usable = \$derived\((.*)\);/, 'Object.defineProperty(globalThis, \"usable\", { get: () => $1 });');
const script = stripTypeScriptTypes(source) + `
globalThis.harness = {
    handleKeyDown, handleKeyUp, focusChanged, visibilityChanged, safetyStop,
    toggleProfile, togglePreview, emergencyStop, rearm, controller,
    state: () => controller.snapshot(),
};`;

function setup() {
    let now = 0;
    const intervals = new Map(); let id = 0;
    const mounts = [], effects = [], destroys = [], sent = [];
    const context = {
        ProfiledDriveController, PhoneControl: class { start() {} suspend() {} close() {} }, AbortSignal, AbortController, console, Element: class Element {},
        $state: value => value, $derived: value => value, $props: () => ({}), $effect: fn => effects.push(fn), untrack: fn => fn(),
        $isRosConnected: true, $apiStatus: 'connected', $roverApiUrl: 'http://mock.invalid',
        performance: { now: () => now },
        setInterval: (fn, period) => { intervals.set(++id, { fn, period, next: now + period }); return id; },
        clearInterval: id => intervals.delete(id),
        window: { addEventListener() {}, removeEventListener() {} },
        document: { hidden: false, addEventListener() {}, removeEventListener() {} },
        onMount: fn => mounts.push(fn), onDestroy: fn => destroys.push(fn),
        commandedVelocity: { set() {} },
        fetch: async (url, options) => { sent.push({ url, body: options.body ? JSON.parse(options.body) : null }); return { ok: true, json: async () => ({ success: true }) }; },
    };
    runInNewContext(script, context);
    effects.forEach(fn => fn()); context.harness.controller.setPreview(false); mounts.forEach(fn => fn());
    const h = context.harness;
    const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    const advance = async duration => {
        for (let elapsed = 0; elapsed < duration; elapsed += 50) {
            now += 50;
            for (const timer of [...intervals.values()]) if (now >= timer.next) { timer.next += timer.period; timer.fn(); }
            await settle();
        }
    };
    const key = (value, extras = {}) => ({ key: value, repeat: false, preventDefault() {}, target: {}, ...extras });
    return { h, context, advance, key, settle, sent, effects, destroys };
}

test('direct keyboard target holds on release and ignores modified shortcuts', async () => {
    const { h, advance, key, sent } = setup();
    h.toggleProfile();
    h.handleKeyDown(key('w', { ctrlKey: true })); await advance(100); assert.equal(sent.length, 0);
    h.handleKeyDown(key('w')); await advance(400); h.handleKeyUp(key('w'));
    const target = h.state().target.linear; await advance(300);
    assert.ok(target > 0); assert.equal(h.state().output.linear, target);
});

test('profile shapes keyboard requests and Tab requests smooth deceleration', async () => {
    const { h, advance, key } = setup();
    h.handleKeyDown(key('w')); await advance(1000); h.handleKeyUp(key('w'));
    assert.ok(h.state().target.linear > h.state().output.linear);
    h.handleKeyDown(key('Tab'));
    assert.equal(h.state().target.linear, 0); assert.ok(h.state().output.linear > 0);
    await advance(5000); assert.equal(h.state().output.linear, 0);
});

test('safety stops clear motion and require rearming plus held-key release', async () => {
    for (const action of ['blur', 'hidden', 'editing', 'disconnect', 'teardown']) {
        const { h, context, advance, key, effects, destroys, settle } = setup();
        h.handleKeyDown(key('w')); await advance(300);
        if (action === 'blur') h.safetyStop();
        if (action === 'hidden') { context.document.hidden = true; h.visibilityChanged(); }
        if (action === 'editing') { const target = new context.Element(); target.closest = selector => selector.includes('data-drive') ? null : {}; h.focusChanged({ target }); }
        if (action === 'disconnect') { context.$apiStatus = 'disconnected'; effects.forEach(fn => fn()); }
        if (action === 'teardown') destroys.forEach(fn => fn());
        await settle(); assert.equal(h.state().output.linear, 0, action); assert.equal(h.state().latched, true, action);
        h.handleKeyDown(key('w', { repeat: true })); await advance(300);
        assert.equal(h.state().output.linear, 0, action);
    }
});

test('driving and emergency stop use only ROS endpoints; obsolete IJKL keys do nothing', async () => {
    const { h, advance, key, sent, settle } = setup();
    for (const cameraKey of ['i', 'j', 'k', 'l']) h.handleKeyDown(key(cameraKey));
    await settle(); assert.equal(sent.length, 0);
    h.handleKeyDown(key('w')); await advance(500); h.handleKeyUp(key('w'));
    assert.ok(sent.some(item => item.url.endsWith('/api/nav/ros/cmd_vel') && item.body.linear_x > 0));
    await h.emergencyStop();
    assert.equal(h.state().output.linear, 0);
    assert.ok(sent.some(item => item.url.endsWith('/api/nav/ros/cmd_vel/stop')));
    assert.ok(sent.every(item => item.url.includes('/api/nav/ros/')));
});

test('Space immediately stops, ignores held-key repeats, and resumes at zero on a fresh press', async () => {
    const { h, advance, key, sent, settle } = setup();
    h.handleKeyDown(key('w')); await advance(500);
    h.handleKeyDown(key(' '));
    assert.equal(h.state().output.linear, 0); assert.equal(h.state().latched, true);
    await settle(); assert.ok(sent.some(item => item.url.endsWith('/cmd_vel/stop')));
    h.handleKeyDown(key(' ', { repeat: true })); assert.equal(h.state().latched, true);
    h.handleKeyUp(key(' ')); h.handleKeyDown(key(' '));
    assert.equal(h.state().latched, false); assert.equal(h.state().target.linear, 0);
    h.handleKeyDown(key('w')); await advance(200); assert.equal(h.state().output.linear, 0, 'held W must be released');
    h.handleKeyUp(key('w')); h.handleKeyDown(key('w')); await advance(200);
    assert.ok(h.state().output.linear > 0);
});

test('stop shortcuts ignore editable fields and Tab retains navigation at rest', () => {
    const { h, context, key } = setup();
    let prevented = false;
    h.handleKeyDown(key('Tab', { preventDefault() { prevented = true; } }));
    assert.equal(prevented, false);
    const target = new context.Element(); target.closest = () => ({});
    h.handleKeyDown(key(' ', { target })); assert.equal(h.state().latched, false);
});

test('Ctrl+O toggles preview at rest, ignores repeats and does not interrupt held inputs when moving', async () => {
    const { h, advance, key } = setup();
    let prevented = false;
    h.handleKeyDown(key('o', { ctrlKey: true, preventDefault() { prevented = true; } }));
    assert.equal(prevented, true); assert.equal(h.state().preview, true);
    h.handleKeyDown(key('o', { ctrlKey: true, repeat: true }));
    assert.equal(h.state().preview, true);
    h.handleKeyDown(key('O', { ctrlKey: true })); assert.equal(h.state().preview, false);
    h.handleKeyDown(key('o', { ctrlKey: true }));
    h.handleKeyDown(key('w')); await advance(300);
    const before = h.state().target.linear;
    h.handleKeyDown(key('o', { ctrlKey: true }));
    assert.equal(h.state().preview, true);
    await advance(300); assert.ok(h.state().target.linear > before);
});

test('reconnection disables preview and requires releasing held preview keys before fresh live input', async () => {
    const { h, context, effects, advance, key, sent } = setup();
    h.togglePreview();
    context.$apiStatus = 'disconnected'; effects.forEach(fn => fn());
    h.handleKeyDown(key('w')); await advance(300);
    assert.ok(h.state().target.linear > 0);
    assert.equal(sent.length, 0);
    context.$apiStatus = 'connected'; effects.forEach(fn => fn());
    assert.equal(h.state().preview, false);
    assert.deepEqual({ ...h.state().target }, { linear: 0, angular: 0 });
    await advance(400);
    h.handleKeyDown(key('w', { repeat: true }));
    h.handleKeyDown(key('w')); await advance(200);
    assert.equal(sent.length, 0, 'held preview input must not become live movement');
    h.handleKeyUp(key('w')); h.handleKeyDown(key('w')); await advance(200);
    assert.ok(sent.some(command => command.body?.linear_x > 0));
});
