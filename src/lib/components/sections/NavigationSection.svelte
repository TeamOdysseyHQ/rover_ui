<script>
	import { Route } from 'lucide-svelte';
	import { apiStatus } from '$lib/stores/apiStore';
	import { isRosConnected } from '$lib/stores/rosStore';
	
	export let waypoints = [];
	export let onViewWaypoints = () => {};
	export let onViewRouteAnalysis = () => {};
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white">Navigation & Journey</h2>
	</div>
	<div class="p-4 space-y-3 text-sm">
		<p class="flex justify-between"><strong>GPS Coordinates:</strong> <span>16.5062° N, 80.6480° E</span></p>
		<p class="flex justify-between"><strong>Total Waypoints:</strong> <span class="text-sky-400">{waypoints.length}</span></p>
		<p class="flex justify-between"><strong>API Status:</strong> <span class="{$apiStatus === 'connected' ? 'text-green-400' : 'text-red-400'}">{$apiStatus.toUpperCase()}</span></p>
		<p class="flex justify-between"><strong>ROS Status:</strong> <span class="{$isRosConnected ? 'text-green-400' : 'text-red-400'}">{$isRosConnected ? 'CONNECTED' : 'OFFLINE'}</span></p>
	</div>
	<div class="p-4 border-t border-slate-700 space-y-2">
		<button 
			class="btn btn-secondary w-full"
			on:click={onViewWaypoints}
			disabled={$apiStatus !== 'connected'}
		>
			<Route class="w-4 h-4 mr-2" />View Waypoints
		</button>
		<button 
			class="btn btn-secondary w-full"
			on:click={onViewRouteAnalysis}
			disabled={$apiStatus !== 'connected'}
		>
			<Route class="w-4 h-4 mr-2" />Route Analysis
		</button>
	</div>
</div>
