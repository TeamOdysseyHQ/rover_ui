<script lang="ts">
	import { apiStatus } from '$lib/stores/apiStore';
	import { Badge } from '$lib/components/ui/badge';
	
	interface Props {
		activeMission?: string;
	}
	
	let { activeMission = 'general' }: Props = $props();
	
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
	
	const getMissionName = (mission: string) => {
		const missionMap: Record<string, string> = {
			'general': 'General Operations',
			'abex': 'ABEx - Astrobiology Expedition',
			'rado': 'RADO - Reconnaissance & Delivery',
			'idmo': 'IDMO - Instrument Deployment'
		};
		return missionMap[mission] || 'General Operations';
	};
</script>

<header class="flex justify-between items-center mb-8 pb-6 border-b border-border">
	<div>
		<h1 class="text-3xl font-bold text-foreground tracking-tight mb-1">Skanda Command Center</h1>
		<p class="text-sm text-sky-400 font-medium mb-3">{getMissionName(activeMission)}</p>
		<div class="flex items-center gap-4 text-sm">
			<div class="flex items-center gap-2">
				<span class="text-muted-foreground font-medium">STATUS:</span>
				<Badge variant="success">NOMINAL</Badge>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-muted-foreground font-medium">LINK:</span>
				<Badge variant={$apiStatus === 'connected' ? 'success' : 'destructive'}>
					{$apiStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}
				</Badge>
			</div>
			<span class="text-muted-foreground font-mono text-xs">{formatTime(currentTime)}</span>
		</div>
	</div>
</header>
