<script>
	import { apiStatus } from '$lib/stores/apiStore';
</script>

<header class="flex justify-between items-center mb-6">
	<div>
		<h1 class="text-2xl font-bold text-white">Skanda Command Center</h1>
		<p class="text-sm text-slate-400">
			STATUS: <span class="text-green-400 font-semibold">NOMINAL</span> | 
			LINK: <span class="{$apiStatus === 'connected' ? 'text-green-400' : 'text-red-400'} font-semibold">
				{$apiStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}
			</span> | 
			DEC 12 2025, 12:40 IST
		</p>
	</div>
</header>
