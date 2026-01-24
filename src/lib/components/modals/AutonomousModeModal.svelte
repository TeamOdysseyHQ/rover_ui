<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { logCommand } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	
	// Props with $bindable for two-way binding
	let { 
		show = $bindable(false), 
		gpsLat = $bindable('16.5062'), 
		gpsLon = $bindable('80.6480'), 
		onSuccess = () => {}, 
		onError = () => {} 
	} = $props();
	
	async function initiateAutonomous() {
		try {
			const data = {
				latitude: parseFloat(gpsLat),
				longitude: parseFloat(gpsLon),
				description: 'Autonomous destination',
				waypoint_type: 'destination'
			};
			
			logCommand({ type: 'ADD_WAYPOINT', data }, 'sent');
			const result = await roverApi.addWaypoint(data);
			logCommand({ type: 'ADD_WAYPOINT', data }, 'success', result);
			
			onSuccess(`Waypoint added: ${result.waypoint_id}`);
			show = false;
		} catch (error: any) {
			logCommand({ type: 'ADD_WAYPOINT', data: { latitude: gpsLat, longitude: gpsLon } }, 'error', error.message);
			onError(`Failed to add waypoint: ${error.message}`);
		}
	}
</script>

<Modal bind:show title="Switch to Autonomous Mode">
	<p class="text-muted-foreground mb-6">
		Enter the destination GPS coordinates to begin the autonomous journey. The rover will calculate the optimal path.
	</p>
	<div class="space-y-4">
		<div>
			<label for="gps-lat" class="block text-sm font-medium mb-1">Destination Latitude</label>
			<input 
				id="gps-lat" 
				type="text"
				bind:value={gpsLat}
				class="w-full bg-secondary border border-border rounded-md p-2 text-foreground" 
				placeholder="e.g., 18.4521° S"
			/>
		</div>
		<div>
			<label for="gps-lon" class="block text-sm font-medium mb-1">Destination Longitude</label>
			<input 
				id="gps-lon" 
				type="text"
				bind:value={gpsLon}
				class="w-full bg-secondary border border-border rounded-md p-2 text-foreground" 
				placeholder="e.g., 77.3663° E"
			/>
		</div>
	</div>
	<div class="mt-8 flex justify-end gap-4">
		<Button variant="secondary" onclick={() => show = false}>Cancel</Button>
		<Button 
			variant="default"
			onclick={initiateAutonomous}
		>
			Add Waypoint & Start
		</Button>
	</div>
</Modal>
