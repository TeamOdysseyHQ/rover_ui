<script lang="ts">
	import { Activity, AlertCircle, Archive, Download, StopCircle, Target, TrendingUp } from 'lucide-svelte';
	import { 
		armTelemetry, 
		armSubscribed, 
		armLoading,
		armConnected,
		subscribeToArm,
		startArmTelemetryPolling,
		stopArmTelemetryPolling,
		dropPayload,
		stopArm,
		sendArmTarget
	} from '$lib/stores/armStore';
	import { isRosConnected } from '$lib/stores/rosStore';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	let pollingInterval = $state<number | null>(null);
	let showTargetControls = $state(false);
	
	// Target angle inputs
	let targetAngles = $state({
		dc_elbow: 0,
		dc_wrist_pitch: 0,
		stepper_base_pan: 0,
		stepper_shoulder: 0,
		servo_wrist_roll: 90,
		servo_gripper: 45
	});
	
	// Auto-subscribe and start polling when ROS is connected
	$effect(() => {
		if ($isRosConnected && !$armSubscribed) {
			handleSubscribe();
		}
		
		return () => {
			if (pollingInterval) {
				stopArmTelemetryPolling(pollingInterval);
				pollingInterval = null;
			}
		};
	});
	
	async function handleSubscribe() {
		const result = await subscribeToArm();
		if (result.success) {
			// Start polling telemetry every 200ms
			pollingInterval = startArmTelemetryPolling(200);
		}
	}
	
	async function handleDrop() {
		try {
			const response = await dropPayload();
			console.log('Drop payload response:', response);
		} catch (error) {
			console.error('Failed to drop payload:', error);
		}
	}
	
	async function handleStop() {
		try {
			const response = await stopArm();
			console.log('Stop ARM response:', response);
		} catch (error) {
			console.error('Failed to stop ARM:', error);
		}
	}
	
	async function handleSendTarget() {
		try {
			const response = await sendArmTarget(targetAngles);
			console.log('Send target response:', response);
		} catch (error) {
			console.error('Failed to send target:', error);
		}
	}
	
	function formatAngle(angle: number): string {
		return angle?.toFixed(1) || '0.0';
	}
	
	// Type-safe accessor for telemetry data
	let telemetry = $derived($armTelemetry as any);
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<Card.Title class="flex items-center gap-2">
			{#if $armConnected}
				<Activity class="w-5 h-5 text-green-500" />
			{:else}
				<AlertCircle class="w-5 h-5 text-amber-500" />
			{/if}
			Robotic Arm
		</Card.Title>
	</Card.Header>
	
	<Card.Content class="space-y-3">
		<!-- Connection Status -->
		{#if !$isRosConnected}
			<div class="text-sm text-amber-500 flex items-center gap-2">
				<AlertCircle class="w-4 h-4" />
				Connect to ROS first
			</div>
		{:else if !$armSubscribed}
			<div class="text-sm text-muted-foreground">
				Connecting to ARM telemetry...
			</div>
		{:else if !$armConnected}
			<div class="text-sm text-muted-foreground">
				Waiting for telemetry data...
			</div>
		{:else}
			<!-- Telemetry Display -->
			<div class="space-y-3 text-sm">
				<!-- Stepper Motors -->
				<div class="space-y-1">
					<div class="font-medium text-xs text-muted-foreground uppercase">Steppers</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Base Pan</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.stepper?.base_pan)}°</div>
						</div>
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Shoulder</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.stepper?.shoulder)}°</div>
						</div>
					</div>
				</div>
				
				<!-- DC Motors -->
				<div class="space-y-1">
					<div class="font-medium text-xs text-muted-foreground uppercase">DC Motors</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Elbow</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.dc?.elbow)}°</div>
						</div>
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Wrist Pitch</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.dc?.wrist_pitch)}°</div>
						</div>
					</div>
				</div>
				
				<!-- Servos -->
				<div class="space-y-1">
					<div class="font-medium text-xs text-muted-foreground uppercase">Servos</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Wrist Roll</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.servo?.wrist_roll)}°</div>
						</div>
						<div class="bg-background/50 rounded p-2">
							<div class="text-xs text-muted-foreground">Gripper</div>
							<div class="font-mono text-foreground">{formatAngle(telemetry?.servo?.gripper)}°</div>
						</div>
					</div>
				</div>
				
				<!-- RC Channels (Collapsible) -->
				<details class="text-xs">
					<summary class="cursor-pointer text-muted-foreground hover:text-foreground">RC Channels</summary>
					<div class="mt-2 grid grid-cols-3 gap-1">
						{#each Object.entries(telemetry?.rc_channels || {}) as [channel, value]}
							<div class="bg-background/50 rounded px-2 py-1">
								<span class="text-muted-foreground">{channel}:</span>
								<span class="font-mono text-foreground ml-1">{value}</span>
							</div>
						{/each}
					</div>
				</details>
			</div>
		{/if}
		
		<!-- Control Buttons -->
		<div class="pt-3 border-t border-border space-y-2">
			<Button 
				variant="default"
				class="w-full"
				onclick={handleDrop}
				disabled={!$isRosConnected || $armLoading}
			>
				<Archive class="w-4 h-4 mr-2" />
				Drop Payload
			</Button>
			
			<Button 
				variant="destructive"
				class="w-full"
				onclick={handleStop}
				disabled={!$isRosConnected || $armLoading}
			>
				<StopCircle class="w-4 h-4 mr-2" />
				Emergency Stop
			</Button>
			
			<Button 
				variant="secondary"
				class="w-full"
				onclick={() => showTargetControls = !showTargetControls}
				disabled={!$isRosConnected}
			>
				<Target class="w-4 h-4 mr-2" />
				{showTargetControls ? 'Hide' : 'Show'} Target Controls
			</Button>
		</div>
		
		<!-- Target Controls (Expandable) -->
		{#if showTargetControls && $isRosConnected}
			<div class="pt-3 border-t border-border space-y-3">
				<div class="text-xs font-medium text-muted-foreground uppercase">Set Target Angles</div>
				
				<div class="space-y-2 text-sm">
					<!-- DC Motors -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Elbow (DC)</label>
							<input 
								type="number" 
								bind:value={targetAngles.dc_elbow}
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Wrist Pitch (DC)</label>
							<input 
								type="number" 
								bind:value={targetAngles.dc_wrist_pitch}
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
					</div>
					
					<!-- Steppers -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Base Pan (Stepper)</label>
							<input 
								type="number" 
								bind:value={targetAngles.stepper_base_pan}
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Shoulder (Stepper)</label>
							<input 
								type="number" 
								bind:value={targetAngles.stepper_shoulder}
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
					</div>
					
					<!-- Servos -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Wrist Roll (0-180)</label>
							<input 
								type="number" 
								bind:value={targetAngles.servo_wrist_roll}
								min="0"
								max="180"
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
						<div>
							<label class="text-xs text-muted-foreground block mb-1">Gripper (0-180)</label>
							<input 
								type="number" 
								bind:value={targetAngles.servo_gripper}
								min="0"
								max="180"
								step="1"
								class="w-full px-2 py-1 bg-background border border-border rounded text-xs"
							/>
						</div>
					</div>
				</div>
				
				<Button 
					variant="default"
					class="w-full"
					onclick={handleSendTarget}
					disabled={$armLoading}
				>
					<TrendingUp class="w-4 h-4 mr-2" />
					Send Target
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
