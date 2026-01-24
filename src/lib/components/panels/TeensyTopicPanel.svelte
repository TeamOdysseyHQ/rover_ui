<script lang="ts">
	import { Activity, RefreshCw, Trash2, Power } from 'lucide-svelte';
	import { isRosConnected, teensyTopicData, startTeensyTopicUpdates, stopTeensyTopicUpdates } from '$lib/stores/rosStore';
	import * as roverApi from '$lib/services/roverApi';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	let updateInterval = $state<number | null>(null);
	let dataValue = $state<number | null>(null);
	let dataHistory = $state<number[]>([]);
	const maxHistoryLength = 20;
	let isSubscribed = $state(false);
	let updateRate = $state(500); // ms
	let lastUpdateTime = $state<Date | null>(null);
	
	// Computed stats
	let min = $derived(dataHistory.length > 0 ? Math.min(...dataHistory) : 0);
	let max = $derived(dataHistory.length > 0 ? Math.max(...dataHistory) : 0);
	let avg = $derived(
		dataHistory.length > 0 
			? (dataHistory.reduce((a, b) => a + b, 0) / dataHistory.length).toFixed(2) 
			: 0
	);
	
	// Watch for ROS connection and manage subscription
	$effect(() => {
		if ($isRosConnected && !updateInterval) {
			startTeensyTopicUpdates(updateRate).then(interval => {
				updateInterval = interval;
				isSubscribed = true;
			});
		} else if (!$isRosConnected && updateInterval) {
			stopTeensyTopicUpdates(updateInterval);
			updateInterval = null;
			isSubscribed = false;
		}
		
		return () => {
			if (updateInterval) {
				stopTeensyTopicUpdates(updateInterval);
			}
		};
	});
	
	// Update local state when teensy topic data changes
	$effect(() => {
		if ($teensyTopicData !== null) {
			dataValue = $teensyTopicData.data;
			lastUpdateTime = new Date();
			
			// Add to history
			dataHistory = [...dataHistory, $teensyTopicData].slice(-maxHistoryLength);
		}
	});
	
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
	function formatTime(date: Date | null) {
		if (!date) return 'N/A';
		return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<div>
				<Card.Title class="flex items-center gap-2">
					<Activity class="w-5 h-5 text-green-500" />
					Teensy Topic Monitor
				</Card.Title>
				<p class="text-xs text-muted-foreground mt-1">/teensy_topic (std_msgs/Int32)</p>
			</div>
			<div class="flex items-center gap-2">
				{#if $isRosConnected}
					<Button
						variant={isSubscribed ? 'destructive' : 'default'}
						size="sm"
						onclick={toggleSubscription}
						title={isSubscribed ? 'Stop monitoring' : 'Start monitoring'}
					>
						<Power class="w-4 h-4" />
						{isSubscribed ? 'Stop' : 'Start'}
					</Button>
				{/if}
			</div>
		</div>
	</Card.Header>
	
	<Card.Content class="space-y-4">
		{#if !$isRosConnected}
			<p class="text-sm text-muted-foreground text-center py-4">
				Connect to ROS to monitor teensy topic data
			</p>
		{:else if !isSubscribed}
			<p class="text-sm text-muted-foreground text-center py-4">
				Click "Start" to begin monitoring /teensy_topic
			</p>
		{:else if dataValue === null}
			<p class="text-sm text-muted-foreground text-center py-4">
				<RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2" />
				Waiting for teensy topic data...
			</p>
		{:else}
			<!-- Current Value -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm">Current Value</h3>
					<div class="text-xs text-muted-foreground">
						Updated: {formatTime(lastUpdateTime)}
					</div>
				</div>
				<div class="bg-secondary p-4 rounded flex items-center justify-center">
					<div class="text-center">
						<div class="text-4xl font-bold text-green-500 font-mono">{dataValue}</div>
						<div class="text-xs text-muted-foreground mt-1">data value</div>
					</div>
				</div>
			</div>
			
			<!-- Update Rate Control -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm">Update Rate</h3>
				<div class="flex items-center gap-2">
					<input
						type="range"
						bind:value={updateRate}
						onchange={changeUpdateRate}
						min="100"
						max="2000"
						step="100"
						class="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
					/>
					<span class="text-xs text-muted-foreground min-w-[60px]">{updateRate}ms</span>
				</div>
			</div>
			
			<!-- Statistics -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm">Statistics (last {dataHistory.length})</h3>
					{#if dataHistory.length > 0}
						<Button
							variant="ghost"
							size="sm"
							onclick={clearHistory}
							title="Clear history"
							class="h-auto py-1"
						>
							<Trash2 class="w-3 h-3 mr-1" />
							Clear
						</Button>
					{/if}
				</div>
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="bg-secondary p-2 rounded">
						<div class="text-muted-foreground">Min</div>
						<div class="font-mono text-blue-400">{min}</div>
					</div>
					<div class="bg-secondary p-2 rounded">
						<div class="text-muted-foreground">Avg</div>
						<div class="font-mono text-amber-400">{avg}</div>
					</div>
					<div class="bg-secondary p-2 rounded">
						<div class="text-muted-foreground">Max</div>
						<div class="font-mono text-red-400">{max}</div>
					</div>
				</div>
			</div>
			
			<!-- Recent Values -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm">Recent Values</h3>
				<div class="bg-secondary p-2 rounded max-h-24 overflow-y-auto">
					{#if dataHistory.length === 0}
						<p class="text-xs text-muted-foreground text-center py-2">No data yet</p>
					{:else}
						<div class="text-xs font-mono space-y-1">
							{#each dataHistory.slice().reverse() as value, i}
								<div class="flex justify-between">
									<span class="text-muted-foreground">#{dataHistory.length - i}</span>
									<span>{value}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
