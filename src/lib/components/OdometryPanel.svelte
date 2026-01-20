<script>
	import { onMount, onDestroy } from 'svelte';
	import { Navigation, Gauge } from 'lucide-svelte';
	import { isRosConnected, odometryData, startOdometryUpdates, stopOdometryUpdates } from '$lib/stores/rosStore';
	
	let updateInterval = null;
	let position = { x: 0, y: 0, z: 0 };
	let orientation = { x: 0, y: 0, z: 0, w: 1 };
	let linearVelocity = { x: 0, y: 0, z: 0 };
	let angularVelocity = { x: 0, y: 0, z: 0 };
	
	onMount(async () => {
		if ($isRosConnected) {
			updateInterval = await startOdometryUpdates(500);
		}
	});
	
	onDestroy(() => {
		if (updateInterval) {
			stopOdometryUpdates(updateInterval);
		}
	});
	
	// Watch for ROS connection changes
	$: if ($isRosConnected && !updateInterval) {
		startOdometryUpdates(500).then(interval => {
			updateInterval = interval;
		});
	} else if (!$isRosConnected && updateInterval) {
		stopOdometryUpdates(updateInterval);
		updateInterval = null;
	}
	
	// Update local state when odometry data changes
	$: if ($odometryData) {
		if ($odometryData.pose?.pose?.position) {
			position = $odometryData.pose.pose.position;
		}
		if ($odometryData.pose?.pose?.orientation) {
			orientation = $odometryData.pose.pose.orientation;
		}
		if ($odometryData.twist?.twist?.linear) {
			linearVelocity = $odometryData.twist.twist.linear;
		}
		if ($odometryData.twist?.twist?.angular) {
			angularVelocity = $odometryData.twist.twist.angular;
		}
	}
	
	// Calculate heading from quaternion (simplified - just Z rotation)
	function quaternionToYaw(orientation) {
		const { x, y, z, w } = orientation;
		const siny_cosp = 2 * (w * z + x * y);
		const cosy_cosp = 1 - 2 * (y * y + z * z);
		return Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
	}
	
	$: heading = quaternionToYaw(orientation);
	$: speed = Math.sqrt(
		linearVelocity.x ** 2 + 
		linearVelocity.y ** 2 + 
		linearVelocity.z ** 2
	).toFixed(2);
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white flex items-center gap-2">
			<Navigation class="w-5 h-5 text-sky-400" />
			Odometry
		</h2>
	</div>
	
	<div class="p-4 space-y-4">
		{#if !$isRosConnected}
			<p class="text-sm text-slate-400 text-center py-4">
				Connect to ROS to view odometry data
			</p>
		{:else if !$odometryData}
			<p class="text-sm text-slate-400 text-center py-4">
				Waiting for odometry data...
			</p>
		{:else}
			<!-- Position -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm text-white">Position</h3>
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">X</div>
						<div class="font-mono text-white">{position.x.toFixed(3)}m</div>
					</div>
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Y</div>
						<div class="font-mono text-white">{position.y.toFixed(3)}m</div>
					</div>
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Z</div>
						<div class="font-mono text-white">{position.z.toFixed(3)}m</div>
					</div>
				</div>
			</div>
			
			<!-- Heading -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm text-white">Heading</h3>
				<div class="bg-slate-900 p-3 rounded flex items-center justify-center">
					<div class="text-center">
						<div class="text-3xl font-bold text-sky-400">{heading.toFixed(1)}°</div>
						<div class="text-xs text-slate-400 mt-1">
							{#if heading >= -22.5 && heading < 22.5}
								North
							{:else if heading >= 22.5 && heading < 67.5}
								NE
							{:else if heading >= 67.5 && heading < 112.5}
								East
							{:else if heading >= 112.5 && heading < 157.5}
								SE
							{:else if (heading >= 157.5 && heading <= 180) || (heading >= -180 && heading < -157.5)}
								South
							{:else if heading >= -157.5 && heading < -112.5}
								SW
							{:else if heading >= -112.5 && heading < -67.5}
								West
							{:else}
								NW
							{/if}
						</div>
					</div>
				</div>
			</div>
			
			<!-- Velocity -->
			<div class="space-y-2">
				<h3 class="font-semibold text-sm text-white flex items-center gap-2">
					<Gauge class="w-4 h-4" />
					Velocity
				</h3>
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Linear</div>
						<div class="font-mono text-green-400">{speed} m/s</div>
					</div>
					<div class="bg-slate-900 p-2 rounded">
						<div class="text-slate-400">Angular</div>
						<div class="font-mono text-amber-400">{angularVelocity.z.toFixed(2)} rad/s</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
