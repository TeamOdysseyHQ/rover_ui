import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VideoStreamClient } from '../src/lib/services/videoStreamService.ts';

function setup(t) {
    const previousWindow = globalThis.window;
    globalThis.window = globalThis;
    t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 100000 });
    const client = new VideoStreamClient({ fps: 30 });
    const sent = [];
    client.ws = { send: message => sent.push(JSON.parse(message)) };
    client.handleOpen();
    return { client, sent };
}

test('each WebSocket metric update is a new snapshot for reactive consumers', t => {
    const { client } = setup(t);
    const samples = [];
    client.onMetrics(metrics => samples.push(metrics));
    client.metrics.framesReceived = 30;
    t.mock.timers.tick(1000);
    client.metrics.framesReceived = 60;
    t.mock.timers.tick(1000);
    assert.notEqual(samples[0], samples[1]);
    assert.equal(samples[0].framesReceived, 30);
    assert.equal(samples[1].framesReceived, 60);
    t.mock.timers.tick(1000);
    assert.equal(samples[2].fps, 0, 'stalled streams must not retain stale FPS');
});

test('camera JPEG quality adapts through the existing control protocol without reducing FPS', t => {
    const { client, sent } = setup(t);
    const frame = new ArrayBuffer(25);
    const view = new DataView(frame);
    view.setUint32(0, 0x524F5652, true);
    view.setBigInt64(8, BigInt(Date.now()) * 1000n, true);
    client.handleFrame(frame);
    for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
    assert.deepEqual(sent, [{ type: 'control', action: 'set_quality', params: { quality: 75 } }]);
    assert.equal(client.getMetrics().targetFps, 30);
    assert.equal(client.getMetrics().quality, 75);
});

function decoder(t) {
    const images = [], blobs = [], revoked = [], draws = [];
    const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
    class FakeImage { constructor() { this.width = 640; this.height = 480; images.push(this); } }
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
    t.after(() => { if (original) Object.defineProperty(globalThis, 'Image', original); else delete globalThis.Image; });
    t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return `blob:${blobs.length}`; });
    t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
    const client = new VideoStreamClient();
    client.canvas = { width: 640, height: 480 };
    client.ctx = { fillRect() {}, drawImage: image => draws.push(image) };
    return { client, images, blobs, revoked, draws };
}

test('JPEG bursts retain one active decode and the newest pending frame', async t => {
    const { client, images, blobs, draws, revoked } = decoder(t);
    for (let n = 1; n <= 200; n++) client.handleFrame(new Uint8Array([n]).buffer);
    assert.equal(images.length, 1);
    assert.equal(blobs.length, 1);
    images[0].onload();
    assert.equal(images.length, 2);
    assert.equal(new Uint8Array(await blobs[1].arrayBuffer())[0], 200);
    images[1].onload();
    assert.equal(draws.length, 2);
    assert.equal(client.pendingFrame, null);
    assert.equal(client.decodingImage, null);
    assert.deepEqual(revoked, ['blob:1', 'blob:2']);
});

test('disconnect discards pending images and late decodes cannot draw', t => {
    const { client, images, draws, revoked } = decoder(t);
    client.handleFrame(new Uint8Array([1]).buffer);
    client.handleFrame(new Uint8Array([2]).buffer);
    const lateLoad = images[0].onload;
    client.disconnect(); lateLoad();
    assert.equal(draws.length, 0);
    assert.equal(images.length, 1);
    assert.equal(client.pendingFrame, null);
    assert.ok(revoked.includes('blob:1'));
});

test('custom WebSocket streams reconnect and ignore events from the previous socket', async t => {
    const originalWindow = globalThis.window;
    globalThis.window = globalThis;
    t.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const sockets = [];
    class FakeSocket { constructor(url) { this.url = url; sockets.push(this); } close() {} }
    const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeSocket });
    t.after(() => Object.defineProperty(globalThis, 'WebSocket', original));
    const client = new VideoStreamClient({ reconnectDelay: 100 });
    await client.connectCustom('ws://mock.invalid/ros'); sockets[0].onopen();
    sockets[0].onclose({ code: 1006, reason: 'lost' });
    sockets[0].onopen();
    sockets[0].onmessage({ data: new Uint8Array([1]).buffer });
    assert.equal(client.getState(), 'disconnected');
    assert.equal(client.getMetrics().framesReceived, 0, 'a closed socket must not deliver late frames');
    t.mock.timers.tick(100);
    assert.equal(sockets.length, 2);
    assert.equal(sockets[1].url, 'ws://mock.invalid/ros');
    sockets[1].onopen(); sockets[0].onclose({ code: 1006, reason: 'late' });
    assert.equal(client.getState(), 'connected');
    client.disconnect(); t.mock.timers.tick(1000);
    assert.equal(sockets.length, 2);
});

test('disconnected streams clear throughput and reconnect starts fresh latency measurements', t => {
    const { client } = setup(t);
    client.metrics.framesReceived = 30;
    client.metrics.bytesReceived = 1000;
    client.latencyHistory = [500];
    t.mock.timers.tick(1000);
    assert.equal(client.getMetrics().fps, 30);
    client.handleClose({ code: 1000, reason: 'closed' });
    assert.equal(client.getMetrics().fps, 0);
    assert.equal(client.getMetrics().bitrateBps, 0);
    client.handleOpen();
    t.mock.timers.tick(1000);
    assert.equal(client.getMetrics().avgLatencyMs, 0);
    client.disconnect();
});

test('invalid stream rates are bounded and socket-send races are reported without throwing', t => {
    const client = new VideoStreamClient({ quality: NaN, fps: Infinity });
    assert.equal(client.config.quality, 85);
    assert.equal(client.config.fps, 30);
    client.ws = { readyState: 1, send: () => { throw new Error('socket closed'); }, close() {} };
    client.state = 'connected';
    const errors = [];
    client.onError(error => errors.push(error));
    assert.doesNotThrow(() => client.setQuality(75));
    assert.equal(errors[0].message, 'socket closed');
    client.setQuality(NaN);
    assert.equal(client.config.quality, 75);
    client.disconnect();
});

test('hardware WebSocket URL uses the API host and a late open cannot undo disconnect', async t => {
    const sockets = [];
    class FakeSocket { constructor(url) { this.url = url; sockets.push(this); } close() {} }
    const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeSocket });
    t.after(() => Object.defineProperty(globalThis, 'WebSocket', original));
    const client = new VideoStreamClient({ fps: 24 });
    await client.connect('science');
    assert.match(sockets[0].url, /^ws:\/\/192\.168\.1\.3:6767\/api\/nav\/cameras\/science\/ws\?quality=85&fps=24$/);
    client.disconnect(); sockets[0].onopen();
    assert.equal(client.getState(), 'disconnected');
});
