<script lang="ts">
  import { tick, untrack } from 'svelte';
  import H264Viewer from './H264Viewer.svelte';
  import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
  import * as api from '$lib/services/roverApi';
  import { selectCameraMode, selectCameraResolution } from '$lib/services/cameraStreamProfile.js';
  let { config = $bindable(), availableCameras = [] } = $props();
  let selectedCamera = $state(config.cameraId ?? config.cameraName ?? '');
  let resolution = $state(config.resolution ?? '720p');
  let topicName = $state(config.topicName ?? '/camera/camera/color/image_raw');
  let ready = $state(false);
  let error = $state('');
  let fps = $state(60);
  let offerUrl = $state('');
  let modeLabel = $state('');
  $effect(() => {
    const configured = config.isConfigured;
    const name = config.cameraId ?? config.cameraName;
    const size = config.resolution ?? '720p';
    const topic = config.topicName ?? '/camera/camera/color/image_raw';
    const connected = $apiStatus === 'connected';
    const baseUrl = $roverApiUrl;
    let cancelled = false;
    untrack(() => { ready = false; error = ''; });
    async function start() {
      if (!configured || !name || !connected) return;
      try {
        if (name === 'ros') {
          const subscribed = await api.subscribeToRosCamera(topic);
          if (!subscribed.success) throw new Error(subscribed.message ?? 'ROS camera unavailable');
          if (cancelled) return;
          fps = 60;
          modeLabel = topic;
          offerUrl = `${baseUrl}/api/nav/ros/camera/webrtc/offer?topic_name=${encodeURIComponent(topic)}`;
        } else {
          const status = await api.getCameraStatus(name);
          if (cancelled) return;
          let camera = status.camera;
          if (!camera.active) {
            const [requestedWidth, requestedHeight] = size === '1080p' ? [1920, 1080] : size === '480p' ? [640, 480] : [1280, 720];
            const modes = await api.getSupportedResolutions(name);
            if (cancelled) return;
            const { width, height } = selectCameraResolution(modes.formats, { width: requestedWidth, height: requestedHeight });
            const profile = selectCameraMode(modes.formats, width, height, 30);
            camera = (await api.startCamera(name, width, height, profile.fps, profile.pixelFormat)).camera;
          }
          if (cancelled) return;
          fps = camera.fps;
          modeLabel = `${camera.width} × ${camera.height} · ${fps} FPS`;
          offerUrl = api.getCameraWebRtcOfferUrl(name);
        }
        if (!cancelled) ready = true;
      } catch (reason) { if (!cancelled) error = reason instanceof Error ? reason.message : String(reason); }
    }
    void start();
    return () => { cancelled = true; };
  });
  async function configure() {
    config = { ...config, cameraId: selectedCamera, resolution, topicName, isConfigured: true };
    await tick();
  }
</script>
<div class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-950 text-white">
  {#if !config.isConfigured}
    <div class="flex w-full max-w-sm flex-col gap-4 p-6">
      <h3 class="font-semibold">Configure camera slot</h3>
      <label class="text-sm">Camera<select class="mt-1 w-full rounded bg-slate-800 p-2" bind:value={selectedCamera}>
        <option value="">Select a camera</option>
        {#each availableCameras as camera}<option value={camera.id ?? camera.name}>{camera.label ?? camera.name}</option>{/each}
      </select></label>
      <label class="text-sm">Resolution<select class="mt-1 w-full rounded bg-slate-800 p-2" bind:value={resolution}><option value="720p">720p</option><option value="1080p">1080p</option><option value="480p">480p</option></select></label>
      {#if selectedCamera === 'ros'}<label class="text-sm">ROS topic<input class="mt-1 w-full rounded bg-slate-800 p-2" bind:value={topicName} /></label>{/if}
      <p class="text-xs text-slate-400">A running camera keeps its current capture mode.</p>
      <button class="rounded bg-sky-600 p-2 disabled:opacity-40" disabled={!selectedCamera} onclick={configure}>View camera</button>
    </div>
  {:else}
    {#if ready}<H264Viewer {offerUrl} targetFps={fps} />{:else}<p role="status" class="p-4 text-sm text-slate-300">{error || 'Starting camera…'}</p>{/if}
    {#if ready}<span class="absolute bottom-10 left-2 rounded bg-black/80 px-2 py-1 text-xs">{modeLabel}</span>{/if}
    <button class="absolute top-12 right-2 rounded bg-black/80 px-2 py-1 text-xs" onclick={() => { config = { ...config, isConfigured: false }; }}>Edit</button>
  {/if}
</div>
