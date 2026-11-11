import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wakeRover } from '../src/lib/services/wakeRover.js';

const response = (data, status = 200) => Response.json(data, { status });
const apiUrl = 'http://192.168.1.3:6767';

test('wake sends once and waits through offline reports and read failures for API readiness', async t => {
    const calls = [];
    let notified = false;
    const reports = [response({ ready: false }), new Error('boot in progress'), response({ ready: true, apiUrl })];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push(options.method || 'GET');
        assert.equal(url, '/api/rover-power');
        if (options.method === 'POST') return response({ sent: true });
        assert.equal(notified, true);
        const next = reports.shift();
        if (next instanceof Error) throw next;
        return next;
    });
    assert.equal(await wakeRover({ signal: new AbortController().signal, onSent: () => { notified = true; }, intervalMs: 1 }), apiUrl);
    assert.deepEqual(calls, ['POST', 'GET', 'GET', 'GET']);
});

test('a failed send displays the connection guidance and does not claim it was sent', async t => {
    let notified = false;
    t.mock.method(globalThis, 'fetch', async () => response({ message: 'Select the Rover antenna Ethernet connection.' }, 503));
    await assert.rejects(wakeRover({ signal: new AbortController().signal, onSent: () => { notified = true; } }), /Select the Rover antenna/);
    assert.equal(notified, false);
});

test('an unavailable dashboard endpoint gives a useful error without claiming a wake signal', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>Not found</html>', { status: 404 }));
    await assert.rejects(wakeRover({ signal: new AbortController().signal, onSent() { assert.fail('No packet was sent'); } }), /Could not send the wake packet/);
});

test('an already cancelled attempt never sends a wake request', async t => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(globalThis, 'fetch', async () => { assert.fail('Cancelled attempt sent a packet'); });
    await assert.rejects(wakeRover({ signal: controller.signal, onSent() {} }), { name: 'AbortError' });
});

test('leaving the panel cancels waiting without sending another wake packet', async t => {
    const controller = new AbortController();
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        calls.push(options.method || 'GET');
        if (options.method === 'POST') return response({ sent: true });
        controller.abort();
        return response({ ready: true, apiUrl });
    });
    await assert.rejects(wakeRover({ signal: controller.signal, onSent() {} }), { name: 'AbortError' });
    assert.deepEqual(calls, ['POST', 'GET']);
});

test('an offline computer reaches a bounded timeout instead of claiming success', async t => {
    t.mock.method(globalThis, 'fetch', async (_url, options) => options.method === 'POST' ? response({ sent: true }) : response({ ready: false }));
    await assert.rejects(wakeRover({ signal: new AbortController().signal, onSent() {}, timeoutMs: 30, intervalMs: 5 }), /No API response within two minutes/);
});
