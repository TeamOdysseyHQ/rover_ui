import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

// Actual science handlers and pollEvery with simulated time and no hardware calls.
function setup(kind) {
    const sensor = kind === 'sensor';
    const name = sensor ? 'ScienceSensorDisplay' : 'ScienceControlPanel';
    const source = readFileSync(new URL(`../src/lib/components/panels/${name}.svelte`, import.meta.url), 'utf8')
        .split('<script lang="ts">')[1].split('</script>')[0]
        .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '');
    const polling = readFileSync(new URL('../src/lib/services/polling.js', import.meta.url), 'utf8').replace('export function', 'function');
    const script = polling + '\n' + stripTypeScriptTypes(source) + `
globalThis.h = {
    start: ${sensor ? 'startAutoRefresh' : 'startPolling'},
    stop: ${sensor ? 'stopAutoRefresh' : 'stopPolling'},
    ${sensor ? 'fetchSensorData,' : ''}
    state: () => (${sensor ? '{ sensorData, isLoading, lastUpdated, errorMessage }' : '{ drillHalted, distanceMm, warningMessage }'}),
};`;
    let now = 0, nextId = 0;
    const timers = new Map(), reads = [], effects = [];
    const read = (type, signal) => new Promise((resolve, reject) => { reads.push({ type, signal, resolve, reject }); });
    const context = {
        $props: () => ({ scienceModeEnabled: true }), $state: value => value, $derived: value => value, $bindable: value => value,
        $effect: fn => effects.push(fn), untrack: fn => fn(),
        $apiStatus: 'connected', $roverApiUrl: 'http://mock.invalid',
        getScienceSensorData: signal => read('sensor', signal),
        getDrillData: signal => read('drill', signal), getScienceWarnings: signal => read('warning', signal),
        AbortSignal, AbortController, console, performance: { now: () => now },
        setTimeout: (fn, delay) => { timers.set(++nextId, { fn, at: now + delay }); return nextId; },
        clearTimeout: id => timers.delete(id),
    };
    runInNewContext(script, context);
    const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    const advance = async milliseconds => {
        now += milliseconds;
        for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
        await settle();
    };
    const complete = currentReads => {
        for (const request of currentReads) request.resolve({ success: true, data: request.type === 'sensor' ? { humidity: 42 } : request.type === 'drill' ? { distance_mm: 12, drill_halted: false } : { warning_message: 'Sample warning' } });
    };
    return { h: context.h, context, reads, timers, effects, complete, settle, advance };
}

for (const kind of ['sensor', 'control']) {
    test(`${kind}: slow science reads do not overlap polling cycles`, async () => {
        const { h, reads, complete, advance, settle } = setup(kind);
        h.start(); const initialCount = kind === 'sensor' ? 1 : 2;
        assert.equal(reads.length, initialCount);
        await advance(6000);
        assert.equal(reads.length, initialCount, 'no second cycle while first read is unresolved');
        complete(reads); await settle(); await advance(1);
        assert.equal(reads.length, initialCount * 2, 'next cycle starts after completion');
        h.stop();
    });

    test(`${kind}: stopping aborts reads and ignores late responses`, async () => {
        const { h, reads, complete, advance, settle } = setup(kind);
        h.start(); h.stop();
        assert.ok(reads.every(read => read.signal.aborted));
        complete(reads); await settle(); await advance(5000);
        assert.equal(reads.length, kind === 'sensor' ? 1 : 2);
        if (kind === 'sensor') {
            assert.equal(h.state().sensorData, null); assert.equal(h.state().isLoading, false);
        } else {
            assert.equal(h.state().distanceMm, null); assert.equal(h.state().warningMessage, 'None');
        }
    });

    test(`${kind}: disconnected panels do not poll`, () => {
        const { h, context, reads, effects } = setup(kind);
        context.$apiStatus = 'disconnected'; effects.forEach(effect => effect()); h.start();
        assert.equal(reads.length, 0);
    });

    test(`${kind}: endpoint effect teardown aborts old reads before a new connection starts`, async () => {
        const { h, context, reads, effects, complete, settle } = setup(kind);
        const cleanup = effects[0](); const oldReads = [...reads];
        context.$roverApiUrl = 'http://other-mock.invalid'; cleanup(); effects[0]();
        assert.ok(oldReads.every(read => read.signal.aborted));
        complete(oldReads); await settle();
        assert.equal(reads.length, kind === 'sensor' ? 2 : 4);
        assert.equal(kind === 'sensor' ? h.state().sensorData : h.state().distanceMm, null);
        h.stop();
    });
}

test('sensor: manual refresh does not overlap a pending automatic read', async () => {
    const { h, reads, complete, settle } = setup('sensor');
    h.start(); await h.fetchSensorData();
    assert.equal(reads.length, 1);
    complete(reads); await settle();
    assert.equal(h.state().sensorData.humidity, 42); h.stop();
});

test('control: one failed endpoint cannot start a new cycle while its companion is pending', async () => {
    const { h, reads, complete, advance, settle } = setup('control');
    h.start(); reads[0].reject(new Error('drill unavailable')); await settle(); await advance(5000);
    assert.equal(reads.length, 2);
    complete([reads[1]]); await settle();
    assert.equal(h.state().warningMessage, 'Sample warning'); h.stop();
});
