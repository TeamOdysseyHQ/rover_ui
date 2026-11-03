import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import * as api from '../src/lib/services/roverApi.js';
const settle = () => new Promise(setImmediate);
function slot(config, overrides = {}) {
 const source = readFileSync(new URL('../src/lib/components/panels/FullscreenCameraSlot.svelte', import.meta.url), 'utf8')
  .split('<script lang="ts">')[1].split('</script>')[0].replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '');
 const effects = [], calls = [];
 const context = { $props: () => ({ config }), $bindable: () => {}, $state: value => value,
  $effect: fn => effects.push(fn), $apiStatus: 'connected', $roverApiUrl: 'http://rover', untrack: fn => fn(), tick: async () => {},
  api: { getCameraStatus: async name => { calls.push(['status', name]); return { camera: { active: true, width: 640, height: 480, fps: 30 } }; },
   getSupportedResolutions: async () => { throw Error('Running source should not be renegotiated'); },
   startCamera: async () => { throw Error('Running source should not be restarted'); },
   getCameraWebRtcOfferUrl: name => `http://rover/api/nav/cameras/${name}/webrtc/offer`,
   subscribeToRosCamera: async topic => { calls.push(['subscribe', topic]); return { success: true }; }, ...overrides }
 };
 runInNewContext(stripTypeScriptTypes(source) + '\nglobalThis.result=()=>({ready,error,offerUrl,fps,modeLabel});', context);
 const cleanup = effects[0]();
 return { calls, result: context.result, cleanup };
}
test('fullscreen attaches to the existing capture mode without restarting it', async () => {
 const s = slot({ cameraId: 'kreo', isConfigured: true, resolution: '720p' });
 await settle();assert.equal(s.result().ready, true);assert.equal(s.result().fps, 30);
 assert.match(s.result().modeLabel, /640 × 480/);assert.deepEqual(s.calls, [['status', 'kreo']]);s.cleanup();
});
test('fullscreen uses the configured ROS topic for subscription and offer', async () => {
 const s = slot({ cameraId: 'ros', isConfigured: true, topicName: '/custom/image raw' });
 await settle();assert.equal(s.result().ready, true);assert.deepEqual(s.calls, [['subscribe', '/custom/image raw']]);
 assert.equal(new URL(s.result().offerUrl).searchParams.get('topic_name'), '/custom/image raw');s.cleanup();
});
test('closing a fullscreen slot during status discovery cannot start a camera', async () => {
 let resolve;
 const s = slot({ cameraId: 'kreo', isConfigured: true }, { getCameraStatus: () => new Promise(r => { resolve = r; }) });
 s.cleanup();resolve({ camera: { active: false } });await settle();assert.equal(s.result().ready, false);
});
test('microscope capture omits missing metadata so FastAPI defaults apply', async () => {
 const original = globalThis.fetch;
 let body;
 globalThis.fetch = async (_url, request) => { body = request.body; return { ok: true, json: async () => ({ success: true }) }; };
 try {
  await api.captureMicroscopeImage({}, 'test-expedition');
  assert.equal(body.get('expedition_id'), 'test-expedition');
  for (const name of ['latitude', 'longitude', 'altitude', 'battery_level', 'mission_id', 'rover_id']) assert.equal(body.has(name), false);
  await api.captureMicroscopeImage({ latitude: 0, battery_level: 0 });
  assert.equal(body.get('latitude'), '0');assert.equal(body.get('battery_level'), '0');
 } finally { globalThis.fetch = original; }
});
