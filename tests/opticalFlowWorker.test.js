import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { OpticalFlowService } from '../src/lib/services/opticalFlowService.ts';

const settle = () => new Promise(setImmediate);
let workers, captures, document, services;
class FakeWorker {
    static autoReady = true;
    requests = [];
    terminated = 0;
    constructor() { workers.push(this); }
    postMessage(message, transfer) {
        this.requests.push({ ...message, transfer });
        if (message.type === 'init' && FakeWorker.autoReady) queueMicrotask(() => this.send({ type: 'ready' }));
    }
    send(data) { this.onmessage?.({ data }); }
    terminate() { this.terminated++; }
}
function video() {
    return { readyState: 2, videoWidth: 1280, videoHeight: 720, scheduled: 0, cancelled: null,
        requestVideoFrameCallback(fn) { this.callback = fn; return ++this.scheduled; },
        cancelVideoFrameCallback(id) { this.cancelled = id; },
        tick(mediaTime) { this.callback(0, { mediaTime }); } };
}
function flow() { const service = new OpticalFlowService(); services.push(service); return service; }
async function deliver(index = captures.length - 1) {
    const capture = captures[index];
    capture.resolve(capture.bitmap);
    await settle();
    return workers[0].requests.findLast(r => r.type === 'frame');
}
function reply(frame, result = null) { workers[0].send({ type: 'result', frameId: frame.frameId, result, processingMs: 10 }); }

beforeEach(t => {
    workers = []; captures = []; services = [];
    document = new EventTarget(); document.hidden = false;
    FakeWorker.autoReady = true;
    const values = { document, Worker: FakeWorker, OffscreenCanvas: class {}, VideoFrame: undefined,
        createImageBitmap: (source, options) => new Promise(resolve => captures.push({ source, options, resolve, bitmap: { closed: 0, close() { this.closed++; } } })) };
    const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(async () => {
        services.forEach(service => service.stopAll());
        captures.forEach(capture => capture.resolve(capture.bitmap));
        await settle();
        for (const [key, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    });
});

test('cameras share one worker and globally keep only one analysis frame in flight', async () => {
    const a = flow(), b = flow(); await Promise.all([a.initialize(), b.initialize()]);
    const first = video(), second = video(); a.start('viewer', first); b.start('viewer', second);
    first.tick(1); second.tick(1); first.tick(1.1);
    assert.equal(workers.length, 1); assert.equal(captures.length, 1);
    assert.equal(captures[0].options, undefined, 'resizing happens in the worker');
    const frame = await deliver(); assert.deepEqual(frame.transfer, [captures[0].bitmap]);
    reply(frame); second.tick(1.1); assert.equal(captures.length, 2);
    const other = await deliver();assert.notEqual(other.id, frame.id);reply(other);
    a.stopAll(); assert.equal(workers[0].terminated, 0);
    b.stopAll(); assert.equal(workers[0].terminated, 1);
});

test('stopping during bitmap capture closes the late bitmap and never posts it', async () => {
    const service = flow(); await service.initialize();const source = video();service.start('a', source);
    source.tick(1); const scheduled = source.scheduled; service.stopAll();
    await deliver(); source.tick(2);
    assert.equal(captures[0].bitmap.closed, 1);
    assert.equal(workers[0].requests.filter(r => r.type === 'frame').length, 0);
    assert.equal(source.scheduled, scheduled);
    assert.equal(source.cancelled, scheduled);
    assert.equal(workers[0].terminated, 1);
});

test('hidden tabs reset references and ignore results already in flight', async () => {
    const service = flow(), results = [];await service.initialize();const source = video();service.start('a', source, result => results.push(result));
    source.tick(1);const frame = await deliver();
    document.hidden = true;document.dispatchEvent(new Event('visibilitychange'));
    reply(frame, { cameraName: 'worker-id', trackedPoints: 10 });source.tick(2);
    assert.equal(results.length, 0);assert.equal(captures.length, 1);
    assert.equal(workers[0].requests.filter(r => r.type === 'reset').length, 1);
    document.hidden = false;source.tick(3);const next = await deliver();reply(next, { cameraName: 'worker-id', trackedPoints: 20 });
    assert.equal(results[0].cameraName, 'a');assert.equal(results[0].trackedPoints, 20);
});

test('late worker results cannot update a stopped camera or its replacement', async () => {
    const a = flow(), b = flow(), results = [];await Promise.all([a.initialize(), b.initialize()]);
    const first = video(), second = video();a.start('a', first, result => results.push(result));b.start('b', second);
    first.tick(1);const frame = await deliver();a.stopAll();reply(frame, { cameraName: 'a' });
    assert.equal(results.length, 0);second.tick(2);assert.equal(captures.length, 2);
});

test('sample scheduling stays capped at 15 FPS even when processing is fast', async () => {
    const service = flow();await service.initialize();const source = video();service.start('a', source);
    for (let i = 0; i < 60; i++) {
        const before = captures.length;source.tick(1 + i / 60);
        if (captures.length > before) reply(await deliver());
    }
    assert.ok(captures.length >= 10 && captures.length <= 15, `processed ${captures.length}`);
});

test('cancelling initialization terminates the worker and releases its lease', async () => {
    FakeWorker.autoReady = false;const service = flow();const pending = service.initialize();
    const rejected = assert.rejects(pending, { name: 'AbortError' });service.stopAll();await rejected;
    assert.equal(workers[0].terminated, 1);
    FakeWorker.autoReady = true;await service.initialize();assert.equal(workers.length, 2);assert.equal(service.isReady(), true);
});

test('worker failures stop every affected diagnostic and allow a fresh runtime', async () => {
    const a = flow(), b = flow(), errors = [];await Promise.all([a.initialize(), b.initialize()]);
    a.start('a', video(), undefined, error => errors.push(error.message));b.start('b', video(), undefined, error => errors.push(error.message));
    workers[0].onerror({ message: 'injected worker failure' });
    assert.deepEqual(errors, ['injected worker failure', 'injected worker failure']);assert.equal(workers[0].terminated, 1);
    await a.initialize();assert.equal(workers.length, 2);
});

test('supported browsers transfer the decoded VideoFrame without a bitmap copy', async () => {
    class Frame {
        constructor(source) { this.source = source; }
        close() {}
    }
    globalThis.VideoFrame = Frame;
    const service = flow();await service.initialize();const source = video();service.start('a', source);
    source.tick(1);await settle();
    const request = workers[0].requests.find(r => r.type === 'frame');
    assert.equal(captures.length, 0);
    assert.ok(request.frame instanceof Frame);
    assert.equal(request.frame.source, source);
    assert.deepEqual(request.transfer, [request.frame]);
});

test('unsupported browsers fail diagnostics without loading a main-thread runtime', async () => {
    globalThis.Worker = undefined;
    const service = flow();
    await assert.rejects(service.initialize(), /requires workers/);
    assert.equal(workers.length, 0);
});
