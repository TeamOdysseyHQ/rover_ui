<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
  import { isFullscreen } from '$lib/stores/fullscreenStore';
  import { expeditionStore, currentExpeditionId, isExpeditionActive } from '$lib/stores/expeditionStore';
  import * as api from '$lib/services/roverApi';
  import { cameraResolutions, selectCameraMode, selectCameraResolution } from '$lib/services/cameraStreamProfile.js';
  import H264Viewer from './H264Viewer.svelte';

  type Camera = { name: string; device_path: string; default_fps: number; active: boolean; default_resolution: string };
  type Size = { width: number; height: number };
  type Format = { fourcc: string; resolutions: Array<Size & { frame_rates?: number[] }> };
  let cameras = $state<Camera[]>([]);
  let active = $state(new Set<string>());
  let busy = $state(new Set<string>());
  let sizes = $state(new Map<string, Size>());
  let formats = $state(new Map<string, Format[]>());
  let rates = $state(new Map<string, number>());
  let error = $state('');
  let notice = $state('');
  let scanning = $state(false);
  let mounted = false;
  let epoch = 0;

  function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
  async function detectCameras() {
    const attempt = ++epoch;
    scanning = true;
    error = '';
    try {
      const result = await api.detectCameras();
      if (!mounted || attempt !== epoch) return;
      cameras = result.cameras ?? [];
      active = new Set(cameras.filter(c => c.active).map(c => c.name));
      await Promise.all(cameras.map(async camera => {
        const [capabilities, status] = await Promise.all([
          api.getSupportedResolutions(camera.name),
          camera.active ? api.getCameraStatus(camera.name) : Promise.resolve(null)
        ]);
        if (!mounted || attempt !== epoch) return;
        formats.set(camera.name, capabilities.formats ?? []);
        const running = status?.camera;
        sizes.set(camera.name, running?.active ? { width: running.width, height: running.height }
          : selectCameraResolution(capabilities.formats, sizes.get(camera.name), camera.default_resolution));
        const size = sizes.get(camera.name)!;
        const mode = selectCameraMode(capabilities.formats, size.width, size.height, camera.default_fps);
        rates.set(camera.name, running?.active ? running.fps : mode.fps);
      }));
      formats = new Map(formats); sizes = new Map(sizes); rates = new Map(rates);
    } catch (reason) { if (mounted && attempt === epoch) error = message(reason); }
    finally { if (attempt === epoch) scanning = false; }
  }
  async function startCamera(camera: Camera) {
    if (busy.has(camera.name)) return;
    busy = new Set(busy).add(camera.name);
    const attempt = epoch;
    try {
      const size = sizes.get(camera.name) ?? { width: 1280, height: 720 };
      const profile = selectCameraMode(formats.get(camera.name), size.width, size.height, camera.default_fps);
      const result = await api.startCamera(camera.name, size.width, size.height, profile.fps, profile.pixelFormat);
      if (!mounted || attempt !== epoch) return;
      rates.set(camera.name, result.camera.fps); rates = new Map(rates);
      active = new Set(active).add(camera.name);
      error = '';
    } catch (reason) { if (mounted && attempt === epoch) error = message(reason); }
    finally { busy.delete(camera.name); busy = new Set(busy); }
  }
  async function stopCamera(name: string) {
    if (busy.has(name)) return;
    busy = new Set(busy).add(name);
    active.delete(name); active = new Set(active);
    try { await api.stopCamera(name); }
    catch (reason) { error = message(reason); }
    finally { busy.delete(name); busy = new Set(busy); }
  }
  async function stopAllCameras() {
    epoch++;
    active = new Set();
    try { await api.stopAllCameras(); }
    catch (reason) { error = message(reason); }
  }
  async function changeResolution(camera: Camera, value: string) {
    const [width, height] = value.split('x').map(Number);
    const restart = active.has(camera.name);
    if (restart) await stopCamera(camera.name);
    sizes.set(camera.name, { width, height }); sizes = new Map(sizes);
    if (restart) { await tick(); await startCamera(camera); }
  }
  async function captureImage(name: string) {
    if (!$isExpeditionActive) { error = 'Start an expedition in Science Reports before capturing an image.'; return; }
    try {
      const result = await api.captureCameraImage(name, { mission_id: 'default', rover_id: 'rover_001' }, $currentExpeditionId);
      expeditionStore.addCapturedImage({ filename: result.saved, camera_name: name, timestamp: new Date().toISOString(), expedition_id: $currentExpeditionId ?? '', file_size_mb: result.file_size_mb });
      notice = `Captured ${result.saved}`;
    } catch (reason) { error = message(reason); }
  }
  $effect(() => {
    const url = $roverApiUrl;
    const connected = $apiStatus === 'connected';
    untrack(() => { if (mounted && connected) void detectCameras(); else { epoch++; active = new Set(); } });
    return () => untrack(() => { epoch++; active = new Set(); });
  });
  onMount(() => {
    mounted = true;
    if ($apiStatus === 'connected') void detectCameras();
    return () => { mounted = false; epoch++; };
  });
