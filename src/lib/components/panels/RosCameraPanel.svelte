<script lang="ts">
  import { untrack } from 'svelte';
  import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
  import { isFullscreen } from '$lib/stores/fullscreenStore';
  import * as api from '$lib/services/roverApi';
  import H264Viewer from './H264Viewer.svelte';
  let { topicName = '/camera/camera/color/image_raw', title = 'ROS Camera Feed', autoSubscribe = true }: { topicName?: string; title?: string; autoSubscribe?: boolean } = $props();
  let subscribed = $state(false);
  $effect(() => {
    const connected = $apiStatus === 'connected';
    const url = $roverApiUrl;
    const automatic = autoSubscribe;
    const topic = topicName;
    untrack(() => { subscribed = connected && automatic; });
  });
</script>
<section class="space-y-3 rounded-lg border border-border bg-card p-4">
  <header class="flex items-center justify-between"><div><h3 class="font-semibold">{title}</h3><p class="text-xs text-muted-foreground">{topicName}</p></div><button class="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40" disabled={$apiStatus !== 'connected'} onclick={() => subscribed = !subscribed}>{subscribed ? 'Disconnect' : 'Connect'}</button></header>
  <div class="aspect-video bg-black">{#if subscribed}<H264Viewer offerUrl={`${api.getApiBaseUrl()}/api/nav/ros/camera/webrtc/offer?topic_name=${encodeURIComponent(topicName)}`} suspended={$isFullscreen} />{:else}<div class="flex h-full items-center justify-center text-sm text-muted-foreground">ROS camera disconnected</div>{/if}</div>
</section>
