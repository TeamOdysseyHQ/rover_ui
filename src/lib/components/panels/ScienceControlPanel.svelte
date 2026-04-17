<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import {
		ChevronUp,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		RotateCw,
		RotateCcw,
		StopCircle,
		Grip,
		Activity,
		AlertTriangle
	} from 'lucide-svelte';
	import {
		enableScienceMode,
		sendLinearActuatorCmd,
		sendDrillCmd,
		sendBarrelCmd,
		toggleServo,
		getDrillData,
		getScienceWarnings
	} from '$lib/services/roverApi';

	// Props
	let { scienceModeEnabled = $bindable(false) }: { scienceModeEnabled?: boolean } = $props();

	// State
	let linearActuatorStep = $state<0 | 4 | 8 | 16>(0); // Full step by default
	let barrelStep = $state<0 | 4 | 8 | 16>(0);
	let servoToggled = $state(false);
	let drillHalted = $state(true);
	let distanceMm = $state<number | null>(null);
	let warningMessage = $state<string>('None');
	let isLoading = $state(false);
	let statusMessage = $state('');

	// Polling interval
	let pollInterval: number | null = null;

	// Toggle science mode
	async function handleScienceModeToggle() {
		isLoading = true;
		try {
			const result = await enableScienceMode(!scienceModeEnabled);
			if (result.success) {
				scienceModeEnabled = !scienceModeEnabled;
				setStatus(`Science mode ${scienceModeEnabled ? 'enabled' : 'disabled'}`);

				if (scienceModeEnabled) {
					startPolling();
				} else {
					stopPolling();
				}
			} else {
				setStatus(`Failed: ${result.message}`);
			}
		} catch (error) {
			setStatus('Error toggling science mode');
			console.error(error);
		} finally {
			isLoading = false;
		}
	}

	// Linear actuator controls
	async function moveLinearActuator(direction: 'up' | 'down') {
		const cmd = direction === 'up' ? 1 : -1;
		try {
			const result = await sendLinearActuatorCmd(cmd);
			if (result.success) {
				setStatus(`Linear actuator: ${direction}`);
			}
		} catch (error) {
			setStatus('Error sending command');
			console.error(error);
		}
	}

	async function setLinearActuatorStep(step: 0 | 4 | 8 | 16) {
		linearActuatorStep = step;
		try {
			await sendLinearActuatorCmd(step);
			setStatus(`Linear actuator step: ${step === 0 ? 'Full' : `1/${step}`}`);
		} catch (error) {
			console.error(error);
		}
	}

	// Drill controls
	async function changeDrillSpeed(direction: 'increase' | 'decrease') {
		const cmd = direction === 'increase' ? 1 : -1;
		try {
			const result = await sendDrillCmd(cmd);
			if (result.success) {
				setStatus(`Drill speed: ${direction}`);
			}
		} catch (error) {
			setStatus('Error sending command');
			console.error(error);
		}
	}

	async function changeDrillDirection(direction: 'cw' | 'ccw') {
		const cmd = direction === 'cw' ? -2 : 2;
		try {
			const result = await sendDrillCmd(cmd);
			if (result.success) {
				setStatus(`Drill direction: ${direction.toUpperCase()}`);
			}
		} catch (error) {
			setStatus('Error sending command');
			console.error(error);
		}
	}

	async function stopDrill() {
		try {
			const result = await sendDrillCmd(0);
			if (result.success) {
				setStatus('Drill stopped');
			}
		} catch (error) {
			setStatus('Error stopping drill');
			console.error(error);
		}
	}

	// Barrel controls
	async function rotateBarrel() {
		try {
			const result = await sendBarrelCmd(1);
			if (result.success) {
				setStatus('Barrel rotating 60°');
			}
		} catch (error) {
			setStatus('Error rotating barrel');
			console.error(error);
		}
	}

	async function setBarrelStep(step: 0 | 4 | 8 | 16) {
		barrelStep = step;
		try {
			await sendBarrelCmd(step);
			setStatus(`Barrel step: ${step === 0 ? 'Full' : `1/${step}`}`);
		} catch (error) {
			console.error(error);
		}
	}

	// Servo controls
	async function handleServoToggle() {
		servoToggled = !servoToggled;
		try {
			const result = await toggleServo(servoToggled);
			if (result.success) {
				setStatus(`Servo: ${servoToggled ? 'On' : 'Off'}`);
			}
		} catch (error) {
			setStatus('Error toggling servo');
			console.error(error);
		}
	}

	// Polling for telemetry
	async function pollTelemetry() {
		try {
			const [drillResult, warningResult] = await Promise.all([
				getDrillData(),
				getScienceWarnings()
			]);

			if (drillResult.success && drillResult.data) {
				drillHalted = drillResult.data.drill_halted;
				distanceMm = drillResult.data.distance_mm;
			}

			if (warningResult.success && warningResult.data) {
				warningMessage = warningResult.data.warning_message || 'None';
			}
		} catch (error) {
			console.error('Error polling telemetry:', error);
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollTelemetry(); // Immediate fetch
		pollInterval = window.setInterval(pollTelemetry, 2000); // Every 2 seconds
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function setStatus(message: string) {
		statusMessage = message;
		setTimeout(() => {
			statusMessage = '';
		}, 3000);
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			stopPolling();
		};
	});

	// Auto-poll if science mode is enabled
	$effect(() => {
		if (scienceModeEnabled) {
			startPolling();
		} else {
			stopPolling();
		}
	});
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<Card.Title>Science Module Control</Card.Title>
			<div class="flex items-center gap-2">
				<span class="text-sm text-slate-400">Enable</span>
				<Switch checked={scienceModeEnabled} onCheckedChange={handleScienceModeToggle} disabled={isLoading} />
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4 pt-4">
		{#if !scienceModeEnabled}
			<div class="empty-state">
				<Activity class="w-8 h-8 text-slate-600" />
				<span class="text-sm text-slate-400">Science mode is disabled</span>
			</div>
		{:else}
			<!-- Linear Actuator Section -->
			<div class="control-section">
				<h3 class="section-title">Linear Actuator</h3>
				<div class="control-grid">
					<div class="button-group">
						<Button variant="outline" size="sm" onclick={() => moveLinearActuator('up')}>
							<ChevronUp class="w-4 h-4" />
						</Button>
						<Button variant="outline" size="sm" onclick={() => moveLinearActuator('down')}>
							<ChevronDown class="w-4 h-4" />
						</Button>
					</div>
					<div class="step-selector">
						<span class="text-xs text-slate-400">Step:</span>
						<div class="step-buttons">
							<Button
								variant={linearActuatorStep === 0 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setLinearActuatorStep(0)}
							>
								Full
							</Button>
							<Button
								variant={linearActuatorStep === 4 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setLinearActuatorStep(4)}
							>
								1/4
							</Button>
							<Button
								variant={linearActuatorStep === 8 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setLinearActuatorStep(8)}
							>
								1/8
							</Button>
							<Button
								variant={linearActuatorStep === 16 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setLinearActuatorStep(16)}
							>
								1/16
							</Button>
						</div>
					</div>
				</div>
			</div>

			<!-- Drill Motor Section -->
			<div class="control-section">
				<h3 class="section-title">Drill Motor</h3>
				<div class="control-grid">
					<div class="button-group">
						<Button variant="outline" size="sm" onclick={() => changeDrillSpeed('decrease')}>
							<ChevronLeft class="w-4 h-4" />
						</Button>
						<span class="text-xs text-slate-400">Speed</span>
						<Button variant="outline" size="sm" onclick={() => changeDrillSpeed('increase')}>
							<ChevronRight class="w-4 h-4" />
						</Button>
					</div>
					<div class="button-group">
						<Button variant="outline" size="sm" onclick={() => changeDrillDirection('cw')}>
							<RotateCw class="w-4 h-4 mr-1" />
							CW
						</Button>
						<Button variant="outline" size="sm" onclick={() => changeDrillDirection('ccw')}>
							<RotateCcw class="w-4 h-4 mr-1" />
							CCW
						</Button>
						<Button variant="destructive" size="sm" onclick={stopDrill}>
							<StopCircle class="w-4 h-4 mr-1" />
							Stop
						</Button>
					</div>
				</div>
			</div>

			<!-- Barrel Motor Section -->
			<div class="control-section">
				<h3 class="section-title">Barrel Motor</h3>
				<div class="control-grid">
					<Button variant="outline" onclick={rotateBarrel}>
						<Grip class="w-4 h-4 mr-2" />
						Rotate 60°
					</Button>
					<div class="step-selector">
						<span class="text-xs text-slate-400">Step:</span>
						<div class="step-buttons">
							<Button
								variant={barrelStep === 0 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setBarrelStep(0)}
							>
								Full
							</Button>
							<Button
								variant={barrelStep === 4 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setBarrelStep(4)}
							>
								1/4
							</Button>
							<Button
								variant={barrelStep === 8 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setBarrelStep(8)}
							>
								1/8
							</Button>
							<Button
								variant={barrelStep === 16 ? 'default' : 'ghost'}
								size="sm"
								onclick={() => setBarrelStep(16)}
							>
								1/16
							</Button>
						</div>
					</div>
				</div>
			</div>

			<!-- PH Servo Section -->
			<div class="control-section">
				<h3 class="section-title">PH Servo</h3>
				<Button variant="outline" onclick={handleServoToggle}>
					Toggle Position
					<Badge variant={servoToggled ? 'success' : 'secondary'} class="ml-2">
						{servoToggled ? 'On' : 'Off'}
					</Badge>
				</Button>
			</div>

			<!-- Status Section -->
			<div class="status-section">
				<div class="status-item">
					<span class="status-label">Drill Status:</span>
					<Badge variant={drillHalted ? 'secondary' : 'success'}>
						{drillHalted ? 'Halted' : 'Running'}
					</Badge>
				</div>
				<div class="status-item">
					<span class="status-label">Distance:</span>
					<span class="status-value">{distanceMm !== null ? `${distanceMm} mm` : 'N/A'}</span>
				</div>
				<div class="status-item">
					<span class="status-label">Warning:</span>
					<span class="status-value">{warningMessage}</span>
				</div>
			</div>

			{#if statusMessage}
				<div class="status-message">
					{statusMessage}
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		gap: 0.75rem;
	}

	.control-section {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.5rem;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--slate-300);
		margin-bottom: 0.75rem;
	}

	.control-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.button-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.step-selector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.step-buttons {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.status-section {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.status-label {
		color: var(--slate-400);
		font-weight: 500;
	}

	.status-value {
		color: var(--slate-300);
		font-family: monospace;
	}

	.status-message {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--sky-blue);
		border-radius: 0.375rem;
		text-align: center;
		font-size: 0.875rem;
		color: var(--sky-blue);
		font-weight: 500;
	}
</style>
