<script lang="ts">
	import * as roverApi from '$lib/services/roverApi';
	
	// Panels
	import CameraPanel from '$lib/components/panels/CameraPanel.svelte';
	import ConnectionPanel from '$lib/components/panels/ConnectionPanel.svelte';
	import CommandLog from '$lib/components/panels/CommandLog.svelte';
	import RosStatusPanel from '$lib/components/panels/RosStatusPanel.svelte';
	import TeensyTopicPanel from '$lib/components/panels/TeensyTopicPanel.svelte';
	
	// Sections
	import DashboardHeader from '$lib/components/sections/DashboardHeader.svelte';
	import MissionTabs from '$lib/components/sections/MissionTabs.svelte';
	import FeedbackMessage from '$lib/components/sections/FeedbackMessage.svelte';
	import DrivingControls from '$lib/components/sections/DrivingControls.svelte';
	import NavigationSection from '$lib/components/sections/NavigationSection.svelte';
	import RoboticArm from '$lib/components/sections/RoboticArm.svelte';
	import ScienceReports from '$lib/components/sections/ScienceReports.svelte';
	
	// Mission Panels
	import ABExPanel from '$lib/components/panels/missions/ABExPanel.svelte';
	import RADOPanel from '$lib/components/panels/missions/RADOPanel.svelte';
	import IDMOPanel from '$lib/components/panels/missions/IDMOPanel.svelte';
	
	// Modals
	import AutonomousModeModal from '$lib/components/modals/AutonomousModeModal.svelte';
	import WaypointsModal from '$lib/components/modals/WaypointsModal.svelte';
	import RouteAnalysisModal from '$lib/components/modals/RouteAnalysisModal.svelte';
	
	// Modal visibility state
	let showAutoModal = $state(false);
	let showWaypointsModal = $state(false);
	let showRouteAnalysisModal = $state(false);
	
	// Mission state
	let activeMission = $state('general');
	
	// Feedback message state
	let feedbackComponent = $state<any>(null);
	let showFeedback = $state(false);
	
	// Data state
	let waypoints = $state<any[]>([]);
	let routeAnalysis = $state<any>(null);
	let gpsLat = $state('16.5062');
	let gpsLon = $state('80.6480');
	
	// Helper function to show feedback messages
	function showFeedbackMessage(message: string, type: string = 'success') {
		if (feedbackComponent) {
			feedbackComponent.showMessage(message, type);
		}
	}
	
	// Load waypoints
	async function loadWaypoints() {
		try {
			const result = await roverApi.getWaypoints();
			waypoints = result.waypoints || [];
			showWaypointsModal = true;
		} catch (error: any) {
			showFeedbackMessage(`Failed to load waypoints: ${error.message}`, 'error');
		}
	}
	
	// Load route analysis
	async function loadRouteAnalysis() {
		try {
			const result = await roverApi.getRouteAnalysis();
			routeAnalysis = result;
			showRouteAnalysisModal = true;
		} catch (error: any) {
			showFeedbackMessage(`Failed to load route analysis: ${error.message}`, 'error');
		}
	}
</script>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="max-w-screen-2xl mx-auto">
		<!-- Feedback Message -->
		<FeedbackMessage bind:this={feedbackComponent} bind:show={showFeedback} />
		
		<!-- Header -->
		<DashboardHeader {activeMission} />
		
		<!-- Mission Tabs -->
		<MissionTabs {activeMission} onMissionChange={(mission) => activeMission = mission} />

		<!-- Camera Section (Full Width) -->
		<section class="mb-6">
			<CameraPanel />
		</section>
		
		<main class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			<div class="space-y-6 xl:col-span-1">
				<ConnectionPanel />
				
				<TeensyTopicPanel />
				
				<!-- Mission-Specific Panel -->
				{#if activeMission === 'abex'}
					<ABExPanel />
				{:else if activeMission === 'rado'}
					<RADOPanel />
				{:else if activeMission === 'idmo'}
					<IDMOPanel />
				{/if}
			</div>

            <div class="space-y-6">
				<RosStatusPanel />
				<CommandLog />
            </div>

            <div class="space-y-6">
				<DrivingControls 
					onEmergencyStop={showFeedbackMessage}
					onShowAutoModal={() => showAutoModal = true}
				/>
				<RoboticArm />
            </div>

            <div class="space-y-6">
				<NavigationSection 
					{waypoints}
					onViewWaypoints={loadWaypoints}
					onViewRouteAnalysis={loadRouteAnalysis}
				/>
				<ScienceReports />
            </div>


		</main>
	</div>
</div>

<!-- Modals -->
<AutonomousModeModal 
	bind:show={showAutoModal}
	bind:gpsLat
	bind:gpsLon
	onSuccess={(msg: string) => showFeedbackMessage(msg, 'success')}
	onError={(msg: string) => showFeedbackMessage(msg, 'error')}
/>

<WaypointsModal 
	bind:show={showWaypointsModal}
	{waypoints}
/>

<RouteAnalysisModal 
	bind:show={showRouteAnalysisModal}
	{routeAnalysis}
/>

<style>
	:global(.card) {
		background: var(--slate-900);
		border: 1px solid var(--slate-800);
		border-radius: 0.5rem;
	}

	:global(.btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 500;
		transition: all 0.15s ease;
		border: 1px solid transparent;
	}
	
	:global(.btn:hover) {
		opacity: 0.9;
	}

	:global(.btn-primary) {
		background-color: var(--sky-blue);
		color: white;
		border-color: var(--sky-blue);
	}

	:global(.btn-primary:hover) {
		background-color: var(--sky-light);
		border-color: var(--sky-light);
	}

	:global(.btn-secondary) {
		background-color: var(--slate-800);
		color: var(--slate-300);
		border-color: var(--slate-700);
	}
	
	:global(.btn-secondary:hover) {
		background-color: var(--slate-700);
		border-color: var(--slate-600);
	}
</style>
