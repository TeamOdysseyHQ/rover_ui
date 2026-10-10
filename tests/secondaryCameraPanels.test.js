import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

function setup(kind) {
    const microscope = kind === 'microscope';
    const component = microscope ? 'MicroscopePanel' : 'RosCameraPanel';
    const source = readFileSync(new URL(`../src/lib/components/panels/${component}.svelte`, import.meta.url), 'utf8')
        .split('<script lang="ts">')[1].split('</script>')[0]
        .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '');
    const active = microscope ? 'microscopeActive' : 'isSubscribed';
    const script = stripTypeScriptTypes(source) + `
globalThis.h = {
    startWebRtcStream, setStreamingMode, releaseLocalStreams,
    start: ${microscope ? 'startMicroscope' : 'subscribe'},
    prepare(value = true) { mounted = true; ${active} = value; videoRef = {}; canvasRef = {}; },
    state: () => ({ active: ${active}, rtcState, rtcFps, mode: streamingMode }),
    ${microscope ? 'slider(fps, quality) { mjpegFps = fps; mjpegQuality = quality; handleMjpegParamChange(); }, url: getStreamUrl,' : ''}
};`;
    const peers = [], mounts = [], timers = [], polls = [], backendStops = [], wsPeers = [];
    class Peer {
        disconnects = 0;
        constructor() { peers.push(this); }
        onStateChange(fn) { this.stateChanged = fn; }
        onMetrics(fn) { this.metrics = fn; }
        onError(fn) { this.error = fn; }
        connect() {
            this.stateChanged('connecting');
            return new Promise((resolve, reject) => { this.resolve = () => { this.stateChanged('connected'); resolve(); }; this.reject = reject; });
        }
        async disconnect() { this.disconnects++; this.stateChanged('disconnected'); }
    }
    class WsPeer {
        constructor() { wsPeers.push(this); }
        onStateChange() {} onMetrics() {} onError() {}
        async connectCustom() {} disconnect() {}
    }
    const api = {
        getApiBaseUrl: () => 'http://mock.invalid', getRosCameraWebSocketUrl: () => 'ws://mock.invalid',
        getMicroscopeStreamUrl: (fps, quality) => `/?fps=${fps}&quality=${quality}`,
        getRosCameraStreamUrl: () => '/ros',
        getRosCameraWebRtcStatus: async () => ({ active_connections: 1 }),
        getMicroscopeWebRtcStatus: async () => ({ active_connections: 1 }),
        startMicroscope: async () => ({}), subscribeToRosCamera: async () => ({ success: true }),
        stopMicroscope: async () => { backendStops.push(true); }, unsubscribeFromRosCamera: async () => { backendStops.push(true); },
    };
    const context = {
        $props: () => ({}), $bindable: value => value, $state: value => value, $effect() {}, untrack: fn => fn(),
        $apiStatus: 'connected', $roverApiUrl: 'http://mock.invalid', api, roverApi: api,
        WebRtcStreamClient: Peer, VideoStreamClient: WsPeer,
        onMount: fn => mounts.push(fn), tick: async () => {}, console,
        window: { addEventListener() {}, removeEventListener() {} },
        setTimeout: (fn, delay) => { timers.push({ fn, delay, cancelled: false }); return timers.length; },
        clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cancelled = true; },
        pollEvery: task => {
            const controller = new AbortController();
            polls.push({ task, controller });
            return () => controller.abort();
        },
    };
    runInNewContext(script, context);
    context.h.prepare();
    const cleanup = mounts[0]();
    const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    return { h: context.h, context, peers, wsPeers, timers, polls, backendStops, cleanup, settle };
}

for (const kind of ['microscope', 'ros']) {
    test(`${kind}: established transport errors release the peer and retry once`, async () => {
        const { h, peers, timers, polls, settle } = setup(kind);
        h.startWebRtcStream(); peers[0].resolve(); await settle();
        peers[0].metrics({ fps: 24 });
        assert.equal(h.state().rtcFps, 24);
        peers[0].error(new Error('WebRTC transport failed'));
        peers[0].error(new Error('duplicate failure'));
        assert.equal(peers[0].disconnects, 1);
        assert.equal(h.state().rtcFps, 0);
        assert.equal(h.state().rtcState, 'error');
        assert.equal(polls[0].controller.signal.aborted, true);
        const retries = timers.filter(timer => timer.fn.toString().includes('startWebRtcStream') && !timer.cancelled);
        assert.equal(retries.length, 1);
        retries[0].fn();
        assert.equal(peers.length, 2);
        peers[0].metrics({ fps: 99 });
        assert.equal(h.state().rtcFps, 0, 'retired peer cannot report live frames');
    });

    test(`${kind}: negotiation callback plus promise rejection schedules one retry`, async () => {
        const { h, peers, timers, settle } = setup(kind);
        h.startWebRtcStream();
        const error = Object.assign(new Error('negotiation failed'), { status: 500 });
        peers[0].error(error); peers[0].reject(error); await settle();
        assert.equal(timers.filter(timer => timer.fn.toString().includes('startWebRtcStream') && !timer.cancelled).length, 1);
    });

    test(`${kind}: unmount releases only this viewer and prevents pending retries`, async () => {
        const { h, peers, timers, backendStops, cleanup, settle } = setup(kind);
        h.startWebRtcStream(); peers[0].resolve(); await settle();
        peers[0].error(new Error('transport failed'));
        const retry = timers.find(timer => timer.fn.toString().includes('startWebRtcStream') && !timer.cancelled);
        cleanup(); await settle(); retry.fn();
        assert.equal(backendStops.length, 0);
        assert.equal(h.state().active, false);
        assert.equal(peers.length, 1);
        assert.equal(retry.cancelled, true);
    });

    test(`${kind}: a late start response cannot revive an unmounted panel`, async () => {
        const { h, context, peers, cleanup } = setup(kind);
        h.prepare(false);
        let resolve;
        const start = () => new Promise(done => { resolve = done; });
        if (kind === 'microscope') context.roverApi.startMicroscope = start;
        else context.api.subscribeToRosCamera = start;
        const pending = h.start(); cleanup(); resolve({ success: true }); await pending;
        assert.equal(h.state().active, false); assert.equal(peers.length, 0);
    });

    test(`${kind}: mode choice attaches the selected transport after rendering`, async () => {
        const { h, peers, wsPeers } = setup(kind);
        await h.setStreamingMode('websocket');
        assert.equal(h.state().mode, 'websocket'); assert.equal(wsPeers.length, 1);
        await h.setStreamingMode('mjpeg');
        assert.equal(h.state().mode, 'mjpeg'); assert.equal(peers.length, 0);
    });
}

test('microscope: MJPEG stream parameters commit after a single debounce', () => {
    const { h, timers } = setup('microscope');
    h.slider(20, 70); h.slider(15, 50);
    assert.equal(h.url(), '/?fps=30&quality=80');
    const pending = timers.filter(timer => !timer.cancelled);
    assert.equal(pending.length, 1); pending[0].fn();
    assert.equal(h.url(), '/?fps=15&quality=50');
});
