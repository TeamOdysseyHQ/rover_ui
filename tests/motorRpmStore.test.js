import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiStatus } from '../src/lib/stores/apiStore.js';
import { motorRpmSample } from '../src/lib/stores/motorRpmStore.js';
const settle = () => new Promise(setImmediate);

test('dashboard and fullscreen share RPM reads; last unsubscribe aborts pending work', async t => {
    apiStatus.set('disconnected');
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const requests = [];
    let pendingSignal;
    let resolveRead;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push(url);
        if (url.endsWith('/subscribe')) return { ok: true, json: async () => ({ success: true }) };
        pendingSignal = options.signal;
        return new Promise(resolve => { resolveRead = resolve; });
    });
    let sample;
    const dashboard = motorRpmSample.subscribe(value => { sample = value; });
    const fullscreen = motorRpmSample.subscribe(() => {});
    apiStatus.set('connected');
    await settle();
    assert.equal(requests.length, 2);
    dashboard();
    assert.equal(pendingSignal.aborted, false);
    fullscreen();
    assert.equal(pendingSignal.aborted, true);
    resolveRead({ ok: true, json: async () => ({ success: true, data: { front_left: 42 } }) });
    await settle();
    t.mock.timers.tick(10000);
    assert.equal(requests.length, 2);
    assert.equal(sample.data, null, 'late results cannot restore stale RPM values');
    apiStatus.set('disconnected');
});

test('disconnect clears telemetry and cancels outstanding subscription', async t => {
    apiStatus.set('disconnected');
    let signal, resolveSubscription, sample;
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
        signal = options.signal;
        return new Promise(resolve => { resolveSubscription = resolve; });
    });
    const stop = motorRpmSample.subscribe(value => { sample = value; });
    t.after(stop);
    apiStatus.set('connected');
    apiStatus.set('disconnected');
    assert.equal(signal.aborted, true);
    resolveSubscription({ ok: true, json: async () => ({ success: true }) });
    await settle();
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(sample.data, null);
    assert.equal(sample.error, 'API disconnected');
});
