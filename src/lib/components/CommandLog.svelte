<script>
	import { commandHistory } from '$lib/stores/commandStore';
	import { Terminal } from 'lucide-svelte';
	
	$: recentCommands = $commandHistory.slice(-10).reverse();
	
	function getStatusColor(status) {
		switch(status) {
			case 'transmitted': return 'text-green-400';
			case 'failed': return 'text-red-400';
			case 'local_only': return 'text-amber-400';
			default: return 'text-slate-400';
		}
	}
	
	function formatTime(timestamp) {
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white flex items-center gap-2">
			<Terminal class="text-sky-400" />
			Command Log
		</h2>
	</div>
	<div class="p-4">
		{#if recentCommands.length === 0}
			<p class="text-slate-400 text-sm text-center py-4">No commands yet</p>
		{:else}
			<div class="space-y-2 max-h-64 overflow-y-auto">
				{#each recentCommands as cmd}
					<div class="bg-slate-900 rounded p-2 text-xs font-mono">
						<div class="flex justify-between items-start mb-1">
							<span class="text-sky-400 font-semibold">{cmd.command}</span>
							<span class="{getStatusColor(cmd.status)} text-[10px]">
								{cmd.status.toUpperCase()}
							</span>
						</div>
						<div class="text-slate-500 text-[10px]">
							{formatTime(cmd.timestamp)}
						</div>
						{#if Object.keys(cmd.data).length > 0}
							<div class="text-slate-400 mt-1">
								{JSON.stringify(cmd.data)}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
