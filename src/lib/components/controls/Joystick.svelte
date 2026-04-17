<script lang="ts">
	import { publishCmdVel } from '$lib/stores/rosStore';
	import { isRosConnected } from '$lib/stores/rosStore';
	
	// Props using $props rune
	let { maxLinearSpeed = 1.0, maxAngularSpeed = 1.0, enableRos = true } = $props();
	
	// State using $state rune
	let isDragging = $state(false);
	let stick: HTMLDivElement | undefined = $state();
	let base: HTMLDivElement | undefined = $state();
	let lastPublishTime = $state(0);
	const publishInterval = 100; // ms - throttle ROS publishing
	
	// Keyboard state
	let keysPressed = $state({
		w: false,
		a: false,
		s: false,
		d: false
	});
	let keyboardActive = $state(false);
	
	// Custom event dispatch for Svelte 5
	function dispatchMove(x: number, y: number) {
		// Dispatch custom event for parent components
		const event = new CustomEvent('move', { detail: { x, y } });
		if (base) {
			base.dispatchEvent(event);
		}
	}
	
	function handleKeyDown(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		if (['w', 'a', 's', 'd'].includes(key)) {
			e.preventDefault();
			if (!keysPressed[key as keyof typeof keysPressed]) {
				keysPressed[key as keyof typeof keysPressed] = true;
				keyboardActive = true;
				updateFromKeyboard();
			}
		}
	}
	
	function handleKeyUp(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		if (['w', 'a', 's', 'd'].includes(key)) {
			e.preventDefault();
			keysPressed[key as keyof typeof keysPressed] = false;
			
			// Check if any keys are still pressed
			const anyKeyPressed = Object.values(keysPressed).some(pressed => pressed);
			if (!anyKeyPressed) {
				keyboardActive = false;
				resetToCenter();
			} else {
				updateFromKeyboard();
			}
		}
	}
	
	function resetToCenter() {
		if (stick) {
			stick.style.transition = 'all 0.2s ease';
			stick.style.left = '50%';
			stick.style.top = '50%';
			stick.style.transform = 'translate(-50%, -50%)';
			setTimeout(() => {
				if (stick) stick.style.transition = '';
			}, 200);
		}
		
		// Send stop command
		dispatchMove(0, 0);
		if (enableRos && $isRosConnected) {
			publishCmdVel(0, 0);
		}
	}
	
	function updateFromKeyboard() {
		if (!stick || !base) return;
		
		// Calculate normalized values from keyboard state
		let normalizedX = 0;
		let normalizedY = 0;
		
		if (keysPressed.w) normalizedY += 1;
		if (keysPressed.s) normalizedY -= 1;
		if (keysPressed.d) normalizedX += 1;
		if (keysPressed.a) normalizedX -= 1;
		
		// Normalize diagonal movement
		const magnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
		if (magnitude > 1) {
			normalizedX /= magnitude;
			normalizedY /= magnitude;
		}
		
		// Update stick visual position
		const baseRect = base.getBoundingClientRect();
		const maxDistance = baseRect.width / 2 - (stick.offsetWidth / 2);
		const deltaX = normalizedX * maxDistance;
		const deltaY = -normalizedY * maxDistance; // Invert Y for visual
		
		stick.style.transition = '';
		stick.style.left = `calc(50% + ${deltaX}px)`;
		stick.style.top = `calc(50% + ${deltaY}px)`;
		stick.style.transform = 'translate(-50%, -50%)';
		
		dispatchMove(normalizedX, normalizedY);
		
		// Publish to ROS (throttled)
		if (enableRos && $isRosConnected) {
			const now = Date.now();
			if (now - lastPublishTime >= publishInterval) {
				const linear_x = normalizedY * maxLinearSpeed;
				const angular_z = -normalizedX * maxAngularSpeed;
				
				publishCmdVel(linear_x, angular_z);
				lastPublishTime = now;
			}
		}
	}
	
	function handleMouseDown() {
		isDragging = true;
	}
	
	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			// Reset to center
			if (stick) {
				stick.style.transition = 'all 0.2s ease';
				stick.style.left = '50%';
				stick.style.top = '50%';
				stick.style.transform = 'translate(-50%, -50%)';
				setTimeout(() => {
					if (stick) stick.style.transition = '';
				}, 200);
			}
			
			// Send stop command
			dispatchMove(0, 0);
			if (enableRos && $isRosConnected) {
				publishCmdVel(0, 0);
			}
		}
	}
	
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !base || !stick) return;
		
		const baseRect = base.getBoundingClientRect();
		const centerX = baseRect.left + baseRect.width / 2;
		const centerY = baseRect.top + baseRect.height / 2;
		
		let deltaX = e.clientX - centerX;
		let deltaY = e.clientY - centerY;
		
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const maxDistance = baseRect.width / 2 - stick.offsetWidth / 2;
		
		if (distance > maxDistance) {
			deltaX = (deltaX / distance) * maxDistance;
			deltaY = (deltaY / distance) * maxDistance;
		}
		
		stick.style.left = `calc(50% + ${deltaX}px)`;
		stick.style.top = `calc(50% + ${deltaY}px)`;
		stick.style.transform = 'translate(-50%, -50%)';
		
		// Normalize values to -1 to 1
		const normalizedX = deltaX / maxDistance;
		const normalizedY = -deltaY / maxDistance; // Invert Y (up is positive)
		
		dispatchMove(normalizedX, normalizedY);
		
		// Publish to ROS (throttled)
		if (enableRos && $isRosConnected) {
			const now = Date.now();
			if (now - lastPublishTime >= publishInterval) {
				// Convert joystick to cmd_vel
				// Y axis controls linear velocity (forward/backward)
				// X axis controls angular velocity (left/right rotation)
				const linear_x = normalizedY * maxLinearSpeed;
				const angular_z = -normalizedX * maxAngularSpeed;
				
				publishCmdVel(linear_x, angular_z);
				lastPublishTime = now;
			}
		}
	}
</script>

<svelte:window 
	onmouseup={handleMouseUp} 
	onmousemove={handleMouseMove}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
/>

<div class="joystick-base" bind:this={base}>
	<div 
		class="joystick-stick" 
		bind:this={stick}
		onmousedown={handleMouseDown}
		role="button"
		tabindex="0"
	></div>
</div>

<style>
	.joystick-base {
		width: 150px;
		height: 150px;
		background-color: #000000;
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--slate-700);
	}

	.joystick-stick {
		width: 60px;
		height: 60px;
		background: var(--sky-blue);
		border-radius: 50%;
		cursor: grab;
		position: absolute;
		border: 1px solid var(--sky-light);
	}

	.joystick-stick:active {
		cursor: grabbing;
	}
</style>
