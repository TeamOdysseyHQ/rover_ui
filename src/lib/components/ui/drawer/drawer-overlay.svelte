<script lang="ts">
	let { onclick }: { onclick?: () => void } = $props();
</script>

<button
	type="button"
	class="drawer-overlay"
	onclick={onclick}
	aria-label="Close drawer"
></button>

<style>
	.drawer-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 50;
		cursor: pointer;
		animation: fadeIn 0.2s ease;
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
