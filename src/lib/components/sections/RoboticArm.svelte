<script>
	import { Archive, Download } from 'lucide-svelte';
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white">Robotic Arm</h2>
	</div>
	<div class="p-4 space-y-3">
		<!-- NOT IMPLEMENTED: Backend does not handle ARM commands yet -->
		<button 
			class="btn btn-primary w-full"
			on:click={() => console.log('Drop in storage (not implemented)')}
		>
			<Archive class="w-4 h-4 mr-2" />Drop in Storage Box
		</button>
		<button 
			class="btn btn-secondary w-full"
			on:click={() => console.log('Drop outside (not implemented)')}
		>
			<Download class="w-4 h-4 mr-2" />Drop Outside Rover
		</button>
	</div>
</div>
