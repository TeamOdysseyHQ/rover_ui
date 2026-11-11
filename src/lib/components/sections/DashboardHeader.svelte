<script lang="ts">
	import { apiStatus } from '$lib/stores/apiStore';
	import { Badge } from '$lib/components/ui/badge';
	import ConnectionControls from '$lib/components/controls/ConnectionControls.svelte';
	
	// Get current date/time reactively
	let currentTime = $state(new Date());
	
	$effect(() => {
		const interval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
		
		return () => clearInterval(interval);
	});
	
	const formatTime = (date: Date) => {
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Kolkata',
			timeZoneName: 'short'
		}).toUpperCase();
	};
	
</script>

<header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-5 border-b border-border">
	<div>
		<h1 class="text-3xl font-bold text-foreground tracking-tight mb-3">Skanda Command Center</h1>
		<div class="flex items-center gap-4 text-sm">
			<div class="flex items-center gap-2">
				<span class="text-muted-foreground font-medium">API:</span>
				<Badge variant={$apiStatus === 'connected' ? 'success' : 'destructive'}>
					{$apiStatus.toUpperCase()}
				</Badge>
			</div>
			<span class="text-muted-foreground font-mono text-xs">{formatTime(currentTime)}</span>
		</div>
	</div>
	<div class="self-end sm:self-auto"><ConnectionControls /></div>
</header>