</script>

<div class="space-y-4">
  <div class="flex flex-wrap justify-between items-center gap-3 rounded-lg border border-border bg-card p-4">
    <div><h2 class="font-semibold">Camera control</h2><p class="text-xs text-muted-foreground">H.264 · Low latency · Up to 720p60</p></div>
    <div class="flex gap-2">
      <button class="rounded bg-secondary px-3 py-2 text-sm disabled:opacity-40" onclick={detectCameras} disabled={scanning || $apiStatus !== 'connected'}>{scanning ? 'Scanning…' : 'Scan for cameras'}</button>
      <button class="rounded bg-destructive px-3 py-2 text-sm disabled:opacity-40" onclick={stopAllCameras} disabled={!active.size}>Stop all</button>
    </div>
  </div>
  {#if error}<p role="alert" class="rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>{/if}
  {#if notice}<p role="status" class="text-sm text-green-400">{notice}</p>{/if}
  {#if !cameras.length}<p class="p-8 text-center text-muted-foreground">{$apiStatus === 'connected' ? 'Scan for connected cameras.' : 'Connect to the rover to view cameras.'}</p>{/if}
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
    {#each cameras.filter(c => c.name !== 'microscope') as camera (camera.name)}
      <section class="overflow-hidden rounded-lg border border-border bg-card" data-camera={camera.name}>
        <header class="flex items-center justify-between gap-2 border-b border-border p-3">
          <div><h3 class="font-semibold">{camera.name === 'kreo' ? 'Kreo Owl' : camera.name}</h3><p class="text-xs text-muted-foreground">{sizes.get(camera.name)?.width ?? 1280} × {sizes.get(camera.name)?.height ?? 720} · {rates.get(camera.name) ?? camera.default_fps} FPS</p></div>
          <div class="flex gap-2">
            <button class="rounded bg-secondary px-3 py-1.5 text-sm disabled:opacity-40" disabled={busy.has(camera.name) || !active.has(camera.name)} onclick={() => captureImage(camera.name)}>Capture</button>
            <button class="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40" disabled={busy.has(camera.name)} onclick={() => active.has(camera.name) ? stopCamera(camera.name) : startCamera(camera)}>{busy.has(camera.name) ? 'Please wait…' : active.has(camera.name) ? 'Stop' : 'Start'}</button>
          </div>
        </header>
        <div class="aspect-video bg-black">
          {#if active.has(camera.name)}<H264Viewer offerUrl={api.getCameraWebRtcOfferUrl(camera.name)} targetFps={rates.get(camera.name) ?? 60} suspended={$isFullscreen} diagnostics />
          {:else}<div class="flex h-full items-center justify-center text-sm text-muted-foreground">Camera stopped</div>{/if}
        </div>
        <label class="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">Resolution
          <select class="rounded border border-border bg-secondary px-2 py-1" value={`${sizes.get(camera.name)?.width ?? 1280}x${sizes.get(camera.name)?.height ?? 720}`} disabled={busy.has(camera.name)} onchange={e => changeResolution(camera, e.currentTarget.value)}>
            {#each cameraResolutions(formats.get(camera.name)) as size}
              <option value={`${size.width}x${size.height}`}>{size.width} × {size.height}</option>
            {/each}
          </select>
        </label>
      </section>
    {/each}
  </div>
</div>
