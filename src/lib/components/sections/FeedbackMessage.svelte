<script lang="ts">
	import { AlertCircle, CheckCircle } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	
	// Props using $bindable for two-way binding
	let { show = $bindable(false), message = $bindable(''), type = $bindable<'success' | 'error' | 'info'>('success') } = $props();
	
	// Expose showMessage function for parent components
	export function showMessage(msg: string, msgType: 'success' | 'error' | 'info' = 'success', duration = 5000) {
		message = msg;
		type = msgType;
		show = true;
		
		setTimeout(() => {
			show = false;
		}, duration);
	}
	
	// Computed styles
	let bgClass = $derived(
		type === 'success' ? 'bg-green-900/50 border-green-500' :
		type === 'error' ? 'bg-destructive/50 border-destructive' :
		'bg-blue-900/50 border-blue-500'
	);
	
	let iconClass = $derived(
		type === 'success' ? 'text-green-400' :
		type === 'error' ? 'text-red-400' :
		'text-blue-400'
	);
</script>

{#if show}
<div class="mb-4 p-4 rounded-lg border flex items-center gap-3 {bgClass}">
	{#if type === 'success'}
		<CheckCircle class="w-5 h-5 {iconClass}" />
	{:else if type === 'error'}
		<AlertCircle class="w-5 h-5 {iconClass}" />
	{:else}
		<AlertCircle class="w-5 h-5 {iconClass}" />
	{/if}
	<p class="text-foreground flex-1">{message}</p>
	<button onclick={() => show = false} class="text-muted-foreground hover:text-foreground">✕</button>
</div>
{/if}
