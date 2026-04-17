<script lang="ts">
	import * as Dialog from './dialog';
	import type { Snippet } from 'svelte';
	
	// Props - maintain backward compatibility
	let { show = $bindable(false), title = '', children }: { 
		show?: boolean; 
		title?: string; 
		children?: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open={show}>
	<Dialog.Content class="max-w-lg bg-slate-900 border-slate-900">
		<Dialog.Header>
			<Dialog.Title class="text-xl font-bold">{title}</Dialog.Title>
		</Dialog.Header>
		<div class="mt-4">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
