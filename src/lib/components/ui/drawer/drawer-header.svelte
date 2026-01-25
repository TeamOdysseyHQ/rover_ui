<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	
	let { 
		onClose,
		children
	}: { 
		onClose?: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="drawer-header">
	<div class="drawer-header-content">
		{#if children}
			{@render children()}
		{/if}
	</div>
	{#if onClose}
		<button
			type="button"
			class="drawer-close-button"
			onclick={onClose}
			aria-label="Close"
		>
			<X class="w-5 h-5" />
		</button>
	{/if}
</div>

<style>
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--slate-800);
		flex-shrink: 0;
	}
	
	.drawer-header-content {
		flex: 1;
	}
	
	.drawer-close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.375rem;
		background: transparent;
		border: 1px solid var(--slate-700);
		color: var(--slate-400);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.drawer-close-button:hover {
		background: var(--slate-800);
		border-color: var(--sky-blue);
		color: var(--sky-blue);
	}
</style>
