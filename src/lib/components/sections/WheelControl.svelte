<script>
	const wheels = ['front_left', 'front_right', 'rear_left', 'rear_right'];
	let wheelSpeeds = { 'front_left': 100, 'front_right': 100, 'rear_left': 100, 'rear_right': 100 };
	let wheelDirections = { 'front_left': 0, 'front_right': 0, 'rear_left': 0, 'rear_right': 0 };
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white">Individual Wheel Control</h2>
	</div>
	<div class="p-4 grid grid-cols-2 gap-x-4 gap-y-6">
		{#each wheels as wheel}
			<div>
				<h3 class="font-semibold text-sm text-center text-white capitalize">{wheel.replace('_', ' ')}</h3>
				<!-- NOT IMPLEMENTED: Backend does not handle wheel speed yet -->
				<label class="block text-xs">Speed: <span>{wheelSpeeds[wheel]}%</span></label>
				<input 
					type="range" 
					class="w-full" 
					bind:value={wheelSpeeds[wheel]}
					on:input={() => console.log('Wheel speed (not implemented):', wheel, wheelSpeeds[wheel])}
				>
				<!-- NOT IMPLEMENTED: Backend does not handle wheel direction yet -->
				<label class="block text-xs">Direction: <span>{wheelDirections[wheel]}°</span></label>
				<input 
					type="range" 
					class="w-full" 
					min="-45" 
					max="45" 
					bind:value={wheelDirections[wheel]}
					on:input={() => console.log('Wheel direction (not implemented):', wheel, wheelDirections[wheel])}
				>
			</div>
		{/each}
	</div>
</div>
