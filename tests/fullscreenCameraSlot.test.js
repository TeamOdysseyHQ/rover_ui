import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/lib/components/panels/FullscreenCameraSlot.svelte', import.meta.url), 'utf8')
    .split('<script lang="ts">')[1].split('</script>')[0]
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '');
const script = stripTypeScriptTypes(source) + '\nglobalThis.h = { initStream, teardownStream, handleEdit, setPeer(peer) { rtcClient = peer; } };';
function setup() {
    let destroy, resolveCapabilities;
    const starts = [], stops = [], connects = [];
    const context = {
        $props: () => ({ config: { cameraId: 'science', streamType: 'webrtc', isConfigured: true }, availableCameras: [] }),
        $bindable: () => ({}), $state: value => value, $derived: value => value, $effect() {},
        onDestroy: fn => { destroy = fn; }, tick: async () => {}, console,
        getApiBaseUrl: () => 'http://mock.invalid', WEBRTC_TARGET_FPS: 24,
        getSupportedResolutions: () => new Promise(resolve => { resolveCapabilities = resolve; }),
        startCamera: async name => { starts.push(name); return {}; },
        stopCamera: async name => { stops.push(name); },
        selectCameraMode: () => ({ fps: 24 }),
        WebRtcStreamClient: class { onMetrics() {} onError() {} connect() { connects.push(1); } },
        setTimeout: fn => { fn(); }
    };
    runInNewContext(script, context);
    return { h: context.h, starts, stops, connects, destroy: () => destroy(), ready: () => resolveCapabilities({ formats: [] }) };
}

test('closing/editing a fullscreen slot releases its peer without stopping the shared camera', async () => {
    const { h, stops, destroy } = setup();
    let disconnects = 0;
    h.setPeer({ disconnect: async () => { disconnects++; } });
    await h.handleEdit(); destroy();
    assert.equal(disconnects, 1);
    assert.deepEqual(stops, []);
});

test('a slow fullscreen startup cannot attach a viewer after unmount', async () => {
    const { h, starts, connects, destroy, ready } = setup();
    const pending = h.initStream();
    await new Promise(setImmediate);
    destroy(); ready(); await pending;
    assert.deepEqual(starts, []);
    assert.deepEqual(connects, []);
});
