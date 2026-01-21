<script>
	import * as roverApi from '$lib/services/roverApi';
	
	// Panels
	import CameraPanel from '$lib/components/panels/CameraPanel.svelte';
	import ConnectionPanel from '$lib/components/panels/ConnectionPanel.svelte';
	import CommandLog from '$lib/components/panels/CommandLog.svelte';
	import RosStatusPanel from '$lib/components/panels/RosStatusPanel.svelte';
	import TeensyTopicPanel from '$lib/components/panels/TeensyTopicPanel.svelte';
	
	// Sections
	import DashboardHeader from '$lib/components/sections/DashboardHeader.svelte';
	import FeedbackMessage from '$lib/components/sections/FeedbackMessage.svelte';
	import DrivingControls from '$lib/components/sections/DrivingControls.svelte';
	import NavigationSection from '$lib/components/sections/NavigationSection.svelte';
	import RoboticArm from '$lib/components/sections/RoboticArm.svelte';
	import WheelControl from '$lib/components/sections/WheelControl.svelte';
	
	// Modals
	import AutonomousModeModal from '$lib/components/modals/AutonomousModeModal.svelte';
	import WaypointsModal from '$lib/components/modals/WaypointsModal.svelte';
	import RouteAnalysisModal from '$lib/components/modals/RouteAnalysisModal.svelte';
	
	let showAutoModal = false;
	let showWaypointsModal = false;
	let showRouteAnalysisModal = false;
	
	// Feedback message state
	let feedbackComponent;
	let showFeedback = false;
	
	// Data state
	let waypoints = [];
	let routeAnalysis = null;
	let gpsLat = '16.5062';
	let gpsLon = '80.6480';
	
	// Helper function to show feedback messages
	function showFeedbackMessage(message, type = 'success') {
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
		} catch (error) {
			showFeedbackMessage(`Failed to load waypoints: ${error.message}`, 'error');
		}
	}
	
	// Load route analysis
	async function loadRouteAnalysis() {
		try {
			const result = await roverApi.getRouteAnalysis();
			routeAnalysis = result;
			showRouteAnalysisModal = true;
		} catch (error) {
			showFeedbackMessage(`Failed to load route analysis: ${error.message}`, 'error');
		}
	}
</script>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="max-w-screen-2xl mx-auto">
		<!-- Feedback Message -->
		<FeedbackMessage bind:this={feedbackComponent} bind:show={showFeedback} />
		
		<!-- Header -->
		<DashboardHeader />

		<!-- Camera Section (Full Width) -->
		<section class="mb-6">
			<CameraPanel />
		</section>
		
		<main class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			<div class="space-y-6 xl:col-span-1">
				<ConnectionPanel />
				
				<DrivingControls 
					onEmergencyStop={showFeedbackMessage}
					onShowAutoModal={() => showAutoModal = true}
				/>

				<NavigationSection 
					{waypoints}
					onViewWaypoints={loadWaypoints}
					onViewRouteAnalysis={loadRouteAnalysis}
				/>
				
				<TeensyTopicPanel />
				
				<RoboticArm />
			</div>

            <div>
				<RosStatusPanel />
				<CommandLog />
            </div>

			<div class="space-y-6 xl:col-span-1">
				<WheelControl />
			</div>

		</main>
	</div>
</div>

<!-- Modals -->
<AutonomousModeModal 
	bind:show={showAutoModal}
	bind:gpsLat
	bind:gpsLon
	onSuccess={(msg) => showFeedbackMessage(msg, 'success')}
	onError={(msg) => showFeedbackMessage(msg, 'error')}
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
		background: linear-gradient(145deg, #222e42, #1a2436);
		border: 1px solid var(--slate-700);
		border-radius: 0.75rem;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.1);
	}

	:global(.btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 600;
		transition: all 0.2s ease;
		border: 1px solid transparent;
	}
	
	:global(.btn:hover) {
		transform: translateY(-2px);
	}

	:global(.btn-primary) {
		background-color: var(--sky-500);
		color: white;
		border-color: var(--sky-500);
	}

	:global(.btn-primary:hover) {
		background-color: var(--sky-400);
		box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
	}

	:global(.btn-secondary) {
		background-color: var(--slate-700);
		color: var(--slate-300);
		border-color: var(--slate-600);
	}
	
	:global(.btn-secondary:hover) {
		background-color: var(--slate-600);
		border-color: var(--slate-500);
		box-shadow: 0 0 15px rgba(100, 116, 139, 0.3);
	}
</style>
