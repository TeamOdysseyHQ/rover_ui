<script>
	import { onMount, onDestroy } from 'svelte';
	import { Wifi, WifiOff, RefreshCw, Activity } from 'lucide-svelte';
	import { rosStatus, isRosConnected, checkRosStatus, connectToRos, disconnectFromRos } from '$lib/stores/rosStore';
	
	let checking = false;
	let statusCheckInterval;
	
	onMount(() => {
		// Initial check
		checkRosStatus();
		
		// Check status every 5 seconds
		statusCheckInterval = setInterval(() => {
			checkRosStatus();
		}, 5000);
	});
	
	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
	});
	
	async function handleConnect() {
		checking = true;
		await connectToRos();
		checking = false;
	}
	
	async function handleDisconnect() {
		checking = true;
		await disconnectFromRos();
		checking = false;
	}
	
	async function handleRefresh() {
		checking = true;
		await checkRosStatus();
		checking = false;
	}
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700 flex justify-between items-center">
		<h2 class="font-semibold text-lg text-white flex items-center gap-2">
			{#if $isRosConnected}
				<Activity class="w-5 h-5 text-green-400" />
			{:else}
				<WifiOff class="w-5 h-5 text-red-400" />
			{/if}
			ROS Bridge
		</h2>
		<button 
			class="p-2 hover:bg-slate-700 rounded transition-colors"
			on:click={handleRefresh}
			disabled={checking}
			title="Refresh status"
		>
			<RefreshCw class="w-4 h-4 {checking ? 'animate-spin' : ''}" />
		</button>
	</div>
	
	<div class="p-4 space-y-3">
		<!-- Connection Status -->
		<div class="flex justify-between items-center">
			<span class="text-sm">Status:</span>
			<span class="font-semibold {$isRosConnected ? 'text-green-400' : 'text-red-400'}">
				{$isRosConnected ? 'CONNECTED' : 'DISCONNECTED'}
			</span>
		</div>
		
		{#if $rosStatus.url}
		<div class="flex justify-between items-center text-sm">
			<span>URL:</span>
			<span class="text-slate-300 font-mono text-xs">{$rosStatus.url}</span>
		</div>
		{/if}
		
		{#if $isRosConnected}
		<div class="flex justify-between items-center text-sm">
			<span>Subscriptions:</span>
			<span class="text-sky-400">{$rosStatus.subscribedTopics.length}</span>
		</div>
		
		<div class="flex justify-between items-center text-sm">
			<span>Publishers:</span>
			<span class="text-sky-400">{$rosStatus.publishedTopics.length}</span>
		</div>
		
		{#if $rosStatus.subscribedTopics.length > 0}
		<details class="text-xs">
			<summary class="cursor-pointer text-slate-400 hover:text-white">Subscribed Topics</summary>
			<ul class="mt-2 space-y-1 ml-4">
				{#each $rosStatus.subscribedTopics as topic}
					<li class="font-mono text-slate-300">{topic}</li>
				{/each}
			</ul>
		</details>
		{/if}
		{/if}
		
		{#if $rosStatus.lastChecked}
		<div class="text-xs text-slate-500">
			Last checked: {new Date($rosStatus.lastChecked).toLocaleTimeString()}
		</div>
		{/if}
		
		<!-- Control Buttons -->
		<div class="pt-3 border-t border-slate-700">
			{#if $isRosConnected}
				<button 
					class="btn btn-secondary w-full"
					on:click={handleDisconnect}
					disabled={checking}
				>
					<WifiOff class="w-4 h-4 mr-2" />
					Disconnect
				</button>
			{:else}
				<button 
					class="btn btn-primary w-full"
					on:click={handleConnect}
					disabled={checking}
				>
					<Wifi class="w-4 h-4 mr-2" />
					Connect to ROS
				</button>
			{/if}
		</div>
	</div>
</div>
