<script>
	import { Wifi, WifiOff, Power } from 'lucide-svelte';
	import { apiStatus, roverApiUrl, testConnection, disconnectFromRover } from '$lib/stores/apiStore';
	import { setApiBaseUrl } from '$lib/services/roverApi';
	
	let apiUrl = 'http://localhost:6767'; // Default API URL
	
	$: isConnected = $apiStatus === 'connected';
	$: hasError = $apiStatus === 'error';
	
	async function handleConnect() {
		if (isConnected) {
			disconnectFromRover();
		} else {
			const success = await testConnection(apiUrl);
			if (success) {
				setApiBaseUrl(apiUrl);
			}
		}
	}
</script>

<div class="card">
	<div class="p-4 border-b border-slate-700">
		<h2 class="font-semibold text-lg text-white flex items-center gap-2">
			{#if isConnected}
				<Wifi class="text-green-400" />
			{:else}
				<WifiOff class="text-slate-400" />
			{/if}
			Rover API Connection
		</h2>
	</div>
	<div class="p-4 space-y-4">
		<div>
			<label for="api-url" class="block text-sm font-medium mb-2">Rover API URL</label>
			<input 
				id="api-url"
				type="text"
				bind:value={apiUrl}
				disabled={isConnected}
				class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white disabled:opacity-50"
				placeholder="http://localhost:6767"
			>
		</div>
		
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium">Status:</p>
				<p class="text-xs {isConnected ? 'text-green-400' : hasError ? 'text-red-400' : 'text-slate-400'}">
					{#if isConnected}
						Connected to {$roverApiUrl}
					{:else if hasError}
						Connection Failed
					{:else}
						Disconnected
					{/if}
				</p>
			</div>
			<button 
				class="btn {isConnected ? 'btn-secondary' : 'btn-primary'}"
				on:click={handleConnect}
			>
				<Power class="w-4 h-4 mr-2" />
				{isConnected ? 'Disconnect' : 'Connect'}
			</button>
		</div>
		
		{#if !isConnected}
			<div class="text-xs text-slate-400 bg-slate-800 p-3 rounded">
				<p class="font-semibold mb-1">Setup Instructions:</p>
				<ol class="list-decimal list-inside space-y-1">
					<li>Start the FastAPI backend server</li>
					<li>Enter the API URL above (default: http://localhost:6767)</li>
					<li>Click Connect to test the connection</li>
				</ol>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Styles inherited from parent */
</style>
