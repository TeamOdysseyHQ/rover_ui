<script lang="ts">
  import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
  import { isFullscreen } from '$lib/stores/fullscreenStore';
  import { currentExpeditionId, isExpeditionActive, expeditionStore } from '$lib/stores/expeditionStore';
  import * as api from '$lib/services/roverApi';
  import H264Viewer from './H264Viewer.svelte';
  let { microscopeActive: active = $bindable(false) }: { microscopeActive?: boolean } = $props();
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  let epoch = 0;
  async function startMicroscope() {
    if (busy) return;
    busy = true;
    const attempt = epoch;
    try { await api.startMicroscope(640, 480, 30); if (attempt === epoch) active = true; }
    catch (reason) { if (attempt === epoch) error = reason instanceof Error ? reason.message : String(reason); }
    finally { if (attempt === epoch) busy = false; }
  }
  async function stopMicroscope() {
    epoch++; active = false; busy = true;
    try { await api.stopMicroscope(); }
    catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
    finally { busy = false; }
  }
  async function captureImage() {
    if (!$isExpeditionActive) { error = 'Start an expedition before capturing an image.'; return; }
    try {
      const result = await api.captureMicroscopeImage({}, $currentExpeditionId);
      expeditionStore.addCapturedImage({ filename: result.saved, camera_name: 'microscope', timestamp: new Date().toISOString(), expedition_id: $currentExpeditionId ?? '', file_size_mb: result.file_size_mb });
      notice = `Captured ${result.saved}`;
    } catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
  }
  $effect(() => {
    const url = $roverApiUrl;
    const connected = $apiStatus === 'connected';
    if (!connected) { epoch++; active = false; busy = false; }
    return () => { epoch++; };
  });
</script>
<section class="space-y-3 rounded-lg border border-border bg-card p-4">
  <header class="flex items-center justify-between gap-3"><h3 class="font-semibold">Microscope</h3>
    <div class="flex gap-2"><button class="rounded bg-secondary px-3 py-1.5 text-sm disabled:opacity-40" disabled={!active || busy} onclick={captureImage}>Capture</button><button class="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40" disabled={$apiStatus !== 'connected' || busy} onclick={() => active ? stopMicroscope() : startMicroscope()}>{busy ? 'Please wait…' : active ? 'Stop' : 'Start'}</button></div>
  </header>
  {#if error}<p role="alert" class="text-sm text-red-400">{error}</p>{/if}
  {#if notice}<p role="status" class="text-sm text-green-400">{notice}</p>{/if}
  <div class="aspect-video bg-black">{#if active}<H264Viewer offerUrl={`${api.getApiBaseUrl()}/api/sci/microscope/webrtc/offer`} targetFps={30} suspended={$isFullscreen} />{:else}<div class="flex h-full items-center justify-center text-sm text-muted-foreground">Microscope stopped</div>{/if}</div>
</section>
