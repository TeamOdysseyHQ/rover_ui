<script>
	import { AlertCircle, CheckCircle } from 'lucide-svelte';
	
	export let show = false;
	export let message = '';
	export let type = 'success'; // 'success' | 'error' | 'info'
	
	export function showMessage(msg, msgType = 'success', duration = 5000) {
		message = msg;
		type = msgType;
		show = true;
		
		setTimeout(() => {
			show = false;
		}, duration);
	}
</script>

{#if show}
<div class="mb-4 p-4 rounded-lg flex items-center gap-3 {type === 'success' ? 'bg-green-900/50 border border-green-500' : type === 'error' ? 'bg-red-900/50 border border-red-500' : 'bg-blue-900/50 border border-blue-500'}">
	{#if type === 'success'}
		<CheckCircle class="w-5 h-5 text-green-400" />
	{:else if type === 'error'}
		<AlertCircle class="w-5 h-5 text-red-400" />
	{:else}
		<AlertCircle class="w-5 h-5 text-blue-400" />
	{/if}
	<p class="text-white">{message}</p>
	<button on:click={() => show = false} class="ml-auto text-slate-400 hover:text-white">✕</button>
</div>
{/if}
