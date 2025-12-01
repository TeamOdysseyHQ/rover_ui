<script>
	import { createEventDispatcher } from 'svelte';
	
	const dispatch = createEventDispatcher();
	
	let isDragging = false;
	let stick;
	let base;
	
	function handleMouseDown() {
		isDragging = true;
	}
	
	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			// Reset to center
			stick.style.transition = 'all 0.2s ease';
			stick.style.left = '50%';
			stick.style.top = '50%';
			stick.style.transform = 'translate(-50%, -50%)';
			setTimeout(() => stick.style.transition = '', 200);
			dispatch('move', { x: 0, y: 0 });
		}
	}
	
	function handleMouseMove(e) {
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
		const normalizedY = deltaY / maxDistance;
		
		dispatch('move', { x: normalizedX, y: normalizedY });
	}
</script>

<svelte:window on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<div class="joystick-base" bind:this={base}>
	<div 
		class="joystick-stick" 
		bind:this={stick}
		on:mousedown={handleMouseDown}
		role="button"
		tabindex="0"
	></div>
</div>

<style>
	.joystick-base {
		width: 150px;
		height: 150px;
		background-color: var(--slate-900);
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 3px solid var(--slate-700);
		box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
	}

	.joystick-stick {
		width: 60px;
		height: 60px;
		background: radial-gradient(circle at 30% 30%, var(--sky-400), var(--sky-500));
		border-radius: 50%;
		cursor: grab;
		position: absolute;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3), inset 0 0 5px rgba(255,255,255,0.2);
		border: 1px solid var(--sky-400);
	}

	.joystick-stick:active {
		cursor: grabbing;
	}
</style>
