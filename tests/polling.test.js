import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pollEvery } from '../src/lib/services/polling.js';
import { getMotorRpms, getRosStatus } from '../src/lib/services/roverApi.js';
const settle = () => new Promise(setImmediate);

test('slow polls never overlap and stopping cancels in-flight work', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let count = 0, resolve, signal;
    const stop = pollEvery(s => { count++; signal = s; return new Promise(r => { resolve = r; }); }, 200);
    t.mock.timers.tick(10000);
    assert.equal(count, 1);
    resolve(); await settle();
    t.mock.timers.tick(200); assert.equal(count, 2);
    stop(); assert.equal(signal.aborted, true);
    resolve(); await settle(); t.mock.timers.tick(10000);
    assert.equal(count, 2);
});

test('a stopped poll cannot restart when its request finishes late', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let resolve, calls = 0;
    const stop = pollEvery(() => { calls++; return new Promise(r => { resolve = r; }); }, 200);
    stop(); resolve(); await settle(); t.mock.timers.tick(10000);
    assert.equal(calls, 1);
});

test('poll cancellation reaches API reads and a deadline remains present', async t => {
    const controller = new AbortController();
    let received;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        received = options.signal;
        return { ok: true, json: async () => ({ success: true }) };
    });
    await getMotorRpms(controller.signal);
    assert.notEqual(received, controller.signal, 'caller cancellation is combined with the read deadline');
    controller.abort(); assert.equal(received.aborted, true);
    await getRosStatus(); assert.ok(received instanceof AbortSignal);
});

test('status reads avoid JSON preflight headers while JSON commands retain their content type', async t => {
    const { publishCmdVel, getSupportedResolutions } = await import('../src/lib/services/roverApi.js');
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        requests.push(options); return { ok: true, json: async () => ({ success: true }) };
    });
    await getMotorRpms();
    assert.equal(requests[0].headers['Content-Type'], undefined);
    await getSupportedResolutions('science');
    assert.ok(requests[1].signal instanceof AbortSignal, 'hardware probing has a longer bounded deadline');
    await publishCmdVel({ linear_x: 0, angular_z: 0 });
    assert.equal(requests[2].headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(requests[2].body).linear_x, 0);
});
