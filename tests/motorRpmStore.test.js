import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiStatus } from '../src/lib/stores/apiStore.js';
import { motorRpmSample, watchMotorRpms } from '../src/lib/stores/motorRpmStore.js';
const settle = () => new Promise(setImmediate);

test('a passive health subscriber does not poll and cannot keep Stop running', async t => {
    apiStatus.set('disconnected');
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fetch = t.mock.method(globalThis, 'fetch', async url => ({ ok: true, json: async () => url.endsWith('/subscribe') ? { success: true } : { success: true, data: { front_left: 42 } } }));
    const health = motorRpmSample.subscribe(() => {});
    t.after(health);
    apiStatus.set('connected'); await settle();
    assert.equal(fetch.mock.callCount(), 0);
    const release = watchMotorRpms(() => {}); await settle();
    assert.equal(fetch.mock.callCount(), 2);
    release(); t.mock.timers.tick(10000); await settle();
    assert.equal(fetch.mock.callCount(), 2);
    apiStatus.set('disconnected');
});

test('hidden tabs cancel their RPM read and resume once when visible', async t => {
    apiStatus.set('disconnected');
    const document = new EventTarget(); document.hidden = false;
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
    t.after(() => { if (original) Object.defineProperty(globalThis, 'document', original); else delete globalThis.document; });
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal, resolveRead;
    const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (url.endsWith('/subscribe')) return { ok: true, json: async () => ({ success: true }) };
        signal = options.signal; return new Promise(resolve => { resolveRead = resolve; });
    });
    const release = watchMotorRpms(() => {}); t.after(release);
    apiStatus.set('connected'); await settle();
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(signal.aborted, true);
    resolveRead({ ok: true, json: async () => ({ success: true, data: { front_left: 1 } }) });
    await settle(); t.mock.timers.tick(10000); await settle(); assert.equal(fetch.mock.callCount(), 2);
    document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(fetch.mock.callCount(), 4); apiStatus.set('disconnected');
    resolveRead({ ok: true, json: async () => ({}) }); await settle();
});

test('old cached RPMs are unavailable and backed off without resubscribing', async t => {
    apiStatus.set('disconnected'); t.mock.timers.enable({ apis: ['setTimeout'] });
    let sample;
    const fetch = t.mock.method(globalThis, 'fetch', async url => ({ ok: true, json: async () => url.endsWith('/subscribe') ? { success: true } : { success: true, data: { front_left: 42, sample_id: 1, received_at_ms: 1000, age_ms: 5000 } } }));
    const release = watchMotorRpms(value => { sample = value; }); t.after(release);
    apiStatus.set('connected'); await settle();
    assert.equal(sample.data, null); assert.match(sample.error, /stale/); assert.equal(sample.sampleId, '1000:1');
    t.mock.timers.tick(200); await settle(); assert.equal(fetch.mock.callCount(), 2);
    apiStatus.set('disconnected');
});

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
    const dashboard = watchMotorRpms(value => { sample = value; });
    const fullscreen = watchMotorRpms(() => {});
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
    const stop = watchMotorRpms(value => { sample = value; });
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
