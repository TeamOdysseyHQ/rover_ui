<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import { Button } from '$lib/components/ui/button';
	
	// Props with $bindable
	let { show = $bindable(false), routeAnalysis = null } = $props();
</script>

<Modal bind:show title="Route Analysis">
	{#if routeAnalysis}
		<div class="space-y-4">
			<div class="p-4 bg-secondary rounded-lg">
				<h3 class="font-semibold text-foreground mb-3">Mission Statistics</h3>
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<p class="text-muted-foreground">Total Distance</p>
						<p class="text-xl font-bold text-primary">{routeAnalysis.total_distance || 'N/A'} m</p>
					</div>
					<div>
						<p class="text-muted-foreground">Waypoints</p>
						<p class="text-xl font-bold text-primary">{routeAnalysis.waypoint_count || 0}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Images Captured</p>
						<p class="text-xl font-bold text-green-400">{routeAnalysis.images_count || 0}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Mission Time</p>
						<p class="text-xl font-bold text-amber-400">{routeAnalysis.duration || 'N/A'}</p>
					</div>
				</div>
			</div>
			{#if routeAnalysis.path_segments}
				<div class="p-4 bg-secondary rounded-lg">
					<h3 class="font-semibold text-foreground mb-3">Path Segments</h3>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each routeAnalysis.path_segments as segment, index}
							<div class="text-sm p-2 bg-card rounded">
								<p class="text-foreground"><strong>Segment {index + 1}:</strong> {segment.distance}m</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-muted-foreground">No route analysis data available.</p>
	{/if}
	<div class="mt-6 flex justify-end">
		<Button variant="secondary" onclick={() => show = false}>Close</Button>
	</div>
</Modal>
