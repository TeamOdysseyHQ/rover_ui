<script>
	import { onMount, onDestroy } from 'svelte';
	import { Activity, RefreshCw, Trash2, Power } from 'lucide-svelte';
	import { isRosConnected, teensyTopicData, startTeensyTopicUpdates, stopTeensyTopicUpdates } from '$lib/stores/rosStore';
	import * as roverApi from '$lib/services/roverApi';
	
	let updateInterval = null;
	let dataValue = null;
	let dataHistory = [];
	const maxHistoryLength = 20;
	let isSubscribed = false;
	let updateRate = 500; // ms
	let lastUpdateTime = null;
	
	onMount(async () => {
		if ($isRosConnected) {
			updateInterval = await startTeensyTopicUpdates(updateRate);
			isSubscribed = true;
		}
	});
	
	onDestroy(() => {
		if (updateInterval) {
			stopTeensyTopicUpdates(updateInterval);
		}
	});
	
	// Watch for ROS connection changes
	$: if ($isRosConnected && !updateInterval) {
		startTeensyTopicUpdates(updateRate).then(interval => {
			updateInterval = interval;
			isSubscribed = true;
		});
	} else if (!$isRosConnected && updateInterval) {
		stopTeensyTopicUpdates(updateInterval);
		updateInterval = null;
		isSubscribed = false;
	}
	
	// Update local state when teensy topic data changes
	$: if ($teensyTopicData !== null) {
		dataValue = $teensyTopicData.data;
		lastUpdateTime = new Date();
		
		// Add to history
		dataHistory = [...dataHistory, $teensyTopicData].slice(-maxHistoryLength);
	}
	
	// Calculate stats
	$: min = dataHistory.length > 0 ? Math.min(...dataHistory) : 0;
	$: max = dataHistory.length > 0 ? Math.max(...dataHistory) : 0;
	$: avg = dataHistory.length > 0 
		? (dataHistory.reduce((a, b) => a + b, 0) / dataHistory.length).toFixed(2) 
		: 0;
	
	// Handle manual start/stop
	async function toggleSubscription() {
		if (isSubscribed && updateInterval) {
			// Stop
			stopTeensyTopicUpdates(updateInterval);
			await roverApi.unsubscribeTeensyTopic();
			updateInterval = null;
			isSubscribed = false;
		} else {
			// Start
			updateInterval = await startTeensyTopicUpdates(updateRate);
			isSubscribed = true;
		}
	}
	
	// Handle rate change
	async function changeUpdateRate() {
		if (isSubscribed && updateInterval) {
			// Restart with new rate
			stopTeensyTopicUpdates(updateInterval);
			updateInterval = await startTeensyTopicUpdates(updateRate);
		}
	}
	
	// Clear history
	function clearHistory() {
		dataHistory = [];
	}
	
	// Format timestamp
	function formatTime(date) {
		if (!date) return 'N/A';
		return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="font-semibold text-lg text-white flex items-center gap-2">
					<Activity class="w-5 h-5 text-green-400" />
					Teensy Topic Monitor
				</h2>
				<p class="text-xs text-slate-400 mt-1">/teensy_topic (std_msgs/Int32)</p>
			</div>
			<div class="flex items-center gap-2">
				{#if $isRosConnected}
					<button
						on:click={toggleSubscription}
						class="btn btn-sm {isSubscribed ? 'btn-error' : 'btn-success'}"
						title={isSubscribed ? 'Stop monitoring' : 'Start monitoring'}
					>
						<Power class="w-4 h-4" />
						{isSubscribed ? 'Stop' : 'Start'}
					</button>
				{/if}
			</div>
		</div>
	</div>
	
	<div class="p-4 space-y-4">
		{#if !$isRosConnected}
			<p class="text-sm text-slate-400 text-center py-4">
				Connect to ROS to monitor teensy topic data
			</p>
		{:else if !isSubscribed}
			<p class="text-sm text-slate-400 text-center py-4">
				Click "Start" to begin monitoring /teensy_topic
			</p>
		{:else if dataValue === null}
			<p class="text-sm text-slate-400 text-center py-4">
				<RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2" />
				Waiting for teensy topic data...
			</p>
		{:else}
			<!-- Current Value -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm text-white">Current Value</h3>
					<div class="text-xs text-slate-400">
						Updated: {formatTime(lastUpdateTime)}
					</div>
				</div>
				<div class="bg-slate-900 p-4 rounded flex items-center justify-center">
					<div class="text-center">
						<div class="text-4xl font-bold text-green-400 font-mono">{dataValue}</div>
						<div class="text-xs text-slate-400 mt-1">data value</div>
					</div>
				</div>
			</div>
			
			<!-- Update Rate Control -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm text-white">Update Rate</h3>
				<div class="flex items-center gap-2">
					<input
						type="range"
						bind:value={updateRate}
						on:change={changeUpdateRate}
						min="100"
						max="2000"
						step="100"
						class="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
					/>
					<span class="text-xs text-slate-400 min-w-[60px]">{updateRate}ms</span>
				</div>
			</div>
			
			<!-- Statistics -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm text-white">Statistics (last {dataHistory.length})</h3>
					{#if dataHistory.length > 0}
						<button
							on:click={clearHistory}
							class="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1"
							title="Clear history"
						>
							<Trash2 class="w-3 h-3" />
							Clear
						</button>
					{/if}
				</div>
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Min</div>
						<div class="font-mono text-blue-400">{min}</div>
					</div>
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Avg</div>
						<div class="font-mono text-amber-400">{avg}</div>
					</div>
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Max</div>
						<div class="font-mono text-red-400">{max}</div>
					</div>
				</div>
			</div>
			
			<!-- Recent Values -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm text-white">Recent Values</h3>
				<div class="bg-slate-900 p-2 rounded max-h-24 overflow-y-auto">
					{#if dataHistory.length === 0}
						<p class="text-xs text-slate-400 text-center py-2">No data yet</p>
					{:else}
						<div class="text-xs font-mono text-slate-300 space-y-1">
							{#each dataHistory.slice().reverse() as value, i}
								<div class="flex justify-between">
									<span class="text-slate-500">#{dataHistory.length - i}</span>
									<span class="text-white">{value}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.card {
		@apply bg-slate-800 rounded-lg shadow-lg;
	}
	
	.btn {
		@apply px-3 py-1.5 rounded-md font-medium text-sm transition-colors flex items-center gap-2;
	}
	
	.btn-sm {
		@apply px-2 py-1 text-xs;
	}
	
	.btn-success {
		@apply bg-green-600 hover:bg-green-700 text-white;
	}
	
	.btn-error {
		@apply bg-red-600 hover:bg-red-700 text-white;
	}
</style>
