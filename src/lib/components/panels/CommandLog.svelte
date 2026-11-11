<script lang="ts">
	import { commandHistory } from '$lib/stores/apiStore';
	import { Badge } from '$lib/components/ui/badge';
	
	let recentCommands = $derived($commandHistory.slice(-10).reverse());
	
	function getStatusVariant(status: string): 'success' | 'destructive' | 'warning' | 'default' {
		switch(status) {
			case 'success': return 'success';
			case 'error': return 'destructive';
			case 'sent': return 'warning';
			default: return 'default';
		}
	}
	
	function formatTime(timestamp: number) {
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

{#if recentCommands.length === 0}
	<p class="text-muted-foreground text-sm text-center py-4">No API calls yet</p>
{:else}
	<div class="space-y-2">
		{#each recentCommands as cmd}
			<div class="bg-secondary rounded p-3 text-xs">
				<div class="flex justify-between items-start mb-2">
					<span class="text-primary font-semibold font-mono">{cmd.command}</span>
					<Badge variant={getStatusVariant(cmd.status)} class="text-[10px] h-5">
						{cmd.status.toUpperCase()}
					</Badge>
				</div>
				<div class="text-muted-foreground text-[10px]">
					{formatTime(cmd.timestamp)}
				</div>
				{#if cmd.response}
					<div class="text-muted-foreground mt-2 font-mono truncate">
						{JSON.stringify(cmd.response).substring(0, 100)}...
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
