<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	
	let { 
		class: className,
		children
	}: { 
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div class={cn('drawer-content', className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.drawer-content {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 800px;
		max-width: 100vw;
		background: var(--slate-900);
		border-left: 1px solid var(--slate-800);
		z-index: 51;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
		animation: slideIn 0.3s ease;
	}
	
	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
	
	/* Mobile responsive */
	@media (max-width: 900px) {
		.drawer-content {
			width: 100vw;
		}
	}
</style>
