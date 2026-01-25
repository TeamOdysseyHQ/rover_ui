<script lang="ts">
	import { Camera, Power, PowerOff, Image as ImageIcon, RefreshCw, AlertCircle, Wifi, WifiOff, Activity } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	import { VideoStreamClient, type StreamMetrics } from '$lib/services/videoStreamService';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { onMount } from 'svelte';
	
	// Camera state - Svelte 5 runes
	let cameras = $state<any[]>([]);
	let activeCameras = $state<Set<string>>(new Set());
	let loading = $state(false);
	let error = $state<string | null>(null);
	let feedbackMessage = $state('');
	let feedbackType = $state<'success' | 'error'>('success');
	let showFeedback = $state(false);
	
	// Streaming mode per camera: 'mjpeg' or 'websocket'
	let streamingModes = $state<Map<string, 'mjpeg' | 'websocket'>>(new Map());
	
	// WebSocket clients per camera
	let wsClients = $state<Map<string, VideoStreamClient>>(new Map());
	
	// Stream metrics per camera
	let streamMetrics = $state<Map<string, StreamMetrics>>(new Map());
	
	// Canvas refs per camera
	let canvasRefs: Record<string, HTMLCanvasElement | undefined> = $state({});
	
	// Telemetry for captures
	let telemetry = $state({
		latitude: 16.5062,
		longitude: 80.6480,
		altitude: 0,
		battery_level: 85,
		mission_id: 'default',
		rover_id: 'rover_001'
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
	
	// Detect cameras on mount
	async function detectCameras() {
		loading = true;
		error = null;
		
		try {
			const result = await roverApi.detectCameras();
			cameras = result.cameras || [];
			showFeedbackMsg(`Found ${cameras.length} camera(s)`, 'success');
			
			// Initialize streaming mode for each camera (default to WebSocket)
			cameras.forEach(cam => {
				if (!streamingModes.has(cam.name)) {
					streamingModes.set(cam.name, 'websocket');
				}
			});
			streamingModes = new Map(streamingModes);
		} catch (err: any) {
			error = err.message;
			showFeedbackMsg(`Failed to detect cameras: ${err.message}`, 'error');
			cameras = [];
		} finally {
			loading = false;
		}
	}
	
	// Start a camera
	async function startCamera(cameraName: string) {
		try {
			const result = await roverApi.startCamera(cameraName, 1280, 720, 30);
			activeCameras.add(cameraName);
			activeCameras = new Set(activeCameras);
			
			// Start streaming based on mode
			const mode = streamingModes.get(cameraName) || 'websocket';
			if (mode === 'websocket') {
				// Wait for canvas to be rendered before connecting WebSocket
				setTimeout(() => {
					startWebSocketStream(cameraName);
				}, 100);
			}
			
			showFeedbackMsg(`Camera '${cameraName}' started (${mode.toUpperCase()})`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to start camera '${cameraName}': ${err.message}`, 'error');
		}
	}
	
	// Stop a camera
	async function stopCamera(cameraName: string) {
		try {
			// Stop WebSocket if active
			stopWebSocketStream(cameraName);
			
			await roverApi.stopCamera(cameraName);
			activeCameras.delete(cameraName);
			activeCameras = new Set(activeCameras);
			showFeedbackMsg(`Camera '${cameraName}' stopped`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to stop camera '${cameraName}': ${err.message}`, 'error');
		}
	}
	
	// Start WebSocket stream
	function startWebSocketStream(cameraName: string) {
		console.log(`[CameraPanel] Starting WebSocket stream for camera '${cameraName}'`);
		
		// Get or create canvas
		const canvas = canvasRefs[cameraName];
		if (!canvas) {
			console.error(`[CameraPanel] Canvas not found for camera '${cameraName}'`);
			console.error(`[CameraPanel] Available canvas refs:`, Object.keys(canvasRefs));
			showFeedbackMsg(`Failed to start WebSocket: Canvas element not ready`, 'error');
			return;
		}
		
		console.log(`[CameraPanel] Canvas found for camera '${cameraName}':`, canvas);
		
		// Create WebSocket client
		const client = new VideoStreamClient({
			quality: 85,
			fps: 30,
			autoReconnect: true
		});
		
		// Setup callbacks
		client.onMetrics((metrics) => {
			streamMetrics.set(cameraName, metrics);
			streamMetrics = new Map(streamMetrics);
		});
		
		client.onStateChange((state) => {
			console.log(`[CameraPanel] Camera '${cameraName}' state: ${state}`);
		});
		
		client.onError((error) => {
			console.error(`[CameraPanel] Camera '${cameraName}' error:`, error);
			showFeedbackMsg(`Stream error: ${error.message}`, 'error');
		});
		
		// Connect
		console.log(`[CameraPanel] Connecting WebSocket for camera '${cameraName}'...`);
		client.connect(cameraName, canvas).catch((error) => {
			console.error(`[CameraPanel] Failed to connect WebSocket:`, error);
			showFeedbackMsg(`Failed to connect WebSocket: ${error.message}`, 'error');
		});
		
		wsClients.set(cameraName, client);
		wsClients = new Map(wsClients);
		console.log(`[CameraPanel] WebSocket client created for camera '${cameraName}'`);
	}
	
	// Stop WebSocket stream
	function stopWebSocketStream(cameraName: string) {
		const client = wsClients.get(cameraName);
		if (client) {
			client.disconnect();
			wsClients.delete(cameraName);
			wsClients = new Map(wsClients);
			streamMetrics.delete(cameraName);
			streamMetrics = new Map(streamMetrics);
		}
	}
	
	// Toggle streaming mode
	function toggleStreamingMode(cameraName: string) {
		const currentMode = streamingModes.get(cameraName) || 'websocket';
		const newMode = currentMode === 'mjpeg' ? 'websocket' : 'mjpeg';
		
		// If camera is active, restart with new mode
		if (activeCameras.has(cameraName)) {
			if (currentMode === 'websocket') {
				stopWebSocketStream(cameraName);
			}
			if (newMode === 'websocket') {
				startWebSocketStream(cameraName);
			}
		}
		
		streamingModes.set(cameraName, newMode);
		streamingModes = new Map(streamingModes);
		showFeedbackMsg(`Switched to ${newMode.toUpperCase()} mode`, 'success');
	}
	
	// Capture image from camera
	async function captureImage(cameraName: string) {
		try {
			const result = await roverApi.captureCameraImage(cameraName, telemetry);
			showFeedbackMsg(`Image captured: ${result.saved} (${result.file_size_mb} MB)`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to capture image: ${err.message}`, 'error');
		}
	}
	
	// Stop all cameras
	async function stopAllCameras() {
		try {
			// Stop all WebSocket streams
			wsClients.forEach((client, index) => {
				client.disconnect();
			});
			wsClients.clear();
			wsClients = new Map(wsClients);
			
			await roverApi.stopAllCameras();
			activeCameras.clear();
			activeCameras = new Set(activeCameras);
			showFeedbackMsg('All cameras stopped', 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to stop cameras: ${err.message}`, 'error');
		}
	}
	
	// Get camera stream URL (MJPEG)
	function getStreamUrl(cameraName: string) {
		return roverApi.getCameraStreamUrl(cameraName);
	}
	
	// Get metrics for camera
	function getMetrics(cameraName: string): StreamMetrics | null {
		return streamMetrics.get(cameraName) || null;
	}
	
	// Lifecycle - using $effect instead of onMount/onDestroy
	$effect(() => {
		if ($apiStatus === 'connected') {
			detectCameras();
		}
		
		// Cleanup on destroy
		return () => {
			if (activeCameras.size > 0) {
				stopAllCameras();
			}
		};
	});
</script>

<div class="space-y-4">
	<!-- Feedback Message -->
	{#if showFeedback}
	<div class="p-3 rounded-lg flex items-center gap-2 text-sm border {feedbackType === 'success' ? 'bg-green-900/50 border-green-500' : 'bg-destructive/50 border-destructive'}">
		<AlertCircle class="w-4 h-4" />
		<p class="flex-grow">{feedbackMessage}</p>
		<button onclick={() => showFeedback = false} class="text-muted-foreground hover:text-foreground">✕</button>
	</div>
	{/if}
	
	<!-- Controls -->
	<Card.Root class="bg-card border-border">
		<Card.Header class="border-b border-border flex-row justify-between items-center">
			<Card.Title class="flex items-center gap-2">
				<Camera class="w-5 h-5 text-primary" />
				Camera Control
			</Card.Title>
			<div class="flex gap-2">
				<Button 
					variant="secondary"
					size="sm"
					onclick={detectCameras}
					disabled={loading || $apiStatus !== 'connected'}
				>
					<RefreshCw class="w-4 h-4 mr-1" />
					Detect
				</Button>
				{#if activeCameras.size > 0}
				<Button 
					variant="secondary"
					size="sm"
					onclick={stopAllCameras}
					disabled={$apiStatus !== 'connected'}
				>
					<PowerOff class="w-4 h-4 mr-1" />
					Stop All
				</Button>
				{/if}
			</div>
		</Card.Header>
		
		<Card.Content class="">
			<!-- Loading State -->
			{#if loading}
			<div class="text-center py-8 text-muted-foreground">
				<RefreshCw class="w-8 h-8 mx-auto mb-2 animate-spin" />
				<p>Detecting cameras...</p>
			</div>
			
			<!-- No Cameras -->
			{:else if cameras.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<Camera class="w-8 h-8 mx-auto mb-2 opacity-50" />
				<p>No cameras detected</p>
				<Button 
					variant="default"
					size="sm"
					class="mt-4"
					onclick={detectCameras}
					disabled={$apiStatus !== 'connected'}
				>
					Scan for Cameras
				</Button>
			</div>
			
			<!-- Camera Grid -->
			{:else}
			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				{#each cameras.filter(cam => cam.name !== 'microscope') as camera}
				{@const mode = streamingModes.get(camera.name) || 'websocket'}
				{@const metrics = getMetrics(camera.name)}
				<div class="bg-secondary rounded-lg border border-border overflow-hidden">
					<!-- Camera Header -->
					<div class="p-3 bg-card border-b border-border flex justify-between items-center">
						<div>
							<h3 class="font-semibold text-foreground">{camera.name}</h3>
							<p class="text-xs text-muted-foreground">
								{camera.default_resolution} @ {camera.default_fps}fps | {camera.backend}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if activeCameras.has(camera.name)}
							<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
							<Badge variant="success" class="text-xs">Active</Badge>
							{:else}
							<span class="w-2 h-2 bg-muted rounded-full"></span>
							<Badge variant="secondary" class="text-xs">Inactive</Badge>
							{/if}
						</div>
					</div>
					
					<!-- Stream Mode Selector -->
					<div class="px-3 py-2 bg-card/50 border-b border-border flex items-center justify-between">
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							{#if mode === 'websocket'}
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
							onclick={() => toggleStreamingMode(camera.name)}
							disabled={activeCameras.has(camera.name)}
							class="h-6 text-xs"
						>
							Switch
						</Button>
					</div>
					
					<!-- Performance Metrics (WebSocket only) -->
					{#if activeCameras.has(camera.name) && mode === 'websocket' && metrics}
					<div class="px-3 py-1.5 bg-black/30 border-b border-border flex items-center justify-between text-xs font-mono">
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
					
					<!-- Camera Stream or Placeholder -->
					<div class="relative bg-black aspect-video">
						{#if activeCameras.has(camera.name)}
							{#if mode === 'websocket'}
							<!-- WebSocket Canvas -->
							<canvas
								bind:this={canvasRefs[camera.name]}
								width="1280"
								height="720"
								class="w-full h-full object-contain"
							></canvas>
							<div class="absolute top-2 left-2 bg-sky-500 text-white text-xs px-2 py-1 rounded font-mono flex items-center gap-1">
								<Wifi class="w-3 h-3" />
								LIVE WS
							</div>
							{:else}
							<!-- MJPEG Image -->
							<img 
								src={getStreamUrl(camera.name)}
								alt="{camera.name} Stream"
								class="w-full h-full object-contain"
							/>
							<div class="absolute top-2 left-2 bg-destructive text-white text-xs px-2 py-1 rounded font-mono">
								LIVE MJPEG
							</div>
							{/if}
						{:else}
						<div class="flex items-center justify-center h-full text-muted">
							<div class="text-center">
								<Camera class="w-16 h-16 mx-auto mb-2 opacity-30" />
								<p class="text-sm">Camera Offline</p>
							</div>
						</div>
						{/if}
					</div>
					
					<!-- Camera Controls -->
					<div class="p-3 bg-card border-t border-border">
						<div class="flex gap-2">
							{#if activeCameras.has(camera.name)}
							<Button 
								variant="secondary"
								size="sm"
								class="flex-1"
								onclick={() => captureImage(camera.name)}
								disabled={$apiStatus !== 'connected'}
							>
								<ImageIcon class="w-4 h-4 mr-1" />
								Capture
							</Button>
							<Button 
								variant="secondary"
								size="sm"
								onclick={() => stopCamera(camera.name)}
								disabled={$apiStatus !== 'connected'}
							>
								<PowerOff class="w-4 h-4" />
							</Button>
							{:else}
							<Button 
								variant="default"
								size="sm"
								class="flex-1"
								onclick={() => startCamera(camera.name)}
								disabled={$apiStatus !== 'connected'}
							>
								<Power class="w-4 h-4 mr-1" />
								Start Camera
							</Button>
							{/if}
						</div>
					</div>
				</div>
				{/each}
			</div>
			{/if}
		</Card.Content>
	</Card.Root>
	
	<!-- Telemetry Settings -->
	{#if cameras.length > 0}
	<Card.Root class="bg-card border-border">
		<Card.Header class="border-b border-border">
			<Card.Title>Capture Telemetry</Card.Title>
			<p class="text-xs text-muted-foreground mt-1">Metadata attached to captured images</p>
		</Card.Header>
		<Card.Content class="">
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
				<div>
					<label for="latitude" class="text-xs text-muted-foreground block mb-1">Latitude</label>
					<input 
						id="latitude"
						type="number" 
						bind:value={telemetry.latitude}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
						step="0.0001"
					/>
				</div>
				<div>
					<label for="longitude" class="text-xs text-muted-foreground block mb-1">Longitude</label>
					<input 
						id="longitude"
						type="number" 
						bind:value={telemetry.longitude}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
						step="0.0001"
					/>
				</div>
				<div>
					<label for="altitude" class="text-xs text-muted-foreground block mb-1">Altitude (m)</label>
					<input 
						id="altitude"
						type="number" 
						bind:value={telemetry.altitude}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="battery" class="text-xs text-muted-foreground block mb-1">Battery (%)</label>
					<input 
						id="battery"
						type="number" 
						bind:value={telemetry.battery_level}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
						min="0"
						max="100"
					/>
				</div>
				<div>
					<label for="mission" class="text-xs text-muted-foreground block mb-1">Mission ID</label>
					<input 
						id="mission"
						type="text" 
						bind:value={telemetry.mission_id}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="rover" class="text-xs text-muted-foreground block mb-1">Rover ID</label>
					<input 
						id="rover"
						type="text" 
						bind:value={telemetry.rover_id}
						class="w-full bg-secondary border border-border rounded-md px-2 py-1 text-sm text-foreground"
					/>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
	{/if}
</div>
