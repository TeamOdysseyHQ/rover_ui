<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	// Props with $bindable
	let { show = $bindable(false), waypoints = [] } = $props();
</script>

<Modal bind:show title="Mission Waypoints">
	{#if waypoints.length === 0}
		<p class="text-muted-foreground">No waypoints found.</p>
	{:else}
		<div class="space-y-3 max-h-96 overflow-y-auto">
			{#each waypoints as waypoint, index}
				<div class="p-4 bg-secondary rounded-lg border border-border">
					<div class="flex justify-between items-start mb-2">
						<h3 class="font-semibold text-foreground">Waypoint #{index + 1}</h3>
						<Badge variant="default" class="text-xs">{waypoint.waypoint_type || 'unknown'}</Badge>
					</div>
					<div class="text-sm space-y-1 text-muted-foreground">
						<p><strong class="text-foreground">Latitude:</strong> {waypoint.latitude}°</p>
						<p><strong class="text-foreground">Longitude:</strong> {waypoint.longitude}°</p>
						{#if waypoint.description}
							<p><strong class="text-foreground">Description:</strong> {waypoint.description}</p>
						{/if}
						{#if waypoint.timestamp}
							<p><strong class="text-foreground">Time:</strong> {new Date(waypoint.timestamp).toLocaleString()}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	<div class="mt-6 flex justify-end">
		<Button variant="secondary" onclick={() => show = false}>Close</Button>
	</div>
</Modal>
