import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProfiledDriveController } from '../src/lib/services/profiledDriveController.js';

const zero = { linear: 0, angular: 0 };
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function setup(options = {}) {
    const sent = [], stopped = [];
    const driver = new ProfiledDriveController({ send: async command => sent.push(command), stop: async command => stopped.push(command), ...options });
    driver.setConnection(true, 'http://mock.invalid'); driver.setPreview(false); driver.tick(0);
    return { driver, sent, stopped };
}
async function advance(driver, from, to) { for (let now = from + 25; now <= to; now += 25) { driver.tick(now); await settle(); } }

test('profile defaults to enabled and preview shapes both axes without sending', async () => {
    const { driver, sent, stopped } = setup();
    assert.equal(driver.snapshot().enabled, true);
    driver.setPreview(true); driver.setEnabled(true); driver.request({ linear: 1, angular: 1 });
    await advance(driver, 0, 1000);
    assert.ok(driver.snapshot().output.linear > 0 && driver.snapshot().output.linear < 1);
    assert.ok(driver.snapshot().output.angular > driver.snapshot().output.linear);
    driver.setConnection(false, 'http://offline.invalid');
    assert.equal(driver.snapshot().latched, false, 'background connection checks do not interrupt preview');
    await driver.halt();
    assert.deepEqual(driver.snapshot().output, zero);
    assert.equal(sent.length + stopped.length, 0);
});

test('published values follow the bounded profile, and normal stop sends a final zero', async () => {
    const { driver, sent } = setup(); driver.setEnabled(true); driver.request({ linear: 1, angular: 0 });
    await advance(driver, 0, 2000);
    assert.ok(sent.length >= 19 && sent.length <= 21);
    assert.ok(sent[0].linear < .01);
    for (let i = 1; i < sent.length; i++) assert.ok(sent[i].linear - sent[i - 1].linear <= .02000001);
    driver.request(zero);
    assert.ok(driver.snapshot().output.linear > 0);
    await advance(driver, 2000, 10000);
    assert.deepEqual(driver.snapshot().output, zero);
    assert.equal(sent.at(-1).linear, 0);
    const count = sent.length; await advance(driver, 10000, 11000); assert.equal(sent.length, count);
});

test('profile settings and bypass cannot change while moving', () => {
    const { driver } = setup(); driver.setEnabled(true); driver.request({ linear: 1, angular: 0 });
    assert.equal(driver.setEnabled(false), false);
    assert.equal(driver.setPreview(true), false);
    assert.equal(driver.configure({ linearAcceleration: .33 }), false);
});

test('emergency stop bypasses a stalled movement request and blocks stale motion', async () => {
    let release; const events = [];
    const { driver } = setup({
        send: command => { events.push(['move', command.linear]); return command.linear ? new Promise(resolve => { release = resolve; }) : Promise.resolve(); },
        stop: async () => { events.push(['stop', 0]); }
    });
    driver.setEnabled(false);
    driver.request({ linear: 1, angular: 0 }); await settle();
    driver.request({ linear: .5, angular: 0 });
    const stopping = driver.halt();
    assert.deepEqual(events, [['move', 1], ['stop', 0]], 'stop is invoked without awaiting movement');
    assert.deepEqual(driver.snapshot().output, zero);
    assert.equal(driver.request({ linear: 1, angular: 0 }), false);
    assert.equal(driver.rearm(), false);
    release(); await stopping; await settle();
    assert.deepEqual(events, [['move', 1], ['stop', 0], ['move', 0]]);
    assert.deepEqual(driver.snapshot().lastAccepted, zero);
    assert.equal(driver.rearm(), true);
});

