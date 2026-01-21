<script>
	export let show = false;
	export let title = '';
	
	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			show = false;
		}
	}
	
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			show = false;
		}
	}
</script>

{#if show}
	<div 
		class="modal" 
		on:click={handleBackdropClick} 
		on:keydown={handleKeydown}
		role="dialog" 
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-content">
			<h2 class="text-xl font-bold text-white mb-4">{title}</h2>
			<slot />
		</div>
	</div>
{/if}

<style>
	.modal {
		display: block;
		position: fixed;
		z-index: 100;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		overflow: auto;
		background-color: rgba(0,0,0,0.7);
	}

	.modal-content {
		background-color: var(--slate-800);
		margin: 10% auto;
		padding: 2rem;
		border: 1px solid var(--slate-700);
		width: 90%;
		max-width: 500px;
		border-radius: 0.75rem;
	}
</style>
