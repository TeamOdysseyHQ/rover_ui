<script lang="ts">
	import { Microscope, Power, PowerOff, Camera, Wifi, WifiOff, Activity, AlertCircle } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	import { VideoStreamClient, type StreamMetrics } from '$lib/services/videoStreamService';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	// Props
	let { 
		microscopeActive = $bindable(false) 
	}: { 
		microscopeActive?: boolean 
	} = $props();
	
	// Microscope state
	let loading = $state(false);
	let error = $state<string | null>(null);
	let feedbackMessage = $state('');
	let feedbackType = $state<'success' | 'error'>('success');
	let showFeedback = $state(false);
	
	// Streaming mode: 'mjpeg' or 'websocket'
	let streamingMode = $state<'mjpeg' | 'websocket'>('websocket');
	
	// WebSocket client
	let wsClient = $state<VideoStreamClient | null>(null);
	
	// Stream metrics
	let metrics = $state<StreamMetrics | null>(null);
	
	// Canvas ref
	let canvasRef = $state<HTMLCanvasElement | undefined>();
	
	// Telemetry for captures
	let telemetry = $state({
		latitude: 16.5062,
		longitude: 80.6480,
		altitude: 0,
		battery_level: 85,
		mission_id: 'default',
		rover_id: 'rover_001',
		note: ''
	});
	
	// Show feedback messages
	function showFeedbackMsg(message: string, type: 'success' | 'error' = 'success') {
		feedbackMessage = message;
		feedbackType = type;
		showFeedback = true;
		
		setTimeout(() => {
			showFeedback = false;
		}, 5000);
	}
	
	// Start microscope
	async function startMicroscope() {
		loading = true;
		try {
			const result = await roverApi.startMicroscope();
			microscopeActive = true;
			
			// Start streaming based on mode
			if (streamingMode === 'websocket') {
				setTimeout(() => {
					startWebSocketStream();
				}, 100);
			}
			
			showFeedbackMsg(`Microscope started (${streamingMode.toUpperCase()})`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to start microscope: ${err.message}`, 'error');
		} finally {
			loading = false;
		}
	}
	
	// Stop microscope
	async function stopMicroscope() {
		try {
			// Stop WebSocket if active
			stopWebSocketStream();
			
			await roverApi.stopMicroscope();
			microscopeActive = false;
			showFeedbackMsg('Microscope stopped', 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to stop microscope: ${err.message}`, 'error');
		}
	}
	
	// Start WebSocket stream
	function startWebSocketStream() {
		console.log('[MicroscopePanel] Starting WebSocket stream');
		
		const canvas = canvasRef;
		if (!canvas) {
			console.error('[MicroscopePanel] Canvas not found');
			showFeedbackMsg('Failed to start WebSocket: Canvas element not ready', 'error');
			return;
		}
		
		// Create WebSocket client
		const client = new VideoStreamClient({
			quality: 85,
			fps: 30,
			autoReconnect: true
		});
		
		// Setup callbacks
		client.onMetrics((m) => {
			metrics = m;
		});
		
		client.onStateChange((state) => {
			console.log(`[MicroscopePanel] State: ${state}`);
		});
		
		client.onError((error) => {
			console.error(`[MicroscopePanel] Error:`, error);
			showFeedbackMsg(`Stream error: ${error.message}`, 'error');
		});
		
		// Connect with custom URL for microscope
		const baseUrl = roverApi.getApiBaseUrl().replace('http', 'ws');
		const wsUrl = `${baseUrl}/api/sci/microscope/stream/ws`;
		
		client.connectCustom(wsUrl, canvas).catch((error) => {
			console.error('[MicroscopePanel] Failed to connect WebSocket:', error);
			showFeedbackMsg(`Failed to connect WebSocket: ${error.message}`, 'error');
		});
		
		wsClient = client;
	}
	
	// Stop WebSocket stream
	function stopWebSocketStream() {
		if (wsClient) {
			wsClient.disconnect();
			wsClient = null;
			metrics = null;
		}
	}
	
	// Toggle streaming mode
	function toggleStreamingMode() {
		const newMode = streamingMode === 'mjpeg' ? 'websocket' : 'mjpeg';
		
		// If microscope is active, restart with new mode
		if (microscopeActive) {
			if (streamingMode === 'websocket') {
				stopWebSocketStream();
			}
			if (newMode === 'websocket') {
				startWebSocketStream();
			}
		}
		
		streamingMode = newMode;
		showFeedbackMsg(`Switched to ${newMode.toUpperCase()} mode`, 'success');
	}
	
	// Capture image
	async function captureImage() {
		try {
			const result = await roverApi.captureMicroscopeImage(telemetry);
			showFeedbackMsg(`Image captured: ${result.saved} (${result.file_size_mb} MB)`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to capture image: ${err.message}`, 'error');
		}
	}
	
	// Get microscope stream URL (MJPEG)
	function getStreamUrl() {
		return roverApi.getMicroscopeStreamUrl();
	}
	
	// Cleanup on destroy
	$effect(() => {
		return () => {
			if (microscopeActive) {
				stopMicroscope();
			}
		};
	});
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Microscope class="w-5 h-5 text-primary" />
				<Card.Title>Microscope</Card.Title>
			</div>
			<div class="flex items-center gap-2">
				{#if microscopeActive}
					<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
					<Badge variant="success" class="text-xs">Active</Badge>
				{:else}
					<span class="w-2 h-2 bg-muted rounded-full"></span>
					<Badge variant="secondary" class="text-xs">Inactive</Badge>
				{/if}
			</div>
		</div>
	</Card.Header>
	
	<Card.Content class="space-y-4 pt-4">
		<!-- Feedback Message -->
		{#if showFeedback}
		<div class="p-3 rounded-lg flex items-center gap-2 text-sm border {feedbackType === 'success' ? 'bg-green-900/50 border-green-500' : 'bg-destructive/50 border-destructive'}">
			<AlertCircle class="w-4 h-4" />
			<p class="flex-grow">{feedbackMessage}</p>
			<button onclick={() => showFeedback = false} class="text-muted-foreground hover:text-foreground">✕</button>
		</div>
		{/if}
		
		<!-- Stream Mode Selector -->
		{#if !microscopeActive}
		<div class="px-3 py-2 bg-secondary rounded-lg border border-border flex items-center justify-between">
			<div class="flex items-center gap-2 text-xs text-muted-foreground">
				{#if streamingMode === 'websocket'}
				<Wifi class="w-3 h-3 text-sky-500" />
				<span class="text-sky-500 font-medium">WebSocket</span>
				<span class="text-muted-foreground">Low Latency</span>
				{:else}
				<Activity class="w-3 h-3" />
				<span>MJPEG</span>
				<span class="text-muted-foreground">Compatible</span>
				{/if}
			</div>
			<Button 
				variant="ghost"
				size="sm"
				onclick={toggleStreamingMode}
				class="h-6 text-xs"
			>
				Switch
			</Button>
		</div>
		{/if}
		
		<!-- Performance Metrics (WebSocket only) -->
		{#if microscopeActive && streamingMode === 'websocket' && metrics}
		<div class="px-3 py-1.5 bg-black/30 border border-border rounded-lg flex items-center justify-between text-xs font-mono">
			<div class="flex items-center gap-3">
				<span class="text-muted-foreground">FPS: <span class="text-sky-500">{metrics.fps.toFixed(1)}</span></span>
				<span class="text-muted-foreground">Latency: <span class="text-sky-500">{metrics.avgLatencyMs.toFixed(0)}ms</span></span>
				<span class="text-muted-foreground">Frames: <span class="text-sky-500">{metrics.framesReceived}</span></span>
			</div>
			{#if metrics.connected}
			<Wifi class="w-3 h-3 text-green-500" />
			{:else}
			<WifiOff class="w-3 h-3 text-destructive" />
			{/if}
		</div>
		{/if}
		
		<!-- Video Display -->
		<div class="relative bg-black rounded-lg overflow-hidden" style="aspect-ratio: 4/3;">
			{#if microscopeActive}
				{#if streamingMode === 'websocket'}
				<!-- WebSocket Canvas -->
				<canvas
					bind:this={canvasRef}
					width="640"
					height="480"
					class="w-full h-full object-contain"
				></canvas>
				<div class="absolute top-2 left-2 bg-sky-500 text-white text-xs px-2 py-1 rounded font-mono flex items-center gap-1">
					<Wifi class="w-3 h-3" />
					LIVE WS
				</div>
				{:else}
				<!-- MJPEG Image -->
				<img 
					src={getStreamUrl()}
					alt="Microscope Stream"
					class="w-full h-full object-contain"
				/>
				<div class="absolute top-2 left-2 bg-destructive text-white text-xs px-2 py-1 rounded font-mono">
					LIVE MJPEG
				</div>
				{/if}
			{:else}
			<div class="flex items-center justify-center h-full text-muted">
				<div class="text-center">
					<Microscope class="w-16 h-16 mx-auto mb-2 opacity-30" />
					<p class="text-sm">Microscope Offline</p>
				</div>
			</div>
			{/if}
		</div>
		
		<!-- Controls -->
		<div class="flex gap-2">
			{#if microscopeActive}
			<Button 
				variant="secondary"
				size="sm"
				class="flex-1"
				onclick={captureImage}
				disabled={$apiStatus !== 'connected'}
			>
				<Camera class="w-4 h-4 mr-1" />
				Capture
			</Button>
			<Button 
				variant="secondary"
				size="sm"
				onclick={stopMicroscope}
				disabled={$apiStatus !== 'connected' || loading}
			>
				<PowerOff class="w-4 h-4" />
			</Button>
			{:else}
			<Button 
				variant="default"
				size="sm"
				class="flex-1"
				onclick={startMicroscope}
				disabled={$apiStatus !== 'connected' || loading}
			>
				<Power class="w-4 h-4 mr-1" />
				Start Microscope
			</Button>
			{/if}
		</div>
		
		<!-- Telemetry (collapsed by default) -->
		<details class="bg-secondary rounded-lg border border-border">
			<summary class="px-3 py-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
				Capture Settings
			</summary>
			<div class="p-3 space-y-2 border-t border-border">
				<div class="grid grid-cols-2 gap-2">
					<div>
						<label class="text-xs text-muted-foreground block mb-1">Latitude</label>
						<input 
							type="number" 
							bind:value={telemetry.latitude}
							class="w-full bg-background border border-border rounded px-2 py-1 text-sm"
							step="0.0001"
						/>
					</div>
					<div>
						<label class="text-xs text-muted-foreground block mb-1">Longitude</label>
						<input 
							type="number" 
							bind:value={telemetry.longitude}
							class="w-full bg-background border border-border rounded px-2 py-1 text-sm"
							step="0.0001"
						/>
					</div>
					<div>
						<label class="text-xs text-muted-foreground block mb-1">Battery (%)</label>
						<input 
							type="number" 
							bind:value={telemetry.battery_level}
							class="w-full bg-background border border-border rounded px-2 py-1 text-sm"
							min="0"
							max="100"
						/>
					</div>
					<div>
						<label class="text-xs text-muted-foreground block mb-1">Mission ID</label>
						<input 
							type="text" 
							bind:value={telemetry.mission_id}
							class="w-full bg-background border border-border rounded px-2 py-1 text-sm"
						/>
					</div>
				</div>
				<div>
					<label class="text-xs text-muted-foreground block mb-1">Note</label>
					<input 
						type="text" 
						bind:value={telemetry.note}
						class="w-full bg-background border border-border rounded px-2 py-1 text-sm"
						placeholder="Optional capture note..."
					/>
				</div>
			</div>
		</details>
	</Card.Content>
</Card.Root>
