<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { WebRtcStreamClient, type WebRtcMetrics } from '$lib/services/webRtcStreamClient';
  import { OpticalFlowService, type OpticalFlowResult } from '$lib/services/opticalFlowService';

  let { offerUrl, targetFps = 60, diagnostics = false, suspended = false }: {
    offerUrl: string; targetFps?: number; diagnostics?: boolean; suspended?: boolean;
  } = $props();
  let video = $state<HTMLVideoElement>();
  let hidden = $state(typeof document !== 'undefined' && document.hidden);
  let state = $state('connecting');
  let error = $state('');
  let playbackBlocked = $state(false);
  let playbackError = $state('');
  let metrics = $state<WebRtcMetrics | null>(null);
  let flowEnabled = $state(false);
  let flowResult = $state<OpticalFlowResult | null>(null);
  const flow = new OpticalFlowService();

  onMount(() => {
    const visibility = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => document.removeEventListener('visibilitychange', visibility);
  });

  async function playVideo() {
    const element = video;
    if (!element?.srcObject) return;
    const stream = element.srcObject;
    try {
      element.muted = true;
      await element.play();
      if (video !== element || element.srcObject !== stream) return;
      playbackBlocked = false;
      playbackError = '';
    } catch (reason: unknown) {
      if (video !== element || element.srcObject !== stream) return;
      const name = reason && typeof reason === 'object' && 'name' in reason ? reason.name : '';
      if (name === 'AbortError') return;
      playbackBlocked = name === 'NotAllowedError';
      playbackError = playbackBlocked ? '' : 'H.264 playback failed. Check that this browser has H.264 video support enabled.';
    }
  }

  function mediaFailed() {
    if (!video?.srcObject || !video.error || video.error.code === 1) return;
    playbackBlocked = false;
    playbackError = video.error.code === 3 || video.error.code === 4
      ? 'This browser could not decode the H.264 video. Check its H.264 codec support.'
      : 'Video playback failed. Close and reopen this camera view.';
  }

  $effect(() => {
    const endpoint = offerUrl;
    const fps = targetFps;
    if (suspended || hidden) {
      state = 'paused';
      metrics = null;
      error = '';
      playbackBlocked = false;
      playbackError = '';
      return;
    }
    let cancelled = false;
    let client: WebRtcStreamClient | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    async function connect() {
      await tick();
      if (cancelled || !video) return;
      const current = new WebRtcStreamClient();
      client = current;
      metrics = null;
      error = '';
      playbackBlocked = false;
      playbackError = '';
      state = 'connecting';
      let failed = false;
      const failure = (reason: Error & { status?: number }) => {
        if (cancelled || client !== current || failed || reason.name === 'AbortError') return;
        failed = true;
        state = 'error';
        error = reason.message;
        void current.disconnect();
        // Capacity and stopped cameras require an operator action, not another transport.
        if (![400, 404, 409, 429].includes(reason.status ?? 0) && failures++ < 3) {
          retry = setTimeout(() => { void connect(); }, 2000);
        }
      };
      current.onStateChange(value => {
        if (!cancelled && client === current && !failed) state = value;
      });
      current.onMetrics(value => {
        if (!cancelled && client === current) { metrics = value; if (value.fps > 0) failures = 0; }
      });
      current.onError(failure);
      try { await current.connect(endpoint, video, fps); }
      catch (reason) { failure(reason instanceof Error ? reason : new Error(String(reason))); }
    }
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      void client?.disconnect();
      flow.stopAll();
    };
  });

  $effect(() => {
    if (!diagnostics || !flowEnabled || state !== 'connected' || !video) return;
    const element = video;
    error = '';
    let cancelled = false;
    void flow.initialize().then(() => {
      if (!cancelled) flow.start('viewer', element,
        result => { if (!cancelled) flowResult = result; },
        reason => { if (!cancelled) { error = `Optical flow: ${reason.message}`; flowEnabled = false; } });
    }).catch(reason => { if (!cancelled) { error = String(reason); flowEnabled = false; } });
    return () => { cancelled = true; flow.stopAll(); flowResult = null; };
  });
</script>

<div class="relative w-full h-full min-h-40 bg-black" data-camera-viewer>
  <video bind:this={video} autoplay muted playsinline onloadedmetadata={playVideo} onerror={mediaFailed} onplaying={() => { playbackBlocked = false; playbackError = ''; }} class="w-full h-full object-contain" aria-label="Rover camera feed"></video>
  <div class="absolute top-2 left-2 rounded bg-black/80 px-2 py-1 text-xs text-white pointer-events-none">
    {state === 'connected' && (metrics?.fps ?? 0) > 0 ? 'LIVE' : state === 'connected' ? 'Waiting for frames' : state}
    · H.264
  </div>
  <div class="absolute top-2 right-2 rounded bg-black/80 px-2 py-1 text-xs font-mono text-white pointer-events-none">
    {metrics ? metrics.fps.toFixed(1) : '—'} / {metrics?.targetFps ?? targetFps} FPS
  </div>
  {#if metrics}
    <div class="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-1 text-xs font-mono text-white pointer-events-none">
      {(metrics.bitrateBps / 1e6).toFixed(2)} Mb/s
      {#if metrics.latencyMs != null}
        · {metrics.latencyMs.toFixed(1)} ms buffer → browser
        <span title="Half of the best clock-probe round trip; clock asymmetry and drift can add error">~{metrics.clockUncertaintyMs?.toFixed(1)} ms clock estimate</span>
      {/if}
    </div>
  {/if}
  {#if error || playbackError}
    <div role="alert" class="absolute inset-x-2 bottom-10 rounded bg-red-950/90 p-2 text-xs text-red-100">{error || playbackError}</div>
  {/if}
  {#if playbackBlocked}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
      <p class="text-sm">Browser blocked automatic playback.</p>
      <button type="button" class="rounded bg-sky-600 px-4 py-2 text-sm font-medium" onclick={playVideo}>Play video</button>
    </div>
  {/if}
  {#if diagnostics}
    <label class="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs text-white">
      <input type="checkbox" bind:checked={flowEnabled} /> Optical flow
    </label>
  {/if}
  {#if flowEnabled && flowResult}
    <div class="absolute top-10 left-2 rounded bg-black/80 px-2 py-1 text-xs font-mono text-white pointer-events-none">
      {flowResult.trackedPoints} tracks · dx {flowResult.meanDx.toFixed(2)} · dy {flowResult.meanDy.toFixed(2)} px/frame
      <div>Band dy: {flowResult.topMeanDy?.toFixed(2) ?? '—'} / {flowResult.middleMeanDy?.toFixed(2) ?? '—'} / {flowResult.bottomMeanDy?.toFixed(2) ?? '—'}</div>
    </div>
  {/if}
</div>
