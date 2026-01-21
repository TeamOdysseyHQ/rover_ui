<script>
	import Modal from '../ui/Modal.svelte';
	import { logCommand } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	
	export let show = false;
	export let gpsLat = '16.5062';
	export let gpsLon = '80.6480';
	export let onSuccess = () => {};
	export let onError = () => {};
	
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
		} catch (error) {
			logCommand({ type: 'ADD_WAYPOINT', data: { latitude: gpsLat, longitude: gpsLon } }, 'error', error.message);
			onError(`Failed to add waypoint: ${error.message}`);
		}
	}
</script>

<Modal bind:show title="Switch to Autonomous Mode">
	<p class="text-slate-400 mb-6">
		Enter the destination GPS coordinates to begin the autonomous journey. The rover will calculate the optimal path.
	</p>
	<div class="space-y-4">
		<div>
			<label for="gps-lat" class="block text-sm font-medium mb-1">Destination Latitude</label>
			<input 
				id="gps-lat" 
				type="text"
				bind:value={gpsLat}
				class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
				placeholder="e.g., 18.4521° S"
			>
		</div>
		<div>
			<label for="gps-lon" class="block text-sm font-medium mb-1">Destination Longitude</label>
			<input 
				id="gps-lon" 
				type="text"
				bind:value={gpsLon}
				class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
				placeholder="e.g., 77.3663° E"
			>
		</div>
	</div>
	<div class="mt-8 flex justify-end gap-4">
		<button class="btn btn-secondary" on:click={() => show = false}>Cancel</button>
		<button 
			class="btn btn-primary"
			on:click={initiateAutonomous}
		>
			Add Waypoint & Start
		</button>
	</div>
</Modal>
