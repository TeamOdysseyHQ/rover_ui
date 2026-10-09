<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
	import { pollEvery } from '$lib/services/polling.js';
	import * as api from '$lib/services/roverApi.js';
	import { VideoStreamClient, WebRtcStreamClient, type StreamMetrics } from '$lib/services/videoStreamService';
	import { cn } from '$lib/utils';

	// Props
	interface Props {
		topicName?: string;
		title?: string;
		autoSubscribe?: boolean;
	}

	let {
		topicName = '/camera/camera/color/image_raw',
		title = 'ROS Camera Feed',
		autoSubscribe = true
	}: Props = $props();

	// Streaming mode state
	type StreamMode = 'mjpeg' | 'websocket' | 'webrtc';
	let streamingMode = $state<StreamMode>('webrtc');

	// Subscription / connection state
	let isSubscribed = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// MJPEG
	let imgSrc = $state<string>('');
	let imgElement = $state<HTMLImageElement | null>(null);
	let mjpegFps = $state(30);
	let mjpegQuality = $state(80);
	let mjpegDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// WebSocket
	let wsClient = $state<VideoStreamClient | null>(null);
	let canvasRef = $state<HTMLCanvasElement | undefined>();
	let metrics = $state<StreamMetrics | null>(null);

	// WebRTC
	let webrtcClient = $state<WebRtcStreamClient | null>(null);
	let videoRef = $state<HTMLVideoElement | undefined>();
	let webrtcStatus = $state<{ active_connections: number; max_connections: number } | null>(null);
	let webrtcStatusInterval: (() => void) | null = null;
	let webrtcRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let webrtcRetryCount = 0;
	let mounted = false;
	let lifecycleEpoch = 0;
	let rtcState = $state('disconnected');
	let rtcFps = $state(0);

	// ─── helpers ──────────────────────────────────────────────────────────────

	function getMjpegUrl() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return api.getRosCameraStreamUrl(topicName as any, mjpegFps, mjpegQuality);
	}

	function handleMjpegParamChange() {
		if (mjpegDebounceTimer) clearTimeout(mjpegDebounceTimer);
		mjpegDebounceTimer = setTimeout(() => {
			if (isSubscribed && streamingMode === 'mjpeg') {
				imgSrc = getMjpegUrl();
			}
		}, 300);
	}

	// ─── WebSocket ────────────────────────────────────────────────────────────

	function startWebSocketStream() {
		if (!mounted || !isSubscribed || streamingMode !== 'websocket' || wsClient) return;
		if (!canvasRef) { error = 'Canvas element not ready'; return; }
		const client = new VideoStreamClient({ quality: 85, fps: 30, autoReconnect: true });
		client.onMetrics((m) => { if (wsClient === client) metrics = m; });
		client.onStateChange((s) => console.log(`[RosCameraPanel] WS state: ${s}`));
		client.onError((e) => { if (wsClient === client) error = `WebSocket error: ${e.message}`; });
		const wsUrl = api.getRosCameraWebSocketUrl(85, 30);
		client.connectCustom(wsUrl, canvasRef).catch((e) => { if (wsClient === client) error = `Failed to connect WebSocket: ${e.message}`; });
		wsClient = client;
	}

	function stopWebSocketStream() {
		if (wsClient) { wsClient.disconnect(); wsClient = null; metrics = null; }
	}

	// ─── WebRTC ───────────────────────────────────────────────────────────────

	function startWebRtcStream() {
		if (!mounted || !isSubscribed || streamingMode !== 'webrtc' || webrtcClient) return;
		if (!videoRef) { error = 'Video element not ready'; return; }
		if (webrtcRetryTimer) { clearTimeout(webrtcRetryTimer); webrtcRetryTimer = null; }

		const client = new WebRtcStreamClient();
		webrtcClient = client;
		rtcState = 'connecting';
		rtcFps = 0;
		client.onStateChange((s) => { if (webrtcClient === client) { rtcState = s; if (s !== 'connected') rtcFps = 0; } });
		client.onMetrics(m => { if (webrtcClient === client) rtcFps = m.fps; });
		client.onError(e => handleWebRtcFailure(client, e));

		const offerUrl = `${api.getApiBaseUrl()}/api/nav/ros/camera/webrtc/offer`;
		client.connect(offerUrl, videoRef).then(() => {
			if (webrtcClient !== client) return;
			webrtcRetryCount = 0;
			startWebRtcStatusPolling();
		}).catch(err => handleWebRtcFailure(client, err));
	}

	function handleWebRtcFailure(client: WebRtcStreamClient, err: Error & { status?: number }) {
			if (err.name === 'AbortError' || webrtcClient !== client || !mounted) return;
			webrtcClient = null;
			rtcState = 'error';
			rtcFps = 0;
			stopWebRtcStatusPolling();
			void client.disconnect().catch(() => {});
			if (err.status === 429) {
				error = 'Too many viewers — falling back to MJPEG';
				setStreamingMode('mjpeg');
			} else if (err.status === 503) {
				error = 'ROS not connected';
			} else if (err.status === 500 || !err.status) {
				webrtcRetryCount++;
				if (webrtcRetryCount <= 5) {
					const delay = Math.min(5000 * Math.pow(2, webrtcRetryCount - 1), 60000);
					error = `${err.message}. Retrying in ${delay / 1000}s`;
					webrtcRetryTimer = setTimeout(() => {
						webrtcRetryTimer = null;
						if (mounted && isSubscribed && streamingMode === 'webrtc') startWebRtcStream();
					}, delay);
				} else {
					error = 'WebRTC failed — falling back to MJPEG';
					setStreamingMode('mjpeg');
				}
			} else {
				error = err.message;
			}
	}

	async function stopWebRtcStream() {
		if (webrtcRetryTimer) clearTimeout(webrtcRetryTimer);
		webrtcRetryTimer = null;
		webrtcRetryCount = 0;
		const client = webrtcClient;
		webrtcClient = null;
		rtcState = 'disconnected';
		rtcFps = 0;
		stopWebRtcStatusPolling();
		webrtcStatus = null;
		await client?.disconnect();
	}

	function startWebRtcStatusPolling() {
		stopWebRtcStatusPolling();
		webrtcStatusInterval = pollEvery(async signal => {
			try {
				const st = await api.getRosCameraWebRtcStatus(signal);
				if (signal.aborted || !mounted) return;
				webrtcStatus = { active_connections: st.active_connections, max_connections: st.max_connections ?? 5 };
				// Capacity limits new offers, not viewers already connected.
			} catch { /* ignore */ }
		}, 5000);
	}

	function stopWebRtcStatusPolling() {
		if (webrtcStatusInterval) { webrtcStatusInterval(); webrtcStatusInterval = null; }
	}

	// ─── subscribe / unsubscribe ───────────────────────────────────────────────

	async function subscribe() {
		if (!mounted || isLoading || isSubscribed) return;
		const epoch = lifecycleEpoch;
		isLoading = true;
		error = null;
		try {
			const response = await api.subscribeToRosCamera(topicName);
			if (!mounted || epoch !== lifecycleEpoch) return;
			if (!response.success) {
				error = response.message || 'Failed to subscribe to camera topic';
				return;
			}
			isSubscribed = true;
			await tick();
			if (!mounted || epoch !== lifecycleEpoch) return;
			if (streamingMode === 'mjpeg') {
				imgSrc = getMjpegUrl();
			} else if (streamingMode === 'websocket') {
				startWebSocketStream();
			} else {
				startWebRtcStream();
			}
		} catch (err) {
			if (!mounted || epoch !== lifecycleEpoch) return;
			console.error('Error subscribing to ROS camera:', err);
			error = err instanceof Error ? err.message : 'Failed to subscribe';
		} finally {
			if (epoch === lifecycleEpoch) isLoading = false;
		}
	}

	function releaseLocalStreams() {
		lifecycleEpoch++;
		isSubscribed = false;
		isLoading = false;
		imgSrc = '';
		if (mjpegDebounceTimer) clearTimeout(mjpegDebounceTimer);
		stopWebSocketStream();
		return stopWebRtcStream();
	}

	async function unsubscribe() {
		await releaseLocalStreams();
		try { await api.unsubscribeFromRosCamera(topicName); } catch { /* ignore */ }
	}

	async function setStreamingMode(newMode: StreamMode) {
		if (newMode === streamingMode) return;
		if (isSubscribed) {
			if (streamingMode === 'websocket') stopWebSocketStream();
			if (streamingMode === 'webrtc') await stopWebRtcStream();
		}
		streamingMode = newMode;
		await tick();
		if (isSubscribed) {
			if (newMode === 'mjpeg') imgSrc = getMjpegUrl();
			else if (newMode === 'websocket') startWebSocketStream();
			else startWebRtcStream();
		}
	}

	// ─── lifecycle ────────────────────────────────────────────────────────────

	$effect(() => {
		const url = $roverApiUrl;
		const connected = $apiStatus === 'connected';
		if (connected) untrack(() => { if (mounted && autoSubscribe) void subscribe(); });
		else untrack(() => { void releaseLocalStreams(); });
		return () => untrack(() => { void releaseLocalStreams(); });
	});

	onMount(() => {
		mounted = true;
		if (autoSubscribe && $apiStatus === 'connected') void subscribe();
		const handleUnload = () => {
			if (webrtcClient) {
				webrtcClient.disconnect(`${api.getApiBaseUrl()}/api/nav/ros/camera/webrtc`).catch(() => {});
			}
		};
		window.addEventListener('beforeunload', handleUnload);
		return () => {
			mounted = false;
			window.removeEventListener('beforeunload', handleUnload);
			void releaseLocalStreams();
		};
	});
