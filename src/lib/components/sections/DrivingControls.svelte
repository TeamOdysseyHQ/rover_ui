<script lang="ts">
	import { Bot, ArrowUp, ArrowDown, RotateCcw, RotateCw, Move, Square, Cpu, Wifi } from 'lucide-svelte';
	import { isRosConnected, publishCmdVel, stopRover } from '$lib/stores/rosStore';
	import { logCommand } from '$lib/stores/apiStore';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { onMount, onDestroy } from 'svelte';
	import { 
		connectArduino, 
		disconnectArduino, 
		getArduinoStatus, 
		sendArduinoCommand, 
		stopArduino 
	} from '$lib/services/roverApi';
	
	// Props using $props rune
	let { onEmergencyStop = () => {}, onShowAutoModal = () => {} } = $props();
	
	// Control mode: 'ros' or 'arduino'
	let controlMode = $state<'ros' | 'arduino'>('ros');
	
	// Arduino connection state
	let arduinoConnected = $state(false);
	let arduinoCheckInterval: ReturnType<typeof setInterval> | null = null;
	
	// Arduino speed control (0-255)
	let arduinoSpeed = $state(0);  // Current speed
	const maxArduinoSpeed = 255;
	const arduinoSpeedStep = 5;
	let arduinoSpeedInterval: ReturnType<typeof setInterval> | null = null;
	let activeArduinoKey = $state('');  // Track which key is held
	
	// Arduino key mapping for speed control
	const arduinoSpeedKeys: Record<string, string> = {
		'w': 'w',  // Forward (lowercase)
		's': 's',  // Backward (lowercase)
		'a': 'a',  // Left (lowercase)
		'd': 'd',  // Right (lowercase)
	};
	
	// Arduino camera control (ijkl - lowercase)
	const arduinoCameraKeys: Record<string, string> = {
		'i': 'i',  // Camera up
		'j': 'j',  // Camera left
		'k': 'k',  // Camera center/stop
		'l': 'l',  // Camera right
	};
	
	// ROS Mode: Discrete step velocity control (-1.0 to 1.0 in steps of 0.05)
	let linearVelocity = $state(0.0);   // Current discrete linear velocity
	let angularVelocity = $state(0.0);  // Current discrete angular velocity
	const velocityStep = 0.05;          // Step size for velocity increments
	const minVelocity = -1.0;           // Minimum velocity
	const maxVelocity = 1.0;            // Maximum velocity
	
	// Key hold state for WASD
	let activeRosKeys = $state(new Set());
	let rosKeyIntervals = new Map(); // Track intervals for each key
	
	// Movement description
	let movementDesc = $state('Stopped');
	
	// ROS Mode: WASD key mappings for discrete velocity control
	const rosWasdKeys: Record<string, { type: 'linear' | 'angular'; direction: 1 | -1; desc: string }> = {
		'w': { type: 'linear', direction: 1, desc: 'Forward' },
		's': { type: 'linear', direction: -1, desc: 'Backward' },
		'a': { type: 'angular', direction: 1, desc: 'Turn Left' },
		'd': { type: 'angular', direction: -1, desc: 'Turn Right' },
	};
	
	// Publish interval for continuous velocity publishing
	let rosPublishInterval: ReturnType<typeof setInterval> | null = null;
	const publishRate = 100; // ms
	const stepInterval = 150; // ms between velocity step increments
	
	// Helper to clamp velocity to valid range and quantize to step size
	function quantizeVelocity(value: number): number {
		const clamped = Math.max(minVelocity, Math.min(maxVelocity, value));
		return Math.round(clamped / velocityStep) * velocityStep;
	}
	
	// Helper to check if a ROS WASD key is active
	function isRosKeyActive(key: string): boolean {
		return activeRosKeys.has(key.toLowerCase());
	}
	
	// Update movement description based on current velocities
	function updateMovementDescription() {
		if (linearVelocity === 0 && angularVelocity === 0) {
			movementDesc = 'Stopped';
		} else {
			const parts: string[] = [];
			if (linearVelocity > 0) parts.push('Forward');
			else if (linearVelocity < 0) parts.push('Backward');
			
			if (angularVelocity > 0) parts.push('Left');
			else if (angularVelocity < 0) parts.push('Right');
			
			movementDesc = parts.join(' + ');
		}
	}
	
	// Publish ROS twist message with current velocities
	function publishRosTwist() {
		if (!$isRosConnected) return;
		
		publishCmdVel(linearVelocity, angularVelocity);
		logCommand({ 
			type: 'WASD_VELOCITY', 
			data: { linear: linearVelocity, angular: angularVelocity } 
		}, 'sent');
	}
	
	// Increment velocity in discrete steps
	function incrementVelocity(type: 'linear' | 'angular', direction: 1 | -1) {
		if (type === 'linear') {
			linearVelocity = quantizeVelocity(linearVelocity + direction * velocityStep);
		} else {
			angularVelocity = quantizeVelocity(angularVelocity + direction * velocityStep);
		}
		updateMovementDescription();
	}
	
	// Arduino mode: Check connection status periodically
	async function checkArduinoConnection() {
		try {
			const status = await getArduinoStatus();
			arduinoConnected = status.connected || false;
		} catch (error) {
			arduinoConnected = false;
		}
	}
	
	// Arduino mode: Increase speed gradually
	function increaseArduinoSpeed() {
		if (arduinoSpeed < maxArduinoSpeed) {
			arduinoSpeed = Math.min(maxArduinoSpeed, arduinoSpeed + arduinoSpeedStep);
			sendArduinoSpeedCommand();
		}
	}
	
	// Arduino mode: Send speed command with direction
	async function sendArduinoSpeedCommand() {
		if (!arduinoConnected || !activeArduinoKey) return;
		
		const direction = activeArduinoKey.toLowerCase();
		const speedValue = arduinoSpeed;
		
		try {
			// Send command as: "w:255" or "s:120", etc.
			const command = `${direction}:${speedValue}`;
			await sendArduinoCommand(command);
			logCommand({ type: 'ARDUINO_SPEED', data: { direction, speed: speedValue } }, 'sent');
			
			// Update movement description
			const descriptions: Record<string, string> = {
				'w': 'Forward',
				's': 'Backward',
				'a': 'Left',
				'd': 'Right'
			};
			movementDesc = `${descriptions[direction] || 'Moving'} (${speedValue})`;
		} catch (error: any) {
			console.error('Arduino speed command failed:', error);
			logCommand({ type: 'ARDUINO_SPEED', data: { direction, speed: speedValue } }, 'error', error.message);
		}
	}
	
	// Arduino mode: Send camera command (ijkl)
	async function sendArduinoCameraCommand(key: string) {
		if (!arduinoConnected) return;
		
		try {
			await sendArduinoCommand(key);
			logCommand({ type: 'ARDUINO_CAMERA', data: { key } }, 'sent');
			
			const descriptions: Record<string, string> = {
				'i': 'Camera Up',
				'j': 'Camera Left',
				'k': 'Camera Center',
				'l': 'Camera Right'
			};
			console.log(`Camera: ${descriptions[key] || key}`);
		} catch (error: any) {
			console.error('Arduino camera command failed:', error);
			logCommand({ type: 'ARDUINO_CAMERA', data: { key } }, 'error', error.message);
		}
	}
	
	// Arduino mode: Stop all movement
	async function stopArduinoMovement() {
		arduinoSpeed = 0;
		activeArduinoKey = '';
		movementDesc = 'Stopped';
		
		if (arduinoSpeedInterval) {
			clearInterval(arduinoSpeedInterval);
			arduinoSpeedInterval = null;
		}
		
		try {
			// Send stop command (speed 0)
			await sendArduinoCommand('x:0');
			logCommand({ type: 'ARDUINO_STOP' }, 'sent');
		} catch (error: any) {
			console.error('Arduino stop failed:', error);
		}
	}
	
	// Toggle control mode
	async function toggleControlMode() {
		const newMode = controlMode === 'ros' ? 'arduino' : 'ros';
		
		if (newMode === 'arduino') {
			// Connect to Arduino
			try {
				await connectArduino();
				await checkArduinoConnection();
				if (arduinoConnected) {
					controlMode = 'arduino';
					stopMovement(); // Stop ROS movements
					arduinoSpeed = 0;
					activeArduinoKey = '';
					movementDesc = 'Stopped';
					logCommand({ type: 'MODE_SWITCH', data: { mode: 'arduino' } }, 'sent');
				} else {
					throw new Error('Arduino not connected');
				}
			} catch (error: any) {
				onEmergencyStop(`Failed to connect to Arduino: ${error.message}`, 'error');
			}
		} else {
			// Switch back to ROS
			try {
				await stopArduinoMovement();
				await disconnectArduino();
				controlMode = 'ros';
				arduinoConnected = false;
				logCommand({ type: 'MODE_SWITCH', data: { mode: 'ros' } }, 'sent');
			} catch (error: any) {
				onEmergencyStop(`Failed to disconnect Arduino: ${error.message}`, 'error');
			}
		}
	}
	
	function handleKeyDown(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}
		
		const key = e.key.toLowerCase();
		
		// Arduino mode: Speed control (wasd) and camera control (ijkl)
		if (controlMode === 'arduino') {
			// Speed control: lowercase wasd
			if (key in arduinoSpeedKeys) {
				e.preventDefault();
				
				// Start speed ramping if not already active
				if (!activeArduinoKey || activeArduinoKey !== key) {
					activeArduinoKey = key;
					arduinoSpeed = arduinoSpeedStep; // Start at minimum speed
					sendArduinoSpeedCommand();
					
					// Start interval to increase speed while key is held
					if (arduinoSpeedInterval) {
						clearInterval(arduinoSpeedInterval);
					}
					arduinoSpeedInterval = setInterval(() => {
						increaseArduinoSpeed();
					}, 100); // Increase speed every 100ms
				}
				return;
			}
			
			// Camera control: lowercase ijkl
			if (key in arduinoCameraKeys) {
				e.preventDefault();
				sendArduinoCameraCommand(key);
				return;
			}
			
			// Stop key (spacebar or x)
			if (key === ' ' || key === 'x') {
				e.preventDefault();
				stopArduinoMovement();
				return;
			}
			return; // Ignore other keys in Arduino mode
		}
		
		// ROS mode: WASD velocity control
		// Check for WASD movement keys
		if (key in rosWasdKeys) {
			e.preventDefault();
			
			// Start velocity ramping if not already active for this key
			if (!activeRosKeys.has(key)) {
				activeRosKeys.add(key);
				const keyConfig = rosWasdKeys[key];
				
				// Immediately increment once
				incrementVelocity(keyConfig.type, keyConfig.direction);
				
				// Start interval to continue incrementing while held
				const intervalId = setInterval(() => {
					incrementVelocity(keyConfig.type, keyConfig.direction);
				}, stepInterval);
				
				rosKeyIntervals.set(key, intervalId);
				
				// Start continuous publishing if not already running
				if (!rosPublishInterval) {
					rosPublishInterval = setInterval(publishRosTwist, publishRate);
				}
			}
			return;
		}
		
		// Stop key (spacebar)
		if (key === ' ') {
			e.preventDefault();
			stopRosMovement();
			return;
		}
	}
	
	function handleKeyUp(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}
		
		const key = e.key.toLowerCase();
		
		// Arduino mode: Stop speed ramping when key is released
		if (controlMode === 'arduino') {
			if (key in arduinoSpeedKeys && key === activeArduinoKey) {
				// Stop increasing speed, but maintain current speed
				if (arduinoSpeedInterval) {
					clearInterval(arduinoSpeedInterval);
					arduinoSpeedInterval = null;
				}
				// Keep the speed at current level until stop is pressed
			}
			return;
		}
		
		// ROS mode: Stop velocity ramping for this key
		if (key in rosWasdKeys && activeRosKeys.has(key)) {
			activeRosKeys.delete(key);
			
			// Clear the interval for this key
			const intervalId = rosKeyIntervals.get(key);
			if (intervalId) {
				clearInterval(intervalId);
				rosKeyIntervals.delete(key);
			}
			
			// If no keys are held and velocity is zero, stop publishing
			if (activeRosKeys.size === 0 && linearVelocity === 0 && angularVelocity === 0) {
				if (rosPublishInterval) {
					clearInterval(rosPublishInterval);
					rosPublishInterval = null;
				}
			}
		}
	}
	
	// Stop ROS movement (set velocities to zero)
	function stopRosMovement() {
		linearVelocity = 0;
		angularVelocity = 0;
		activeRosKeys.clear();
		movementDesc = 'Stopped';
		
		// Clear all key intervals
		for (const intervalId of rosKeyIntervals.values()) {
			clearInterval(intervalId);
		}
		rosKeyIntervals.clear();
		
		// Stop publishing interval
		if (rosPublishInterval) {
			clearInterval(rosPublishInterval);
			rosPublishInterval = null;
		}
		
		// Send stop command
		if ($isRosConnected) {
			publishCmdVel(0, 0);
			logCommand({ type: 'WASD_STOP' }, 'sent');
		}
	}
	
	// Legacy stopMovement for compatibility (calls stopRosMovement)
	function stopMovement() {
		stopRosMovement();
	}
	
	// Emergency stop via ROS or Arduino
	async function handleEmergencyStop() {
		try {
			logCommand({ type: 'EMERGENCY_STOP' }, 'sent');
			
			if (controlMode === 'arduino') {
				// Arduino mode: stop all movement
				await stopArduinoMovement();
				await stopArduino();
			} else {
				// ROS mode: stop all movement
				stopRosMovement();
				const success = await stopRover();
				if (!success) {
					throw new Error('Failed to stop rover');
				}
			}
			
			logCommand({ type: 'EMERGENCY_STOP' }, 'success');
			onEmergencyStop('Emergency stop activated!', 'success');
		} catch (error: any) {
			logCommand({ type: 'EMERGENCY_STOP' }, 'error', error.message);
			onEmergencyStop(`Emergency stop failed: ${error.message}`, 'error');
		}
	}
	
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		
		// Check Arduino status periodically when in Arduino mode
		arduinoCheckInterval = setInterval(() => {
			if (controlMode === 'arduino') {
				checkArduinoConnection();
			}
		}, 5000);
	});
	
	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
		
		// Clean up ROS intervals
		if (rosPublishInterval) {
			clearInterval(rosPublishInterval);
		}
		for (const intervalId of rosKeyIntervals.values()) {
			clearInterval(intervalId);
		}
		
		// Clean up Arduino intervals
		if (arduinoCheckInterval) {
			clearInterval(arduinoCheckInterval);
		}
		if (arduinoSpeedInterval) {
			clearInterval(arduinoSpeedInterval);
		}
		
		// Disconnect Arduino on unmount if connected
		if (controlMode === 'arduino' && arduinoConnected) {
			stopArduinoMovement().catch(console.error);
			disconnectArduino().catch(console.error);
		}
	});
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border pb-3">
		<div class="flex justify-between items-center">
			<Card.Title>Driving Controls</Card.Title>
			<div class="flex items-center gap-2">
				<!-- Mode Toggle Button -->
				<Button 
					variant={controlMode === 'arduino' ? 'default' : 'outline'} 
					size="sm" 
					onclick={toggleControlMode}
				>
					{#if controlMode === 'arduino'}
						<Cpu class="w-4 h-4 mr-1" />Arduino
					{:else}
						<Wifi class="w-4 h-4 mr-1" />ROS
					{/if}
				</Button>
				
				<!-- Connection Status -->
				{#if controlMode === 'ros'}
					{#if $isRosConnected}
						<Badge variant="success" class="text-xs">ROS Connected</Badge>
					{:else}
						<Badge variant="warning" class="text-xs">ROS Disconnected</Badge>
					{/if}
				{:else}
					{#if arduinoConnected}
						<Badge variant="success" class="text-xs">Arduino Connected</Badge>
					{:else}
						<Badge variant="warning" class="text-xs">Arduino Disconnected</Badge>
					{/if}
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
				<span class="status-label">Mode</span>
				<span class="status-value mode-value">
					{controlMode === 'arduino' ? 'Arduino (wasd/ijkl)' : 'ROS (WASD)'}
				</span>
			</div>
			<div class="status-item">
				<span class="status-label">Status</span>
				<span class="status-value" class:active={activeRosKeys.size > 0 || activeArduinoKey !== ''}>
					{movementDesc}
				</span>
			</div>
			{#if controlMode === 'arduino'}
			<div class="status-item">
				<span class="status-label">Speed</span>
				<span class="status-value speed-value">{arduinoSpeed} / {maxArduinoSpeed}</span>
			</div>
			{:else}
			<div class="status-item">
				<span class="status-label">Linear</span>
				<span class="status-value speed-value">{linearVelocity.toFixed(2)} m/s</span>
			</div>
			<div class="status-item">
				<span class="status-label">Angular</span>
				<span class="status-value speed-value">{angularVelocity.toFixed(2)} rad/s</span>
			</div>
			{/if}
		</div>
		
		<!-- Arduino Mode: Speed Controls (wasd) and Camera Controls (ijkl) -->
		{#if controlMode === 'arduino'}
		<div class="arduino-layout">
			<!-- Speed Control Section -->
			<div class="keyboard-section">
				<div class="section-header">
					<Cpu class="w-3 h-3" />
					<span>Speed Control (wasd)</span>
				</div>
				
				<div class="key-grid wasd-grid">
					<!-- Row 1: W -->
					<div></div>
					<button class="key" class:active={activeArduinoKey === 'w'} title="Forward (hold to increase speed)">
						<span class="key-label">W</span>
						<span class="key-icon">&#8593;</span>
					</button>
					<div></div>
					
					<!-- Row 2: A S D -->
					<button class="key" class:active={activeArduinoKey === 'a'} title="Left (hold to increase speed)">
						<span class="key-label">A</span>
						<span class="key-icon">&#8592;</span>
					</button>
					<button class="key" class:active={activeArduinoKey === 's'} title="Backward (hold to increase speed)">
						<span class="key-label">S</span>
						<span class="key-icon">&#8595;</span>
					</button>
					<button class="key" class:active={activeArduinoKey === 'd'} title="Right (hold to increase speed)">
						<span class="key-label">D</span>
						<span class="key-icon">&#8594;</span>
					</button>
					
					<!-- Row 3: Stop -->
					<div></div>
					<button class="key stop-key wide-key" title="Stop">
						<span class="key-label">SPACE / X</span>
						<span class="key-icon"><Square class="w-3 h-3" /></span>
					</button>
					<div></div>
				</div>
				
				<div class="mode-hint">
					<span class="hint-text">Hold keys to increase speed (0-255)</span>
				</div>
			</div>
			
			<!-- Camera Control Section -->
			<div class="keyboard-section">
				<div class="section-header">
					<Move class="w-3 h-3" />
					<span>Camera Control (ijkl)</span>
				</div>
				
				<div class="key-grid wasd-grid">
					<!-- Row 1: I -->
					<div></div>
					<button class="key small" title="Camera Up">
						<span class="key-label">I</span>
						<span class="key-icon">&#8593;</span>
					</button>
					<div></div>
					
					<!-- Row 2: J K L -->
					<button class="key small" title="Camera Left">
						<span class="key-label">J</span>
						<span class="key-icon">&#8592;</span>
					</button>
					<button class="key small stop-key" title="Camera Center">
						<span class="key-label">K</span>
						<span class="key-icon"><Square class="w-3 h-3" /></span>
					</button>
					<button class="key small" title="Camera Right">
						<span class="key-label">L</span>
						<span class="key-icon">&#8594;</span>
					</button>
				</div>
				
				<div class="mode-hint">
					<span class="hint-text">Camera control keys</span>
				</div>
			</div>
		</div>
		
		<!-- Arduino Speed Display -->
		<div class="speed-display">
			<div class="speed-bar">
				<div class="speed-info">
					<span class="speed-label">Speed</span>
					<span class="speed-value">{arduinoSpeed}</span>
					<span class="speed-unit">/ 255</span>
				</div>
				<div class="speed-bar-track">
					<div 
						class="speed-bar-fill arduino-speed" 
						style="width: {(arduinoSpeed / maxArduinoSpeed) * 100}%"
					></div>
				</div>
			</div>
			<div class="arduino-speed-hint">
				<span class="hint-text">Hold W/A/S/D to increase speed in steps of {arduinoSpeedStep}</span>
			</div>
		</div>
		{:else}
		<!-- ROS Mode: WASD Movement Controls -->
		<div class="keyboard-layout">
			<!-- WASD Movement Keys Section -->
			<div class="keyboard-section">
				<div class="section-header">
					<Move class="w-3 h-3" />
					<span>Movement (WASD)</span>
				</div>
				
				<div class="key-grid wasd-grid">
					<!-- Row 1: W -->
					<div></div>
					<button class="key" class:active={isRosKeyActive('w')} title="Forward (hold to accelerate)">
						<span class="key-label">W</span>
						<span class="key-icon">&#8593;</span>
						<span class="key-hint">Forward</span>
					</button>
					<div></div>
					
					<!-- Row 2: A S D -->
					<button class="key" class:active={isRosKeyActive('a')} title="Turn Left (hold to increase)">
						<span class="key-label">A</span>
						<span class="key-icon"><RotateCcw class="w-3 h-3" /></span>
						<span class="key-hint">Left</span>
					</button>
					<button class="key" class:active={isRosKeyActive('s')} title="Backward (hold to accelerate)">
						<span class="key-label">S</span>
						<span class="key-icon">&#8595;</span>
						<span class="key-hint">Backward</span>
					</button>
					<button class="key" class:active={isRosKeyActive('d')} title="Turn Right (hold to increase)">
						<span class="key-label">D</span>
						<span class="key-icon"><RotateCw class="w-3 h-3" /></span>
						<span class="key-hint">Right</span>
					</button>
					
					<!-- Row 3: Stop -->
					<div></div>
					<button class="key stop-key wide-key" title="Stop All Movement">
						<span class="key-label">SPACE</span>
						<span class="key-icon"><Square class="w-3 h-3" /></span>
					</button>
					<div></div>
				</div>
				
				<div class="mode-hint">
					<span class="hint-text">Hold keys to increase velocity in steps of {velocityStep}</span>
				</div>
			</div>
		</div>
		
		<!-- Velocity Display (ROS mode only) -->
		<div class="speed-display">
			<div class="speed-bar">
				<div class="speed-info">
					<span class="speed-label">Linear</span>
					<span class="speed-value" class:positive={linearVelocity > 0} class:negative={linearVelocity < 0}>
						{linearVelocity >= 0 ? '+' : ''}{linearVelocity.toFixed(2)}
					</span>
					<span class="speed-unit">m/s</span>
				</div>
				<div class="speed-bar-track bidirectional">
					<div class="speed-bar-center"></div>
					<div 
						class="speed-bar-fill" 
						class:forward={linearVelocity > 0}
						class:backward={linearVelocity < 0}
						style="width: {Math.abs(linearVelocity) * 50}%; {linearVelocity >= 0 ? 'left: 50%' : 'right: 50%'}"
					></div>
				</div>
			</div>
			<div class="speed-bar">
				<div class="speed-info">
					<span class="speed-label">Angular</span>
					<span class="speed-value" class:positive={angularVelocity > 0} class:negative={angularVelocity < 0}>
						{angularVelocity >= 0 ? '+' : ''}{angularVelocity.toFixed(2)}
					</span>
					<span class="speed-unit">rad/s</span>
				</div>
				<div class="speed-bar-track bidirectional">
					<div class="speed-bar-center"></div>
					<div 
						class="speed-bar-fill angular" 
						class:left={angularVelocity > 0}
						class:right={angularVelocity < 0}
						style="width: {Math.abs(angularVelocity) * 50}%; {angularVelocity >= 0 ? 'left: 50%' : 'right: 50%'}"
					></div>
				</div>
			</div>
		</div>
		{/if}
		
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
	
	.status-value.mode-value {
		color: var(--sky-blue);
		font-weight: 600;
	}
	
	.status-value.speed-value {
		color: var(--green);
		font-family: monospace;
		font-weight: 600;
	}
	
	.arduino-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}
	
	.keyboard-layout {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}
	
	.wasd-grid {
		grid-template-columns: repeat(3, 1fr);
		max-width: 240px;
		margin: 0 auto;
	}
	
	.wide-key {
		grid-column: span 1;
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
	
	.key.small {
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0.375rem;
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
	
	.speed-value.positive {
		color: var(--sky-light);
	}
	
	.speed-value.negative {
		color: var(--amber);
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
		position: relative;
	}
	
	.speed-bar-track.bidirectional {
		background: var(--slate-700);
	}
	
	.speed-bar-center {
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--slate-500);
		z-index: 1;
	}
	
	.speed-bar-fill {
		height: 100%;
		background: var(--sky-blue);
		border-radius: 0.1875rem;
		transition: width 0.15s ease;
		position: absolute;
		top: 0;
		bottom: 0;
	}
	
	.speed-bar-fill.forward {
		background: var(--sky-blue);
	}
	
	.speed-bar-fill.backward {
		background: var(--amber);
	}
	
	.speed-bar-fill.angular {
		background: var(--green);
	}
	
	.speed-bar-fill.left {
		background: var(--green);
	}
	
	.speed-bar-fill.right {
		background: var(--green);
	}
	
	.speed-bar-fill.arduino-speed {
		background: var(--green);
	}
	
	.arduino-speed-hint {
		margin-top: 0.25rem;
		text-align: center;
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
