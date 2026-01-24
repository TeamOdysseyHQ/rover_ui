<script lang="ts">
	import { Wifi, WifiOff, RefreshCw, Activity } from 'lucide-svelte';
	import { rosStatus, isRosConnected, checkRosStatus, connectToRos, disconnectFromRos } from '$lib/stores/rosStore';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	let checking = $state(false);
	
	// Auto-check status with cleanup
	$effect(() => {
		// Initial check
		checkRosStatus();
		
		// Check status every 5 seconds
		const interval = setInterval(() => {
			checkRosStatus();
		}, 5000);
		
		return () => clearInterval(interval);
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

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border flex flex-row justify-between items-center py-4">
		<Card.Title class="flex items-center gap-2">
			{#if $isRosConnected}
				<Activity class="w-5 h-5 text-green-500" />
			{:else}
				<WifiOff class="w-5 h-5 text-destructive" />
			{/if}
			ROS Bridge
		</Card.Title>
		<Button
			variant="ghost"
			size="icon"
			onclick={handleRefresh}
			disabled={checking}
			title="Refresh status"
		>
			<RefreshCw class="w-4 h-4 {checking ? 'animate-spin' : ''}" />
		</Button>
	</Card.Header>
	
	<Card.Content class="space-y-3">
		<!-- Connection Status -->
		<div class="flex justify-between items-center">
			<span class="text-sm">Status:</span>
			<Badge variant={$isRosConnected ? 'success' : 'destructive'}>
				{$isRosConnected ? 'CONNECTED' : 'DISCONNECTED'}
			</Badge>
		</div>
		
		{#if $rosStatus.url}
		<div class="flex justify-between items-center text-sm">
			<span>URL:</span>
			<span class="text-muted-foreground font-mono text-xs">{$rosStatus.url}</span>
		</div>
		{/if}
		
		{#if $isRosConnected}
		<div class="flex justify-between items-center text-sm">
			<span>Subscriptions:</span>
			<Badge variant="outline" class="text-primary">{$rosStatus.subscribedTopics.length}</Badge>
		</div>
		
		<div class="flex justify-between items-center text-sm">
			<span>Publishers:</span>
			<Badge variant="outline" class="text-primary">{$rosStatus.publishedTopics.length}</Badge>
		</div>
		
		{#if $rosStatus.subscribedTopics.length > 0}
		<details class="text-xs">
			<summary class="cursor-pointer text-muted-foreground hover:text-foreground">Subscribed Topics</summary>
			<ul class="mt-2 space-y-1 ml-4">
				{#each $rosStatus.subscribedTopics as topic}
					<li class="font-mono text-foreground">{topic}</li>
				{/each}
			</ul>
		</details>
		{/if}
		{/if}
		
		{#if $rosStatus.lastChecked}
		<div class="text-xs text-muted-foreground">
			Last checked: {new Date($rosStatus.lastChecked).toLocaleTimeString()}
		</div>
		{/if}
		
		<!-- Control Buttons -->
		<div class="pt-3 border-t border-border">
			{#if $isRosConnected}
				<Button 
					variant="secondary"
					class="w-full"
					onclick={handleDisconnect}
					disabled={checking}
				>
					<WifiOff class="w-4 h-4 mr-2" />
					Disconnect
				</Button>
			{:else}
				<Button 
					variant="default"
					class="w-full"
					onclick={handleConnect}
					disabled={checking}
				>
					<Wifi class="w-4 h-4 mr-2" />
					Connect to ROS
				</Button>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
