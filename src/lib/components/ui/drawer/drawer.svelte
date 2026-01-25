<script lang="ts">
	import type { Snippet } from 'svelte';
	
	let { 
		open = $bindable(false),
		children
	}: { 
		open?: boolean;
		children?: Snippet;
	} = $props();
	
	// Close drawer when clicking outside or pressing Escape
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	{#if children}
		{@render children()}
	{/if}
{/if}
