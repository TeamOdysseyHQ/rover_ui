<script lang="ts">
	import { Bot, ArrowUp, ArrowDown, RotateCcw, RotateCw, Move, Square } from 'lucide-svelte';
	import { isRosConnected, publishCmdVel, stopRover } from '$lib/stores/rosStore';
	import { logCommand } from '$lib/stores/apiStore';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { onMount, onDestroy } from 'svelte';
	
	// Props using $props rune
	let { onEmergencyStop = () => {}, onShowAutoModal = () => {} } = $props();
	
	// Twist keyboard control state
	let linearSpeed = $state(0.5);  // Current linear speed (m/s)
	let angularSpeed = $state(1.0); // Current angular speed (rad/s)
	let maxLinearSpeed = $state(1.0);
	let maxAngularSpeed = $state(2.0);
	
	// Current velocity state
	let currentLinearX = $state(0);
	let currentLinearY = $state(0);
	let currentLinearZ = $state(0);
	let currentAngularZ = $state(0);
	
	// Holonomic mode (shift key held)
	let holonomicMode = $state(false);
	
	// Active key display
	let activeKey = $state('');
	
	// Movement description
	let movementDesc = $state('Stopped');
	
	// Key bindings for teleop_twist_keyboard
	const moveBindings: Record<string, { x: number; y: number; z: number; th: number; desc: string }> = {
		// Normal mode keys
		'i': { x: 1, y: 0, z: 0, th: 0, desc: 'Forward' },
		'o': { x: 1, y: 0, z: 0, th: -1, desc: 'Forward + Turn Right' },
		'j': { x: 0, y: 0, z: 0, th: 1, desc: 'Turn Left' },
		'l': { x: 0, y: 0, z: 0, th: -1, desc: 'Turn Right' },
		'u': { x: 1, y: 0, z: 0, th: 1, desc: 'Forward + Turn Left' },
		',': { x: -1, y: 0, z: 0, th: 0, desc: 'Backward' },
		'.': { x: -1, y: 0, z: 0, th: 1, desc: 'Backward + Turn Left' },
		'm': { x: -1, y: 0, z: 0, th: -1, desc: 'Backward + Turn Right' },
		// Holonomic mode keys (uppercase/shifted)
		'I': { x: 1, y: 0, z: 0, th: 0, desc: 'Forward' },
		'O': { x: 1, y: -1, z: 0, th: 0, desc: 'Forward + Strafe Right' },
		'J': { x: 0, y: 1, z: 0, th: 0, desc: 'Strafe Left' },
		'L': { x: 0, y: -1, z: 0, th: 0, desc: 'Strafe Right' },
		'U': { x: 1, y: 1, z: 0, th: 0, desc: 'Forward + Strafe Left' },
		'<': { x: -1, y: 0, z: 0, th: 0, desc: 'Backward' },
		'>': { x: -1, y: -1, z: 0, th: 0, desc: 'Backward + Strafe Right' },
		'M': { x: -1, y: 1, z: 0, th: 0, desc: 'Backward + Strafe Left' },
		// Vertical movement
		't': { x: 0, y: 0, z: 1, th: 0, desc: 'Up (+Z)' },
		'b': { x: 0, y: 0, z: -1, th: 0, desc: 'Down (-Z)' },
	};
	
	// Speed adjustment bindings
	const speedBindings: Record<string, { linear: number; angular: number; desc: string }> = {
		'q': { linear: 1.1, angular: 1.1, desc: 'Speed +10%' },
		'z': { linear: 0.9, angular: 0.9, desc: 'Speed -10%' },
		'w': { linear: 1.1, angular: 1.0, desc: 'Linear +10%' },
		'x': { linear: 0.9, angular: 1.0, desc: 'Linear -10%' },
		'e': { linear: 1.0, angular: 1.1, desc: 'Angular +10%' },
		'c': { linear: 1.0, angular: 0.9, desc: 'Angular -10%' },
	};
	
	// Publish interval for continuous key holding
	let publishIntervalId: ReturnType<typeof setInterval> | null = null;
	const publishRate = 100; // ms
	
	// Helper to check if a key is active (case-insensitive for display)
	function isKeyActive(key: string): boolean {
		if (!activeKey) return false;
		return activeKey.toLowerCase() === key.toLowerCase() || 
			   (key === ',' && activeKey === '<') ||
			   (key === '.' && activeKey === '>');
	}
	
	function publishTwist() {
		if (!$isRosConnected) return;
		
		const twist = {
			linear: {
				x: currentLinearX * linearSpeed,
				y: currentLinearY * linearSpeed,
				z: currentLinearZ * linearSpeed
			},
			angular: {
				x: 0,
				y: 0,
				z: currentAngularZ * angularSpeed
			}
		};
		
		publishCmdVel(twist.linear.x, twist.angular.z);
		logCommand({ type: 'KEYBOARD_TWIST', data: twist }, 'sent');
	}
	
	function handleKeyDown(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}
		
		const key = e.key;
		
		// Track holonomic mode
		if (e.shiftKey) {
			holonomicMode = true;
		}
		
		// Check for movement keys
		if (key in moveBindings) {
			e.preventDefault();
			const binding = moveBindings[key];
			currentLinearX = binding.x;
			currentLinearY = binding.y;
			currentLinearZ = binding.z;
			currentAngularZ = binding.th;
			activeKey = key;
			movementDesc = binding.desc;
			
			// Start publishing if not already
			if (!publishIntervalId) {
				publishTwist();
				publishIntervalId = setInterval(publishTwist, publishRate);
			}
			return;
		}
		
		// Check for speed adjustment keys
		if (key in speedBindings) {
			e.preventDefault();
			const binding = speedBindings[key];
			linearSpeed = Math.min(maxLinearSpeed, Math.max(0.1, linearSpeed * binding.linear));
			angularSpeed = Math.min(maxAngularSpeed, Math.max(0.1, angularSpeed * binding.angular));
			
			// Round to 2 decimal places
			linearSpeed = Math.round(linearSpeed * 100) / 100;
			angularSpeed = Math.round(angularSpeed * 100) / 100;
			return;
		}
		
		// Stop key (k or K)
		if (key === 'k' || key === 'K') {
			e.preventDefault();
			stopMovement();
			activeKey = 'k';
			movementDesc = 'Stop';
			setTimeout(() => {
				if (activeKey === 'k') activeKey = '';
			}, 150);
			return;
		}
	}
	
	function handleKeyUp(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}
		
		const key = e.key;
		
		// Track holonomic mode
		if (key === 'Shift') {
			holonomicMode = false;
		}
		
		// Note: Movement keys do NOT stop on release - they set persistent state
		// Only 'K' key or explicit stop command will halt movement
	}
	
	function stopMovement() {
		currentLinearX = 0;
		currentLinearY = 0;
		currentLinearZ = 0;
		currentAngularZ = 0;
		activeKey = '';
		movementDesc = 'Stopped';
		
		if (publishIntervalId) {
			clearInterval(publishIntervalId);
			publishIntervalId = null;
		}
		
		// Send stop command
		if ($isRosConnected) {
			publishCmdVel(0, 0);
			logCommand({ type: 'KEYBOARD_STOP' }, 'sent');
		}
	}
	
	// Emergency stop via ROS
	async function handleEmergencyStop() {
		try {
			logCommand({ type: 'EMERGENCY_STOP' }, 'sent');
			stopMovement();
			const success = await stopRover();
			if (success) {
				logCommand({ type: 'EMERGENCY_STOP' }, 'success');
				onEmergencyStop('Emergency stop activated!', 'success');
			} else {
				throw new Error('Failed to stop rover');
			}
		} catch (error: any) {
			logCommand({ type: 'EMERGENCY_STOP' }, 'error', error.message);
			onEmergencyStop(`Emergency stop failed: ${error.message}`, 'error');
		}
	}
	
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
	});
	
	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
		if (publishIntervalId) {
			clearInterval(publishIntervalId);
		}
	});
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border pb-3">
		<div class="flex justify-between items-center">
			<Card.Title>Driving Controls</Card.Title>
			<div class="flex items-center gap-2">
				{#if $isRosConnected}
					<Badge variant="success" class="text-xs">ROS Connected</Badge>
				{:else}
					<Badge variant="warning" class="text-xs">ROS Disconnected</Badge>
				{/if}
				<Button variant="default" size="sm" onclick={onShowAutoModal}>
					<Bot class="w-4 h-4 mr-1" />Auto
				</Button>
			</div>
		</div>
	</Card.Header>
	
	<Card.Content class="p-4">
		<!-- Status Display -->
		<div class="status-bar">
			<div class="status-item">
				<span class="status-label">Status</span>
				<span class="status-value" class:active={activeKey !== ''}>{movementDesc}</span>
			</div>
			<div class="status-item">
				<span class="status-label">Mode</span>
				<span class="status-value">{holonomicMode ? 'Holonomic' : 'Normal'}</span>
			</div>
		</div>
		
		<!-- Main Keyboard Layout -->
		<div class="keyboard-layout">
			<!-- Movement Keys Section -->
			<div class="keyboard-section">
				<div class="section-header">
					<Move class="w-3 h-3" />
					<span>Movement</span>
				</div>
				
				<div class="key-grid movement-grid">
					<!-- Row 1: U I O -->
					<button class="key" class:active={isKeyActive('u')} title="Forward + Turn Left">
						<span class="key-label">U</span>
						<span class="key-icon">&#8598;</span>
					</button>
					<button class="key" class:active={isKeyActive('i')} title="Forward">
						<span class="key-label">I</span>
						<span class="key-icon">&#8593;</span>
					</button>
					<button class="key" class:active={isKeyActive('o')} title="Forward + Turn Right">
						<span class="key-label">O</span>
						<span class="key-icon">&#8599;</span>
					</button>
					
					<!-- Row 2: J K L -->
					<button class="key" class:active={isKeyActive('j')} title="Turn Left">
						<span class="key-label">J</span>
						<span class="key-icon"><RotateCcw class="w-3 h-3" /></span>
					</button>
					<button class="key stop-key" class:active={isKeyActive('k')} title="Stop">
						<span class="key-label">K</span>
						<span class="key-icon"><Square class="w-3 h-3" /></span>
					</button>
					<button class="key" class:active={isKeyActive('l')} title="Turn Right">
						<span class="key-label">L</span>
						<span class="key-icon"><RotateCw class="w-3 h-3" /></span>
					</button>
					
					<!-- Row 3: M , . -->
					<button class="key" class:active={isKeyActive('m')} title="Backward + Turn Right">
						<span class="key-label">M</span>
						<span class="key-icon">&#8601;</span>
					</button>
					<button class="key" class:active={isKeyActive(',')} title="Backward">
						<span class="key-label">,</span>
						<span class="key-icon">&#8595;</span>
					</button>
					<button class="key" class:active={isKeyActive('.')} title="Backward + Turn Left">
						<span class="key-label">.</span>
						<span class="key-icon">&#8600;</span>
					</button>
				</div>
				
				<div class="mode-hint">
					{#if holonomicMode}
						<Badge variant="default" class="text-xs">Shift Held - Strafing</Badge>
					{:else}
						<span class="hint-text">Hold Shift for strafe</span>
					{/if}
				</div>
			</div>
			
			<!-- Vertical & Speed Section -->
			<div class="keyboard-section">
				<!-- Vertical Control -->
				<div class="sub-section">
					<div class="section-header">
						<ArrowUp class="w-3 h-3" />
						<span>Vertical</span>
					</div>
					<div class="key-row vertical-keys">
						<button class="key small" class:active={isKeyActive('t')} title="Up (+Z)">
							<span class="key-label">T</span>
							<span class="key-hint">Up</span>
						</button>
						<button class="key small" class:active={isKeyActive('b')} title="Down (-Z)">
							<span class="key-label">B</span>
							<span class="key-hint">Down</span>
						</button>
					</div>
				</div>
				
				<!-- Speed Control -->
				<div class="sub-section">
					<div class="section-header">
						<span>Speed Control</span>
					</div>
					<div class="speed-keys">
						<div class="speed-key-row">
							<button class="key tiny">Q</button>
							<button class="key tiny">Z</button>
							<span class="key-desc">All ±10%</span>
						</div>
						<div class="speed-key-row">
							<button class="key tiny">W</button>
							<button class="key tiny">X</button>
							<span class="key-desc">Linear ±10%</span>
						</div>
						<div class="speed-key-row">
							<button class="key tiny">E</button>
							<button class="key tiny">C</button>
							<span class="key-desc">Angular ±10%</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Speed Display -->
		<div class="speed-display">
			<div class="speed-bar">
				<div class="speed-info">
					<span class="speed-label">Linear</span>
					<span class="speed-value">{linearSpeed.toFixed(2)}</span>
					<span class="speed-unit">m/s</span>
				</div>
				<div class="speed-bar-track">
					<div 
						class="speed-bar-fill" 
						style="width: {(linearSpeed / maxLinearSpeed) * 100}%"
					></div>
				</div>
			</div>
			<div class="speed-bar">
				<div class="speed-info">
					<span class="speed-label">Angular</span>
					<span class="speed-value">{angularSpeed.toFixed(2)}</span>
					<span class="speed-unit">rad/s</span>
				</div>
				<div class="speed-bar-track">
					<div 
						class="speed-bar-fill angular" 
						style="width: {(angularSpeed / maxAngularSpeed) * 100}%"
					></div>
				</div>
			</div>
		</div>
		
		<!-- Emergency Stop -->
		<button class="emergency-stop" onclick={handleEmergencyStop}>
			Emergency Stop
		</button>
	</Card.Content>
</Card.Root>

<style>
	.status-bar {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem;
		background: var(--slate-800);
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}
	
	.status-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	
	.status-label {
		font-size: 0.625rem;
		color: var(--slate-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	
	.status-value {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--slate-300);
	}
	
	.status-value.active {
		color: var(--sky-light);
	}
	
	.keyboard-layout {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}
	
	.keyboard-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--slate-400);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	
	.key-grid {
		display: grid;
		gap: 0.25rem;
	}
	
	.movement-grid {
		grid-template-columns: repeat(3, 1fr);
	}
	
	.key {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		padding: 0.5rem;
		min-width: 3rem;
		min-height: 3rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		cursor: default;
		transition: all 0.1s ease;
		color: var(--slate-400);
	}
	
	.key:hover {
		background: var(--slate-700);
		border-color: var(--slate-600);
	}
	
	.key.active {
		background: var(--sky-blue);
		border-color: var(--sky-light);
		color: white;
	}
	
	.key.stop-key {
		background: var(--slate-900);
		border-color: var(--slate-600);
	}
	
	.key.stop-key.active {
		background: var(--red);
		border-color: var(--red);
	}
	
	.key.small {
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0.375rem;
	}
	
	.key.tiny {
		min-width: 1.75rem;
		min-height: 1.5rem;
		padding: 0.25rem;
		font-size: 0.625rem;
	}
	
	.key-label {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 600;
	}
	
	.key-icon {
		font-size: 0.75rem;
		opacity: 0.7;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.key-hint {
		font-size: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}
	
	.mode-hint {
		display: flex;
		justify-content: center;
		margin-top: 0.25rem;
	}
	
	.hint-text {
		font-size: 0.625rem;
		color: var(--slate-500);
	}
	
	.sub-section {
		margin-bottom: 0.75rem;
	}
	
	.key-row {
		display: flex;
		gap: 0.25rem;
	}
	
	.vertical-keys {
		margin-top: 0.375rem;
	}
	
	.speed-keys {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}
	
	.speed-key-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	
	.key-desc {
		font-size: 0.625rem;
		color: var(--slate-500);
		margin-left: 0.25rem;
	}
	
	.speed-display {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--slate-800);
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}
	
	.speed-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	
	.speed-info {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		min-width: 7rem;
	}
	
	.speed-label {
		font-size: 0.625rem;
		color: var(--slate-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: 3.5rem;
	}
	
	.speed-value {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--sky-light);
	}
	
	.speed-unit {
		font-size: 0.625rem;
		color: var(--slate-500);
	}
	
	.speed-bar-track {
		flex: 1;
		height: 0.375rem;
		background: var(--slate-700);
		border-radius: 0.1875rem;
		overflow: hidden;
	}
	
	.speed-bar-fill {
		height: 100%;
		background: var(--sky-blue);
		border-radius: 0.1875rem;
		transition: width 0.15s ease;
	}
	
	.speed-bar-fill.angular {
		background: var(--green);
	}
	
	.emergency-stop {
		width: 100%;
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--red);
		border-radius: 0.375rem;
		color: var(--red);
		font-weight: 600;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.emergency-stop:hover {
		background: var(--red);
		color: white;
	}
</style>
