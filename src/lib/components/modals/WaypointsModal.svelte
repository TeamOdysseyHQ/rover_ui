<script>
	import Modal from '../ui/Modal.svelte';
	
	export let show = false;
	export let waypoints = [];
</script>

<Modal bind:show title="Mission Waypoints">
	{#if waypoints.length === 0}
		<p class="text-slate-400">No waypoints found.</p>
	{:else}
		<div class="space-y-3 max-h-96 overflow-y-auto">
			{#each waypoints as waypoint, index}
				<div class="p-4 bg-slate-800 rounded-lg border border-slate-700">
					<div class="flex justify-between items-start mb-2">
						<h3 class="font-semibold text-white">Waypoint #{index + 1}</h3>
						<span class="text-xs px-2 py-1 bg-sky-500/20 text-sky-400 rounded">{waypoint.waypoint_type || 'unknown'}</span>
					</div>
					<div class="text-sm space-y-1">
						<p><strong>Latitude:</strong> {waypoint.latitude}°</p>
						<p><strong>Longitude:</strong> {waypoint.longitude}°</p>
						{#if waypoint.description}
							<p><strong>Description:</strong> {waypoint.description}</p>
						{/if}
						{#if waypoint.timestamp}
							<p class="text-slate-400"><strong>Time:</strong> {new Date(waypoint.timestamp).toLocaleString()}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	<div class="mt-6 flex justify-end">
		<button class="btn btn-secondary" on:click={() => show = false}>Close</button>
	</div>
</Modal>
