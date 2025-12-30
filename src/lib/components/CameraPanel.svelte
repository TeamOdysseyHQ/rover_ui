<script>
	import { onMount, onDestroy } from 'svelte';
	import { Camera, Power, PowerOff, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	
	// Camera state
	let cameras = [];
	let activeCameras = new Set();
	let loading = false;
	let error = null;
	let feedbackMessage = '';
	let feedbackType = 'success';
	let showFeedback = false;
	
	// Telemetry for captures
	let telemetry = {
		latitude: 16.5062,
		longitude: 80.6480,
		altitude: 0,
		battery_level: 85,
		mission_id: 'default',
		rover_id: 'rover_001'
	};
	
	// Show feedback messages
	function showFeedbackMsg(message, type = 'success') {
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
		} catch (err) {
			error = err.message;
			showFeedbackMsg(`Failed to detect cameras: ${err.message}`, 'error');
			cameras = [];
		} finally {
			loading = false;
		}
	}
	
	// Start a camera
	async function startCamera(cameraIndex) {
		try {
			const result = await roverApi.startCamera(cameraIndex, 1280, 720, 30);
			activeCameras.add(cameraIndex);
			activeCameras = activeCameras; // Trigger reactivity
			showFeedbackMsg(`Camera ${cameraIndex} started`, 'success');
		} catch (err) {
			showFeedbackMsg(`Failed to start camera ${cameraIndex}: ${err.message}`, 'error');
		}
	}
	
	// Stop a camera
	async function stopCamera(cameraIndex) {
		try {
			await roverApi.stopCamera(cameraIndex);
			activeCameras.delete(cameraIndex);
			activeCameras = activeCameras; // Trigger reactivity
			showFeedbackMsg(`Camera ${cameraIndex} stopped`, 'success');
		} catch (err) {
			showFeedbackMsg(`Failed to stop camera ${cameraIndex}: ${err.message}`, 'error');
		}
	}
	
	// Capture image from camera
	async function captureImage(cameraIndex) {
		try {
			const result = await roverApi.captureCameraImage(cameraIndex, telemetry);
			showFeedbackMsg(`Image captured: ${result.saved} (${result.file_size_mb} MB)`, 'success');
		} catch (err) {
			showFeedbackMsg(`Failed to capture image: ${err.message}`, 'error');
		}
	}
	
	// Stop all cameras
	async function stopAllCameras() {
		try {
			await roverApi.stopAllCameras();
			activeCameras.clear();
			activeCameras = activeCameras; // Trigger reactivity
			showFeedbackMsg('All cameras stopped', 'success');
		} catch (err) {
			showFeedbackMsg(`Failed to stop cameras: ${err.message}`, 'error');
		}
	}
	
	// Get camera stream URL
	function getStreamUrl(cameraIndex) {
		return roverApi.getCameraStreamUrl(cameraIndex);
	}
	
	// Lifecycle
	onMount(() => {
		if ($apiStatus === 'connected') {
			detectCameras();
		}
	});
	
	// Cleanup on destroy
	onDestroy(() => {
		if (activeCameras.size > 0) {
			stopAllCameras();
		}
	});
</script>

