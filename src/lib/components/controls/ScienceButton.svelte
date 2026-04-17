<script lang="ts">
	import { FlaskConical } from 'lucide-svelte';
	
	let { 
		onclick, 
		microscopeActive = false 
	}: { 
		onclick: () => void; 
		microscopeActive?: boolean;
	} = $props();
</script>

<button
	type="button"
	onclick={onclick}
	class="science-button"
	aria-label="Open Science Center"
>
	<FlaskConical class="w-6 h-6" />
	{#if microscopeActive}
		<span class="status-indicator"></span>
	{/if}
</button>

<style>
	.science-button {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--slate-900);
		border: 1px solid var(--slate-800);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sky-blue);
		cursor: pointer;
		z-index: 40;
		transition: all 0.15s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.science-button:hover {
		background: var(--slate-800);
		border-color: var(--sky-blue);
		box-shadow: 0 4px 20px rgba(14, 165, 233, 0.4);
		transform: scale(1.05);
	}
	
	.status-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #22c55e; /* Green */
		animation: pulse 2s ease-in-out infinite;
	}
	
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
	
	/* Mobile responsive */
	@media (max-width: 768px) {
		.science-button {
			width: 56px;
			height: 56px;
			bottom: 1.5rem;
			right: 1.5rem;
		}
	}
</style>