test('transport error and timing stalls disarm rather than resume old targets', async () => {
    for (const fault of ['error', 'stall', 'disconnect', 'host-change']) {
        const { driver, stopped } = setup(fault === 'error' ? { send: async () => { throw Error('network down'); } } : {});
        driver.setEnabled(true); driver.request({ linear: 1, angular: 0 }); await advance(driver, 0, 300);
        if (fault === 'stall') driver.tick(2000);
        if (fault === 'disconnect') driver.setConnection(false, 'http://mock.invalid');
        if (fault === 'host-change') driver.setConnection(true, 'http://another.invalid');
        await settle();
        assert.equal(driver.snapshot().latched, true, fault);
        assert.deepEqual(driver.snapshot().output, zero, fault);
        assert.ok(stopped.length > 0, fault);
        assert.equal(stopped.at(-1).url, 'http://mock.invalid');
        driver.setConnection(true, 'http://mock.invalid'); driver.tick(2050);
        assert.equal(driver.request({ linear: 1, angular: 0 }), false);
    }
});

test('unconfirmed emergency stop stays disarmed and exposes the failure', async () => {
    const { driver } = setup({ stop: async () => { throw Error('unreachable'); } });
    await driver.halt();
    assert.equal(driver.snapshot().latched, true);
    assert.match(driver.snapshot().error, /Stop unconfirmed.*unreachable/);
    driver.setPreview(true);
    assert.equal(driver.snapshot().latched, true, 'mode switches cannot bypass emergency rearming');
});

test('preview starts enabled offline and reconnecting cannot publish simulated movement', async () => {
    const sent = [];
    const driver = new ProfiledDriveController({ send: async value => sent.push(value), stop: async value => sent.push(value) });
    assert.equal(driver.snapshot().preview, true);
    driver.setConnection(false, 'http://mock.invalid'); driver.tick(0);
    driver.request({ linear: .5, angular: .2 }); await advance(driver, 0, 500);
    driver.setConnection(true, 'http://mock.invalid');
    assert.equal(driver.snapshot().preview, false);
    assert.deepEqual(driver.snapshot().target, zero);
    assert.deepEqual(driver.snapshot().output, zero);
    assert.deepEqual(driver.snapshot().acceleration, zero);
    await advance(driver, 500, 1000); assert.equal(sent.length, 0);
    driver.request({ linear: .1, angular: 0 });
    await advance(driver, 1000, 1200);
    assert.ok(sent.some(command => command.linear > 0), 'fresh live input works after connecting');
});

test('manual preview stays enabled across unchanged connection checks', () => {
    const { driver } = setup();
    driver.setPreview(true);
    driver.setConnection(true, 'http://mock.invalid');
    assert.equal(driver.snapshot().preview, true);
});

test('reconnecting turns preview off without bypassing or stranding an in-flight safety stop', async () => {
    let release;
    const { driver } = setup({ stop: () => new Promise(resolve => { release = resolve; }) });
    driver.setConnection(false, 'http://mock.invalid');
    assert.equal(driver.snapshot().stopping, true);
    driver.setConnection(true, 'http://mock.invalid');
    assert.equal(driver.snapshot().preview, false);
    assert.equal(driver.snapshot().latched, true);
    assert.equal(driver.rearm(), false);
    release(); await settle();
    assert.equal(driver.snapshot().stopping, false);
    assert.equal(driver.snapshot().latched, true);
    assert.equal(driver.rearm(), true);
});

test('loss of live connection enables preview, sends stop, and preserves the safety latch', async () => {
    const { driver, sent, stopped } = setup();
    driver.request({ linear: .5, angular: 0 }); await advance(driver, 0, 500);
    driver.setConnection(false, 'http://mock.invalid'); await settle();
    assert.equal(driver.snapshot().preview, true);
    assert.equal(driver.snapshot().latched, true);
    assert.deepEqual(driver.snapshot().output, zero);
    assert.equal(stopped.length, 1);
    const count = sent.length;
    assert.equal(driver.rearm(), true);
    driver.request({ linear: .5, angular: 0 }); await advance(driver, 500, 1000);
    assert.equal(sent.length, count, 'disconnected preview never publishes');
});