<div class="space-y-4">
	<!-- Feedback Message -->
	{#if showFeedback}
	<div class="p-3 rounded-lg flex items-center gap-2 text-sm {feedbackType === 'success' ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'}">
		<AlertCircle class="w-4 h-4" />
		<p class="flex-grow">{feedbackMessage}</p>
		<button on:click={() => showFeedback = false} class="text-slate-400 hover:text-white">✕</button>
	</div>
	{/if}
	
	<!-- Controls -->
	<div class="card">
		<div class="p-4 border-b border-slate-700 flex justify-between items-center">
			<h2 class="font-semibold text-lg text-white flex items-center gap-2">
				<Camera class="w-5 h-5 text-sky-400" />
				Camera Control
			</h2>
			<div class="flex gap-2">
				<button 
					class="btn btn-secondary text-sm"
					on:click={detectCameras}
					disabled={loading || $apiStatus !== 'connected'}
				>
					<RefreshCw class="w-4 h-4 mr-1" />
					Detect
				</button>
				{#if activeCameras.size > 0}
				<button 
					class="btn btn-secondary text-sm"
					on:click={stopAllCameras}
					disabled={$apiStatus !== 'connected'}
				>
					<PowerOff class="w-4 h-4 mr-1" />
					Stop All
				</button>
				{/if}
			</div>
		</div>
		
		<div class="p-4">
			<!-- Loading State -->
			{#if loading}
			<div class="text-center py-8 text-slate-400">
				<RefreshCw class="w-8 h-8 mx-auto mb-2 animate-spin" />
				<p>Detecting cameras...</p>
			</div>
			
			<!-- No Cameras -->
			{:else if cameras.length === 0}
			<div class="text-center py-8 text-slate-400">
				<Camera class="w-8 h-8 mx-auto mb-2 opacity-50" />
				<p>No cameras detected</p>
				<button 
					class="btn btn-primary text-sm mt-4"
					on:click={detectCameras}
					disabled={$apiStatus !== 'connected'}
				>
					Scan for Cameras
				</button>
			</div>
			
			<!-- Camera Grid -->
			{:else}
			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				{#each cameras as camera}
				<div class="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
					<!-- Camera Header -->
					<div class="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
						<div>
							<h3 class="font-semibold text-white">Camera {camera.index}</h3>
							<p class="text-xs text-slate-400">
								{camera.default_resolution} @ {camera.default_fps}fps | {camera.backend}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if activeCameras.has(camera.index)}
							<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
							<span class="text-xs text-green-400">Active</span>
							{:else}
							<span class="w-2 h-2 bg-slate-600 rounded-full"></span>
							<span class="text-xs text-slate-400">Inactive</span>
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
							on:error={(e) => {
								console.error(`Stream error for camera ${camera.index}`);
								e.target.src = '';
							}}
						/>
						<div class="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-mono">
							LIVE
						</div>
						{:else}
						<div class="flex items-center justify-center h-full text-slate-600">
							<div class="text-center">
								<Camera class="w-16 h-16 mx-auto mb-2 opacity-30" />
								<p class="text-sm">Camera Offline</p>
							</div>
						</div>
						{/if}
					</div>
					
					<!-- Camera Controls -->
					<div class="p-3 bg-slate-800 border-t border-slate-700">
						<div class="flex gap-2">
							{#if activeCameras.has(camera.index)}
							<button 
								class="btn btn-secondary flex-1 text-sm"
								on:click={() => captureImage(camera.index)}
								disabled={$apiStatus !== 'connected'}
							>
								<ImageIcon class="w-4 h-4 mr-1" />
								Capture
							</button>
							<button 
								class="btn btn-secondary text-sm"
								on:click={() => stopCamera(camera.index)}
								disabled={$apiStatus !== 'connected'}
							>
								<PowerOff class="w-4 h-4" />
							</button>
							{:else}
							<button 
								class="btn btn-primary flex-1 text-sm"
								on:click={() => startCamera(camera.index)}
								disabled={$apiStatus !== 'connected'}
							>
								<Power class="w-4 h-4 mr-1" />
								Start Camera
							</button>
							{/if}
						</div>
					</div>
				</div>
				{/each}
			</div>
			{/if}
		</div>
	</div>
	
	<!-- Telemetry Settings -->
	{#if cameras.length > 0}
	<div class="card">
		<div class="p-4 border-b border-slate-700">
			<h3 class="font-semibold text-white">Capture Telemetry</h3>
			<p class="text-xs text-slate-400 mt-1">Metadata attached to captured images</p>
		</div>
		<div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
			<div>
				<label class="text-xs text-slate-400 block mb-1">Latitude</label>
				<input 
					type="number" 
					bind:value={telemetry.latitude}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
					step="0.0001"
				/>
			</div>
			<div>
				<label class="text-xs text-slate-400 block mb-1">Longitude</label>
				<input 
					type="number" 
					bind:value={telemetry.longitude}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
					step="0.0001"
				/>
			</div>
			<div>
				<label class="text-xs text-slate-400 block mb-1">Altitude (m)</label>
				<input 
					type="number" 
					bind:value={telemetry.altitude}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
				/>
			</div>
			<div>
				<label class="text-xs text-slate-400 block mb-1">Battery (%)</label>
				<input 
					type="number" 
					bind:value={telemetry.battery_level}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
					min="0"
					max="100"
				/>
			</div>
			<div>
				<label class="text-xs text-slate-400 block mb-1">Mission ID</label>
				<input 
					type="text" 
					bind:value={telemetry.mission_id}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
				/>
			</div>
			<div>
				<label class="text-xs text-slate-400 block mb-1">Rover ID</label>
				<input 
					type="text" 
					bind:value={telemetry.rover_id}
					class="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
				/>
			</div>
		</div>
	</div>
	{/if}
</div>

<style>
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
	
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
