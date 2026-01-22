<script lang="ts">
	import { Camera, Power, PowerOff, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	// Camera state - Svelte 5 runes
	let cameras = $state<any[]>([]);
	let activeCameras = $state<Set<number>>(new Set());
	let loading = $state(false);
	let error = $state<string | null>(null);
	let feedbackMessage = $state('');
	let feedbackType = $state<'success' | 'error'>('success');
	let showFeedback = $state(false);
	
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
		} catch (err: any) {
			error = err.message;
			showFeedbackMsg(`Failed to detect cameras: ${err.message}`, 'error');
			cameras = [];
		} finally {
			loading = false;
		}
	}
	
	// Start a camera
	async function startCamera(cameraIndex: number) {
		try {
			const result = await roverApi.startCamera(cameraIndex, 1280, 720, 30);
			activeCameras.add(cameraIndex);
			activeCameras = new Set(activeCameras); // Trigger reactivity
			showFeedbackMsg(`Camera ${cameraIndex} started`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to start camera ${cameraIndex}: ${err.message}`, 'error');
		}
	}
	
	// Stop a camera
	async function stopCamera(cameraIndex: number) {
		try {
			await roverApi.stopCamera(cameraIndex);
			activeCameras.delete(cameraIndex);
			activeCameras = new Set(activeCameras); // Trigger reactivity
			showFeedbackMsg(`Camera ${cameraIndex} stopped`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to stop camera ${cameraIndex}: ${err.message}`, 'error');
		}
	}
	
	// Capture image from camera
	async function captureImage(cameraIndex: number) {
		try {
			const result = await roverApi.captureCameraImage(cameraIndex, telemetry);
			showFeedbackMsg(`Image captured: ${result.saved} (${result.file_size_mb} MB)`, 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to capture image: ${err.message}`, 'error');
		}
	}
	
	// Stop all cameras
	async function stopAllCameras() {
		try {
			await roverApi.stopAllCameras();
			activeCameras.clear();
			activeCameras = new Set(activeCameras); // Trigger reactivity
			showFeedbackMsg('All cameras stopped', 'success');
		} catch (err: any) {
			showFeedbackMsg(`Failed to stop cameras: ${err.message}`, 'error');
		}
	}
	
	// Get camera stream URL
	function getStreamUrl(cameraIndex: number) {
		return roverApi.getCameraStreamUrl(cameraIndex);
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
				{#each cameras as camera}
				<div class="bg-secondary rounded-lg border border-border overflow-hidden">
					<!-- Camera Header -->
					<div class="p-3 bg-card border-b border-border flex justify-between items-center">
						<div>
							<h3 class="font-semibold text-foreground">Camera {camera.index}</h3>
							<p class="text-xs text-muted-foreground">
								{camera.default_resolution} @ {camera.default_fps}fps | {camera.backend}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if activeCameras.has(camera.index)}
							<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
							<Badge variant="success" class="text-xs">Active</Badge>
							{:else}
							<span class="w-2 h-2 bg-muted rounded-full"></span>
							<Badge variant="secondary" class="text-xs">Inactive</Badge>
							{/if}
						</div>
					</div>
					
					<!-- Camera Stream or Placeholder -->
					<div class="relative bg-black aspect-video">
						{#if activeCameras.has(camera.index)}
						<img 
							src={getStreamUrl(camera.index)}
							alt="Camera {camera.index} Stream"
							class="w-full h-full object-contain"
							onerror={(e) => {
								console.error(`Stream error for camera ${camera.index}`);
								e.currentTarget.src = '';
							}}
						/>
						<div class="absolute top-2 left-2 bg-destructive text-white text-xs px-2 py-1 rounded font-mono">
							LIVE
						</div>
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
							{#if activeCameras.has(camera.index)}
							<Button 
								variant="secondary"
								size="sm"
								class="flex-1"
								onclick={() => captureImage(camera.index)}
								disabled={$apiStatus !== 'connected'}
							>
								<ImageIcon class="w-4 h-4 mr-1" />
								Capture
							</Button>
							<Button 
								variant="secondary"
								size="sm"
								onclick={() => stopCamera(camera.index)}
								disabled={$apiStatus !== 'connected'}
							>
								<PowerOff class="w-4 h-4" />
							</Button>
							{:else}
							<Button 
								variant="default"
								size="sm"
								class="flex-1"
								onclick={() => startCamera(camera.index)}
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
