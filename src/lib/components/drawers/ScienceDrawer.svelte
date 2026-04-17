<script lang="ts">
	import * as Drawer from '$lib/components/ui/drawer';
	import MicroscopePanel from '$lib/components/panels/MicroscopePanel.svelte';
	import ScienceControlPanel from '$lib/components/panels/ScienceControlPanel.svelte';
	import ScienceSensorDisplay from '$lib/components/panels/ScienceSensorDisplay.svelte';
	import ScienceReports from '$lib/components/sections/ScienceReports.svelte';
	
	// Props
	let { 
		show = $bindable(false),
		microscopeActive = $bindable(false)
	}: { 
		show?: boolean;
		microscopeActive?: boolean;
	} = $props();
	
	// Science module state
	let scienceModeEnabled = $state(false);
</script>

<Drawer.Root bind:open={show}>
	<Drawer.Overlay onclick={() => show = false} />
	<Drawer.Content class="w-[800px]">
		<Drawer.Header onClose={() => show = false}>
			<Drawer.Title>Science Center</Drawer.Title>
		</Drawer.Header>
		
		<div class="overflow-y-auto p-6 space-y-6 flex-1">
			<!-- Section 1: Microscope -->
			<MicroscopePanel bind:microscopeActive={microscopeActive} />
			
			<!-- Section 2: Science Module Control -->
			<ScienceControlPanel bind:scienceModeEnabled={scienceModeEnabled} />
			
			<!-- Section 3: Science Sensor Data -->
			<ScienceSensorDisplay autoRefresh={scienceModeEnabled} />
			
			<!-- Section 4: Expedition Tracking & Science Reports -->
			<ScienceReports />
		</div>
	</Drawer.Content>
</Drawer.Root>


