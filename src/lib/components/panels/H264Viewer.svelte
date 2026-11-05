<script lang="ts">
  import { tick } from 'svelte';
  import { WebRtcStreamClient, type WebRtcMetrics } from '$lib/services/webRtcStreamClient';
  import { OpticalFlowService, type OpticalFlowResult } from '$lib/services/opticalFlowService';
  import { dejelloHint, dejelloUrlFor, getDejello, updateDejello, type DejelloUpdate, type OnboardDejelloStatus } from '$lib/services/onboardDejello';
  import { devFlowLog } from '$lib/services/devFlowLog';

  let { offerUrl, targetFps = 60, diagnostics = false, suspended = false }: {
    offerUrl: string; targetFps?: number; diagnostics?: boolean; suspended?: boolean;
  } = $props();
  let video = $state<HTMLVideoElement>();
  let state = $state('connecting');
  let error = $state('');
  let metrics = $state<WebRtcMetrics | null>(null);
  let flowEnabled = $state(false);
  let flowResult = $state<OpticalFlowResult | null>(null);
  const flow = new OpticalFlowService();
  // IMU de-jello runs on the rover: gyro, onboard flow calibration and correction before encoding.
  // The browser only toggles it and shows a status summary; gyro data never leaves the rover.
  let dejello = $state<OnboardDejelloStatus | null>(null);
  let dejelloBusy = $state(false);
  const dejelloUrl = $derived(diagnostics ? dejelloUrlFor(offerUrl) : null);

  $effect(() => {
    const endpoint = offerUrl;
    const fps = targetFps;
    if (suspended) {
      state = 'paused';
      metrics = null;
      error = '';
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
        if (!cancelled && client === current) state = value;
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
        result => {
          if (cancelled) return;
          flowResult = result;
          devFlowLog(result, { camera: offerUrl, fps: metrics?.fps, width: element.videoWidth, height: element.videoHeight });
        },
        reason => { if (!cancelled) { error = `Optical flow: ${reason.message}`; flowEnabled = false; } });
    }).catch(reason => { if (!cancelled) { error = String(reason); flowEnabled = false; } });
    return () => { cancelled = true; flow.stopAll(); flowResult = null; };
  });

  // Poll onboard correction status while the stream is up (slower when it is off).
  $effect(() => {
    const url = dejelloUrl;
    if (!url || state !== 'connected') { dejello = null; return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try { dejello = await getDejello(url, controller.signal); }
      catch (reason) { if (!controller.signal.aborted) dejello = null; }
      if (!controller.signal.aborted) timer = setTimeout(poll, dejello?.enabled ? 1000 : 5000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  });

  async function configureDejello(update: DejelloUpdate) {
    const url = dejelloUrl;
    if (!url || dejelloBusy) return;
    dejelloBusy = true;
    try { dejello = await updateDejello(url, update); }
    catch (reason) { error = `De-jello: ${reason instanceof Error ? reason.message : String(reason)}`; }
    finally { dejelloBusy = false; }
  }
</script>

<div class="relative w-full h-full min-h-40 bg-black" data-camera-viewer>
  <video bind:this={video} autoplay muted playsinline class="w-full h-full object-contain" aria-label="Rover camera feed"></video>
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
  {#if error}
    <div role="alert" class="absolute inset-x-2 bottom-10 rounded bg-red-950/90 p-2 text-xs text-red-100">{error}</div>
  {/if}
  {#if diagnostics}
    <div class="absolute bottom-2 right-2 flex gap-3 rounded bg-black/80 px-2 py-1 text-xs text-white">
      <label><input type="checkbox" bind:checked={flowEnabled} /> Optical flow</label>
      {#if dejelloUrl && dejello}
        <label title="Rolling-shutter correction on the rover using the BNO055 gyro; frames are corrected before encoding">
          <input type="checkbox" checked={dejello.enabled} disabled={dejelloBusy}
            onchange={e => configureDejello({ enabled: e.currentTarget.checked })} /> IMU de-jello
        </label>
      {/if}
    </div>
  {/if}
  {#if diagnostics && dejello?.enabled}
    <div class="absolute top-10 right-2 max-w-64 space-y-1 rounded bg-black/80 px-2 py-1 text-xs font-mono text-white">
      <label class="flex items-center gap-1" title="Motion source: IMU gyro, the video's own optical flow, or IMU when calibrated else video">
        source
        <select class="rounded bg-secondary px-1 text-xs" value={dejello.source} disabled={dejelloBusy}
          onchange={e => configureDejello({ source: e.currentTarget.value as 'auto' | 'imu' | 'video' })}>
          <option value="auto">auto</option><option value="imu">IMU</option><option value="video">video only</option>
        </select>
        <span>{dejello.active_source ? `→ ${dejello.active_source === 'imu' ? 'IMU' : 'video'}` : '→ off'}</span>
      </label>
      <div>{dejello.stats.corrected} frames corrected · IMU {dejello.gyro.rate_hz.toFixed(0)} Hz</div>
      {#if dejelloHint(dejello)}<div class="whitespace-normal text-amber-300">{dejelloHint(dejello)}</div>{/if}
      <label class="flex items-center gap-1" title="Top-to-bottom sensor readout time">
        readout
        <input type="range" min="0" max={Math.max(8, Math.min(100, Math.floor(1000 / Math.max(1, targetFps))))} step="1" value={dejello.readout_ms}
          disabled={dejelloBusy} onchange={e => configureDejello({ readout_ms: Number(e.currentTarget.value) })} class="w-20" />
        {dejello.readout_ms.toFixed(0)} ms ({dejello.readout_source})
      </label>
      {#if dejello.active_source}
        <div>shear removed ≤ {dejello.stats.warp_px.toFixed(1)} px · {dejello.stats.correct_ms.toFixed(1)} ms/frame</div>
      {/if}
      <div class="flex gap-2">
        {#if dejello.readout_source === 'manual'}<button class="underline" disabled={dejelloBusy} onclick={() => configureDejello({ reset_readout: true })}>auto readout</button>{/if}
        {#if dejello.calibration}<button class="underline" disabled={dejelloBusy} onclick={() => configureDejello({ reset_calibration: true })}>recalibrate IMU</button>{/if}
      </div>
      {#if dejello.calibration}
        <div title="Share of image motion explained by the gyro">fit R² {dejello.calibration.fit.toFixed(2)} · {dejello.calibration.samples} frames</div>
        <div title="Middle-row exposure relative to the capture stamp">IMU offset {dejello.calibration.offset_ms.toFixed(0)} ms{dejello.calibration.roll_fitted ? '' : ' · no roll'}</div>
      {/if}
      {#if dejello.video_readout}
        <div title="Estimated from top-vs-bottom flow differences on the rover">video readout ≈ {dejello.video_readout.readout_ms.toFixed(1)} ms</div>
      {/if}
    </div>
  {/if}
  {#if flowEnabled && flowResult}
    <div class="absolute top-10 left-2 rounded bg-black/80 px-2 py-1 text-xs font-mono text-white pointer-events-none">
      {flowResult.trackedPoints} tracks · dx {flowResult.meanDx.toFixed(2)} · dy {flowResult.meanDy.toFixed(2)} px/frame
      <div title="Mean vertical flow and accepted tracks in the top, middle and bottom thirds">Band dy: {flowResult.topMeanDy?.toFixed(2) ?? '—'} ({flowResult.topPoints}) / {flowResult.middleMeanDy?.toFixed(2) ?? '—'} ({flowResult.middlePoints}) / {flowResult.bottomMeanDy?.toFixed(2) ?? '—'} ({flowResult.bottomPoints})</div>
    </div>
  {/if}
</div>