</script>

<div class="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
	<!-- Header -->
	<div class="flex items-center justify-between gap-2 flex-wrap">
		<div>
			<h3 class="text-lg font-medium text-white">{title}</h3>
			<p class="text-sm text-slate-400">{topicName}</p>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<!-- Streaming mode selector -->
			<div class="flex rounded-md overflow-hidden border border-slate-700 text-xs">
				<button
					onclick={() => setStreamingMode('mjpeg')}
					class={cn('px-2 py-1 transition-colors', streamingMode === 'mjpeg' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
				>MJPEG</button>
				<button
					onclick={() => setStreamingMode('websocket')}
					class={cn('px-2 py-1 border-l border-slate-700 transition-colors', streamingMode === 'websocket' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
				>WebSocket</button>
				<button
					onclick={() => setStreamingMode('webrtc')}
					class={cn('px-2 py-1 border-l border-slate-700 transition-colors', streamingMode === 'webrtc' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
				>WebRTC</button>
			</div>

			{#if isSubscribed}
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-green-500"></div>
					<span class="text-sm text-green-500">Streaming</span>
				</div>
				<button
					onclick={unsubscribe}
					class="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
				>
					Stop
				</button>
			{:else}
				<button
					onclick={subscribe}
					disabled={isLoading}
					class={cn(
						'rounded px-3 py-1.5 text-sm font-medium text-white transition-colors',
						isLoading ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-sky-600 hover:bg-sky-500'
					)}
				>
					{isLoading ? 'Connecting...' : 'Start Stream'}
				</button>
			{/if}
		</div>
	</div>

	<!-- WebRTC status badge -->
	{#if streamingMode === 'webrtc' && webrtcStatus}
		{#if webrtcStatus.active_connections >= webrtcStatus.max_connections}
			<div class="rounded bg-red-900/40 border border-red-700 px-3 py-1.5 text-xs text-red-400">
				Full — WebRTC unavailable ({webrtcStatus.active_connections}/{webrtcStatus.max_connections})
			</div>
		{:else}
			<div class="rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-400">
				{webrtcStatus.active_connections}/{webrtcStatus.max_connections} connected
			</div>
		{/if}
	{/if}

	<!-- WebSocket metrics -->
	{#if isSubscribed && streamingMode === 'websocket' && metrics}
	<div class="flex items-center gap-4 rounded bg-black/30 border border-slate-700 px-3 py-1.5 text-xs font-mono text-slate-400">
		<span>FPS: <span class="text-sky-400">{metrics.fps.toFixed(1)}</span></span>
		<span>Latency: <span class="text-sky-400">{metrics.avgLatencyMs.toFixed(0)}ms</span></span>
		<span>Frames: <span class="text-sky-400">{metrics.framesReceived}</span></span>
		<span class="ml-auto">{metrics.connected ? '🟢' : '🔴'}</span>
	</div>
	{/if}

	<!-- MJPEG fps/quality sliders -->
	{#if streamingMode === 'mjpeg'}
	<div class="space-y-1.5 rounded bg-slate-800 border border-slate-700 px-3 py-2">
		<div class="flex items-center gap-2 text-xs">
			<span class="w-20 text-slate-400">FPS: <span class="text-white">{mjpegFps}</span></span>
			<input type="range" min="1" max="60" bind:value={mjpegFps}
				class="flex-1 h-1 accent-sky-500"
				oninput={handleMjpegParamChange} />
		</div>
		<div class="flex items-center gap-2 text-xs">
			<span class="w-20 text-slate-400">Quality: <span class="text-white">{mjpegQuality}</span></span>
			<input type="range" min="10" max="100" bind:value={mjpegQuality}
				class="flex-1 h-1 accent-sky-500"
				oninput={handleMjpegParamChange} />
		</div>
	</div>
	{/if}

	<!-- Error Message -->
	{#if error}
		<div class="rounded bg-red-900/20 border border-red-800 p-3">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{/if}

	<!-- Video Stream -->
	<div class="relative aspect-video w-full overflow-hidden rounded border border-slate-800 bg-black">
		{#if isSubscribed}
			{#if streamingMode === 'mjpeg' && imgSrc}
				<img
					bind:this={imgElement}
					src={imgSrc}
					alt="ROS Camera Feed"
					class="h-full w-full object-contain"
				/>
				<div class="absolute top-2 left-2 bg-red-700 text-white text-xs px-2 py-1 rounded font-mono">
					MJPEG stream
				</div>
			{:else if streamingMode === 'websocket'}
				<canvas
					bind:this={canvasRef}
					width="1280"
					height="720"
					class="h-full w-full object-contain"
				></canvas>
				<div class="absolute top-2 left-2 bg-sky-600 text-white text-xs px-2 py-1 rounded font-mono">
					{metrics?.connected && metrics.fps > 0 ? 'LIVE WS' : 'WS · waiting for frames'}
				</div>
			{:else if streamingMode === 'webrtc'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={videoRef}
					autoplay
					playsinline
					muted
					class="h-full w-full object-contain"
				></video>
				<div class="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded font-mono">
					{rtcState === 'connected' && rtcFps > 0 ? `LIVE WebRTC · ${rtcFps.toFixed(1)} FPS` : `WebRTC · ${rtcState === 'connected' ? 'waiting for frames' : rtcState}`}
				</div>
			{/if}
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<svg
						class="mx-auto mb-4 h-16 w-16 text-slate-700"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
						></path>
					</svg>
					<p class="text-sm text-slate-400">
						{isLoading ? 'Connecting to camera...' : 'Camera not streaming'}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Info -->
	<div class="flex items-center justify-between text-xs text-slate-500">
		<span>ROS2 Image Topic</span>
		<span>{streamingMode.toUpperCase()} Stream</span>
	</div>
</div>
