<script lang="ts">
	import { Route } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import { isRosConnected } from '$lib/stores/rosStore';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	// Props using $props rune
	let { waypoints = [], onViewWaypoints = () => {}, onViewRouteAnalysis = () => {} } = $props();
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<Card.Title>Navigation & Journey</Card.Title>
	</Card.Header>
	
	<Card.Content class=" space-y-3 text-sm">
		<div class="flex justify-between">
			<strong>GPS Coordinates:</strong> 
			<span class="text-muted-foreground">16.5062° N, 80.6480° E</span>
		</div>
		<div class="flex justify-between">
			<strong>Total Waypoints:</strong> 
			<Badge variant="default" class="text-xs">{waypoints.length}</Badge>
		</div>
		<div class="flex justify-between items-center">
			<strong>API Status:</strong>
			<Badge variant={$apiStatus === 'connected' ? 'success' : 'destructive'} class="text-xs">
				{$apiStatus.toUpperCase()}
			</Badge>
		</div>
		<div class="flex justify-between items-center">
			<strong>ROS Status:</strong>
			<Badge variant={$isRosConnected ? 'success' : 'destructive'} class="text-xs">
				{$isRosConnected ? 'CONNECTED' : 'OFFLINE'}
			</Badge>
		</div>
	</Card.Content>
	
	<div class="p-6 border-t border-border space-y-2">
		<Button 
			variant="secondary"
			class="w-full"
			onclick={onViewWaypoints}
			disabled={$apiStatus !== 'connected'}
		>
			<Route class="w-4 h-4 mr-2" />View Waypoints
		</Button>
		<Button 
			variant="secondary"
			class="w-full"
			onclick={onViewRouteAnalysis}
			disabled={$apiStatus !== 'connected'}
		>
			<Route class="w-4 h-4 mr-2" />Route Analysis
		</Button>
	</div>
</Card.Root>
