<script lang="ts">
	import type { Snippet } from 'svelte';
	
	let { children }: { children?: Snippet } = $props();
</script>

<h2 class="drawer-title">
	{#if children}
		{@render children()}
	{/if}
</h2>

<style>
	.drawer-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--sky-blue);
		margin: 0;
	}
</style>
