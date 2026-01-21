<script>
	import { Bot, XOctagon } from 'lucide-svelte';
	import { isRosConnected, stopRover } from '$lib/stores/rosStore';
	import { logCommand } from '$lib/stores/apiStore';
	import Joystick from '../controls/Joystick.svelte';
	import ToggleSwitch from '../ui/ToggleSwitch.svelte';
	
	export let onEmergencyStop = () => {};
	export let onShowAutoModal = () => {};
	
	let ackermanMode = true;
	let independentMode = false;
	
	// Joystick control via ROS
	function handleJoystickMove(event) {
		// Joystick now publishes directly to ROS /cmd_vel
		// This handler can be used for additional UI feedback if needed
		logCommand({ type: 'JOYSTICK_MOVE', data: { x: event.detail.x, y: event.detail.y } }, 'sent');
	}
	
	// Emergency stop via ROS
	async function handleEmergencyStop() {
		try {
			logCommand({ type: 'EMERGENCY_STOP' }, 'sent');
			const success = await stopRover();
			if (success) {
				logCommand({ type: 'EMERGENCY_STOP' }, 'success');
				onEmergencyStop('Emergency stop activated!', 'success');
			} else {
				throw new Error('Failed to stop rover');
			}
		} catch (error) {
			logCommand({ type: 'EMERGENCY_STOP' }, 'error', error.message);
			onEmergencyStop(`Emergency stop failed: ${error.message}`, 'error');
		}
	}
	
	// Steering mode toggle (no backend endpoint)
	function toggleSteeringMode(mode) {
		if (mode === 'ackerman') {
			ackermanMode = !ackermanMode;
			console.log('Steering mode (Ackerman - not implemented in backend):', ackermanMode);
		} else {
			independentMode = !independentMode;
			console.log('Steering mode (Independent - not implemented in backend):', independentMode);
		}
	}
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white">Driving Controls</h2>
	</div>
	<div class="p-4 flex justify-between items-center">
		<div>
			<h3 class="font-semibold text-white">Mode: Manual</h3>
			<p class="text-sm text-slate-400">
				{#if $isRosConnected}
					<span class="text-green-400">ROS Connected - Ready</span>
				{:else}
					<span class="text-amber-400">Connect to ROS first</span>
				{/if}
			</p>
		</div>
		<button class="btn btn-primary" on:click={onShowAutoModal}>
			<Bot class="w-4 h-4 mr-2" />Go Autonomous
		</button>
	</div>
	<div class="p-4 flex justify-around items-center">
		<Joystick 
			on:move={handleJoystickMove} 
			maxLinearSpeed={1.0}
			maxAngularSpeed={1.0}
			enableRos={true}
		/>
		<div class="space-y-4">
			<div>
				<h3 class="font-semibold mb-2 text-center text-white">Steering</h3>
				<div class="flex items-center gap-2 mb-2">
					<label class="text-sm">Ackerman</label>
					<ToggleSwitch 
						checked={ackermanMode}
						on:change={() => toggleSteeringMode('ackerman')}
					/>
				</div>
				<div class="flex items-center gap-2">
					<label class="text-sm">Independent</label>
					<ToggleSwitch 
						checked={independentMode}
						on:change={() => toggleSteeringMode('independent')}
					/>
				</div>
			</div>
			<button 
				class="btn w-full bg-red-600 hover:bg-red-700 border-red-600 text-white font-bold"
				on:click={handleEmergencyStop}
				disabled={!$isRosConnected}
				title="Emergency Stop"
			>
				<XOctagon class="w-5 h-5 mr-2" />
				E-STOP
			</button>
		</div>
	</div>
</div>
