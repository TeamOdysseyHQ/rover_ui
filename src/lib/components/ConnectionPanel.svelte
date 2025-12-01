<script>
	import { Wifi, WifiOff, Power } from 'lucide-svelte';
	import { connectionStatus, roverIP, connectToRover, disconnectFromRover } from '$lib/stores/commandStore';
	
	let ipAddress = '192.168.1.100'; // Default IP
	
	$: isConnected = $connectionStatus === 'connected';
	$: hasError = $connectionStatus === 'error';
	
	function handleConnect() {
		if (isConnected) {
			disconnectFromRover();
		} else {
			connectToRover(ipAddress);
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
			Rover Connection
		</h2>
	</div>
	<div class="p-4 space-y-4">
		<div>
			<label for="rover-ip" class="block text-sm font-medium mb-2">Rover IP Address</label>
			<input 
				id="rover-ip"
				type="text"
				bind:value={ipAddress}
				disabled={isConnected}
				class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white disabled:opacity-50"
				placeholder="192.168.1.100"
			>
		</div>
		
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium">Status:</p>
				<p class="text-xs {isConnected ? 'text-green-400' : hasError ? 'text-red-400' : 'text-slate-400'}">
					{#if isConnected}
						Connected to {$roverIP}
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
					<li>Ensure rover is on same WiFi network</li>
					<li>Enter rover's IP address above</li>
					<li>Click Connect to establish link</li>
				</ol>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Styles inherited from parent */
</style>
