<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/services/roverApi.js';
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

	// State
	let isSubscribed = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let imgSrc = $state<string>('');
	let imgElement = $state<HTMLImageElement | null>(null);

	// Subscribe to ROS camera topic
	async function subscribe() {
		isLoading = true;
		error = null;

		try {
			const response = await api.subscribeToRosCamera(topicName);
			if (response.success) {
				isSubscribed = true;
				// Set the MJPEG stream URL
				imgSrc = api.getRosCameraStreamUrl(topicName);
			} else {
				error = response.message || 'Failed to subscribe to camera topic';
			}
		} catch (err) {
			console.error('Error subscribing to ROS camera:', err);
			error = err instanceof Error ? err.message : 'Failed to subscribe';
		} finally {
			isLoading = false;
		}
	}

	// Unsubscribe from ROS camera topic
	async function unsubscribe() {
		try {
			await api.unsubscribeFromRosCamera(topicName);
			isSubscribed = false;
			imgSrc = '';
		} catch (err) {
			console.error('Error unsubscribing from ROS camera:', err);
		}
	}

	// Auto-subscribe on mount if enabled
	onMount(() => {
		if (autoSubscribe) {
			subscribe();
		}

		// Cleanup on unmount
		return () => {
			if (isSubscribed) {
				unsubscribe();
			}
		};
	});
</script>

<div class="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-medium text-white">{title}</h3>
			<p class="text-sm text-slate-400">{topicName}</p>
		</div>

		<div class="flex items-center gap-2">
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
						isLoading
							? 'cursor-not-allowed bg-slate-700 text-slate-400'
							: 'bg-sky-blue hover:bg-sky-600'
					)}
				>
					{isLoading ? 'Subscribing...' : 'Start Stream'}
				</button>
			{/if}
		</div>
	</div>

	<!-- Error Message -->
	{#if error}
		<div class="rounded bg-red-900/20 border border-red-800 p-3">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{/if}

	<!-- Video Stream -->
	<div class="relative aspect-video w-full overflow-hidden rounded border border-slate-800 bg-black">
		{#if isSubscribed && imgSrc}
			<img
				bind:this={imgElement}
				src={imgSrc}
				alt="ROS Camera Feed"
				class="h-full w-full object-contain"
			/>
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
		<span>MJPEG Stream</span>
	</div>
</div>
