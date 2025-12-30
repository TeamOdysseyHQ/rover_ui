<script>
	import { 
		Bot, Route, Archive, Download, Construction, ArrowDownUp, TestTubes, 
		RotateCcw, RotateCw, BatteryCharging, Zap, Thermometer, Antenna,
		ScanLine, Aperture, Maximize, FileDown, AlertCircle, CheckCircle
	} from 'lucide-svelte';
	import { apiStatus, commandHistory, logCommand } from '$lib/stores/apiStore';
	import * as roverApi from '$lib/services/roverApi';
	import Joystick from '$lib/components/Joystick.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConnectionPanel from '$lib/components/ConnectionPanel.svelte';
	import CommandLog from '$lib/components/CommandLog.svelte';
	import CameraPanel from '$lib/components/CameraPanel.svelte';
	
	let showAutoModal = false;
	let showReportsModal = false;
	let showWaypointsModal = false;
	let showRouteAnalysisModal = false;
	let ackermanMode = true;
	let independentMode = false;
	let drillSpeed = 50;
	let testTubeSlot = 3;
	
	// Feedback message state
	let feedbackMessage = '';
	let feedbackType = 'success'; // 'success' | 'error' | 'info'
	let showFeedback = false;
	
	// Data state
	let waypoints = [];
	let reports = [];
	let routeAnalysis = null;
	let diagnosticsResult = null;
	
	// Helper function to show feedback messages
	function showFeedbackMessage(message, type = 'success') {
		feedbackMessage = message;
		feedbackType = type;
		showFeedback = true;
		
		setTimeout(() => {
			showFeedback = false;
		}, 5000);
	}
	
	// NOT IMPLEMENTED: Joystick control (no backend endpoint)
	function handleJoystickMove(event) {
		console.log('Joystick move (not implemented in backend):', event.detail.x, event.detail.y);
		logCommand({ type: 'JOYSTICK_MOVE', data: { x: event.detail.x, y: event.detail.y } }, 'sent');
	}
	
	// NOT IMPLEMENTED: Steering mode toggle (no backend endpoint)
	function toggleSteeringMode(mode) {
		if (mode === 'ackerman') {
			ackermanMode = !ackermanMode;
			console.log('Steering mode (Ackerman - not implemented in backend):', ackermanMode);
		} else {
			independentMode = !independentMode;
			console.log('Steering mode (Independent - not implemented in backend):', independentMode);
		}
	}
	
	// NOT IMPLEMENTED: Drill speed control (no backend endpoint)
	function handleDrillSpeed(value) {
		drillSpeed = value;
		console.log('Drill speed (not implemented in backend):', value);
		logCommand({ type: 'DRILL_SPEED', data: { speed: value } }, 'sent');
	}
	
	// NOT IMPLEMENTED: Test tube rotation (no backend endpoint)
	function rotateTestTube(direction) {
		testTubeSlot = direction === 'left' 
			? Math.max(1, testTubeSlot - 1)
			: Math.min(6, testTubeSlot + 1);
		console.log('Test tube slot (not implemented in backend):', testTubeSlot, 'direction:', direction);
	}
	
	// IMPLEMENTED: Add waypoint for autonomous navigation
	async function initiateAutonomous() {
		try {
			const data = {
				latitude: parseFloat(gpsLat),
				longitude: parseFloat(gpsLon),
				description: 'Autonomous destination',
				waypoint_type: 'destination'
			};
			
			logCommand({ type: 'ADD_WAYPOINT', data }, 'sent');
			const result = await roverApi.addWaypoint(data);
			logCommand({ type: 'ADD_WAYPOINT', data }, 'success', result);
			
			showFeedbackMessage(`Waypoint added: ${result.waypoint_id}`, 'success');
			showAutoModal = false;
		} catch (error) {
			logCommand({ type: 'ADD_WAYPOINT', data: { latitude: gpsLat, longitude: gpsLon } }, 'error', error.message);
			showFeedbackMessage(`Failed to add waypoint: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Capture test image
	async function captureTestImage() {
		try {
			logCommand({ type: 'CAPTURE_TEST_DATA' }, 'sent');
			const result = await roverApi.captureTestData({
				latitude: gpsLat,
				longitude: gpsLon,
				camera: 'test_camera'
			});
			logCommand({ type: 'CAPTURE_TEST_DATA' }, 'success', result);
			
			showFeedbackMessage(`Test image captured: ${result.filename}`, 'success');
		} catch (error) {
			logCommand({ type: 'CAPTURE_TEST_DATA' }, 'error', error.message);
			showFeedbackMessage(`Failed to capture image: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Generate comprehensive report
	async function generateFullReport() {
		try {
			logCommand({ type: 'GENERATE_REPORT' }, 'sent');
			const result = await roverApi.generateComprehensiveReport();
			logCommand({ type: 'GENERATE_REPORT' }, 'success', result);
			
			showFeedbackMessage(`Report generated: ${result.report_file}`, 'success');
		} catch (error) {
			logCommand({ type: 'GENERATE_REPORT' }, 'error', error.message);
			showFeedbackMessage(`Failed to generate report: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Run ROS2 diagnostics
	async function runDiagnostics() {
		try {
			logCommand({ type: 'RUN_DIAGNOSTICS' }, 'sent');
			const result = await roverApi.runDoctor();
			logCommand({ type: 'RUN_DIAGNOSTICS' }, 'success', result);
			
			diagnosticsResult = result;
			showFeedbackMessage('Diagnostics completed', 'success');
		} catch (error) {
			logCommand({ type: 'RUN_DIAGNOSTICS' }, 'error', error.message);
			showFeedbackMessage(`Diagnostics failed: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Load waypoints
	async function loadWaypoints() {
		try {
			const result = await roverApi.getWaypoints();
			waypoints = result.waypoints || [];
			showWaypointsModal = true;
		} catch (error) {
			showFeedbackMessage(`Failed to load waypoints: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Load reports
	async function loadReports() {
		try {
			const result = await roverApi.listReports();
			reports = result.reports || [];
			showReportsModal = true;
		} catch (error) {
			showFeedbackMessage(`Failed to load reports: ${error.message}`, 'error');
		}
	}
	
	// IMPLEMENTED: Load route analysis
	async function loadRouteAnalysis() {
		try {
			const result = await roverApi.getRouteAnalysis();
			routeAnalysis = result;
			showRouteAnalysisModal = true;
		} catch (error) {
			showFeedbackMessage(`Failed to load route analysis: ${error.message}`, 'error');
		}
	}
	
	let siteReason = '';
	let gpsLat = '16.5062';
	let gpsLon = '80.6480';
	
	const cameras = [
		{ id: 'front', label: 'CAM_FRONT_HAZ', checked: true },
		{ id: 'rear', label: 'CAM_REAR_HAZ', checked: false },
		{ id: 'arm', label: 'CAM_SCIENCE_ARM', checked: false },
		{ id: 'mast', label: 'CAM_MAST_NAV', checked: false },
		{ id: 'microscope', label: 'MICROSCOPE_IMAGER', checked: false }
	];
	
	const wheels = ['front_left', 'front_right', 'rear_left', 'rear_right'];
	let wheelSpeeds = { 'front_left': 100, 'front_right': 100, 'rear_left': 100, 'rear_right': 100 };
	let wheelDirections = { 'front_left': 0, 'front_right': 0, 'rear_left': 0, 'rear_right': 0 };

</script>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="max-w-screen-2xl mx-auto">
		<!-- Feedback Message -->
		{#if showFeedback}
		<div class="mb-4 p-4 rounded-lg flex items-center gap-3 {feedbackType === 'success' ? 'bg-green-900/50 border border-green-500' : feedbackType === 'error' ? 'bg-red-900/50 border border-red-500' : 'bg-blue-900/50 border border-blue-500'}">
			{#if feedbackType === 'success'}
				<CheckCircle class="w-5 h-5 text-green-400" />
			{:else if feedbackType === 'error'}
				<AlertCircle class="w-5 h-5 text-red-400" />
			{:else}
				<AlertCircle class="w-5 h-5 text-blue-400" />
			{/if}
			<p class="text-white">{feedbackMessage}</p>
			<button on:click={() => showFeedback = false} class="ml-auto text-slate-400 hover:text-white">✕</button>
		</div>
		{/if}
		
		<!-- Header -->
		<header class="flex justify-between items-center mb-6">
			<div>
				<h1 class="text-2xl font-bold text-white">Anveshak Rover Command Center</h1>
				<p class="text-sm text-slate-400">
					STATUS: <span class="text-green-400 font-semibold">NOMINAL</span> | 
					LINK: <span class="{$apiStatus === 'connected' ? 'text-green-400' : 'text-red-400'} font-semibold">
						{$apiStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}
					</span> | 
					DEC 12 2025, 12:40 IST
				</p>
			</div>
			<div class="flex items-center gap-4">
				<div class="text-right">
					<p class="font-semibold text-white">Client</p>
				</div>
				<img src="https://placehold.co/40x40/0ea5e9/ffffff?text=C" alt="User Avatar" class="rounded-full">
			</div>
		</header>

		<!-- Camera Section (Full Width) -->
		<section class="mb-6">
			<CameraPanel />
		</section>
		
		<!-- Main Content Grid -->
		<main class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			
			<!-- Column 1: Primary Driving & Navigation -->
			<div class="space-y-6 xl:col-span-1">
				<ConnectionPanel />
				<CommandLog />
				
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Driving Controls</h2>
					</div>
					<div class="p-4 flex justify-between items-center">
						<div>
							<h3 class="font-semibold text-white">Mode: Manual</h3>
							<p class="text-sm text-slate-400">Ready for input</p>
						</div>
						<button class="btn btn-primary" on:click={() => showAutoModal = true}>
							<Bot class="w-4 h-4 mr-2" />Go Autonomous
						</button>
					</div>
					<div class="p-4 flex justify-around items-center">
						<Joystick on:move={handleJoystickMove} />
						<div>
							<h3 class="font-semibold mb-2 text-center text-white">Steering</h3>
							<div class="flex items-center gap-2 mb-2">
								<label class="text-sm">Ackerman</label>
								<ToggleSwitch 
									checked={ackermanMode}
									on:change={() => toggleSteeringMode('ackerman')}
								/>
							</div>
							<div class="flex items-center gap-2">
								<label class="text-sm">Independent</label>
								<ToggleSwitch 
									checked={independentMode}
									on:change={() => toggleSteeringMode('independent')}
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Navigation & Journey</h2>
					</div>
					<div class="p-4 space-y-3 text-sm">
						<p class="flex justify-between"><strong>GPS Coordinates:</strong> <span>16.5062° N, 80.6480° E</span></p>
						<p class="flex justify-between"><strong>Total Waypoints:</strong> <span class="text-sky-400">{waypoints.length}</span></p>
						<p class="flex justify-between"><strong>Reports Generated:</strong> <span class="text-amber-400">{reports.length}</span></p>
						<p class="flex justify-between"><strong>API Status:</strong> <span class="{$apiStatus === 'connected' ? 'text-green-400' : 'text-red-400'}">{$apiStatus.toUpperCase()}</span></p>
					</div>
					<div class="p-4 border-t border-slate-700 space-y-2">
						<!-- IMPLEMENTED: View waypoints -->
						<button 
							class="btn btn-secondary w-full"
							on:click={loadWaypoints}
							disabled={$apiStatus !== 'connected'}
						>
							<Route class="w-4 h-4 mr-2" />View Waypoints
						</button>
						<!-- IMPLEMENTED: View route analysis -->
						<button 
							class="btn btn-secondary w-full"
							on:click={loadRouteAnalysis}
							disabled={$apiStatus !== 'connected'}
						>
							<Route class="w-4 h-4 mr-2" />Route Analysis
						</button>
					</div>
				</div>
				
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Robotic Arm</h2>
					</div>
					<div class="p-4 space-y-3">
						<!-- NOT IMPLEMENTED: Backend does not handle ARM commands yet -->
						<button 
							class="btn btn-primary w-full"
							on:click={() => console.log('Drop in storage (not implemented)')}
						>
							<Archive class="w-4 h-4 mr-2" />Drop in Storage Box
						</button>
						<button 
							class="btn btn-secondary w-full"
							on:click={() => console.log('Drop outside (not implemented)')}
						>
							<Download class="w-4 h-4 mr-2" />Drop Outside Rover
						</button>
					</div>
				</div>
			</div>

			<!-- Column 2: Science Operations -->
			<div class="space-y-6 xl:col-span-1">
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Science Operations</h2>
					</div>
					<div class="p-4 space-y-6">
						<!-- Drill Controls -->
						<div class="space-y-3">
							<h3 class="font-semibold text-white flex items-center gap-2">
								<Construction class="text-sky-400" />Drill System
							</h3>
							<!-- NOT IMPLEMENTED: Backend does not handle DRILL_TOGGLE yet -->
							<div class="flex justify-between items-center">
								<span>Drill Status</span>
								<ToggleSwitch 
									on:change={(e) => console.log('Drill toggle (not implemented):', e.detail)}
								/>
							</div>
							<!-- IMPLEMENTED: Backend handles DRILL_SPEED with speed data -->
							<label class="block text-sm font-medium">
								Drill Speed: <span>{drillSpeed}%</span>
							</label>
							<input 
								type="range" 
								min="0" 
								max="100" 
								bind:value={drillSpeed}
								on:input={(e) => handleDrillSpeed(e.target.value)}
								class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
							>
						</div>
						<!-- Collection -->
						<div class="space-y-3">
							<h3 class="font-semibold text-white flex items-center gap-2">
								<ArrowDownUp class="text-sky-400" />Collection System
							</h3>
							<!-- NOT IMPLEMENTED: Backend does not handle LINEAR_ACTUATOR yet -->
							<div class="flex justify-between items-center">
								<span>Linear Actuator</span>
								<ToggleSwitch 
									on:change={(e) => console.log('Linear actuator (not implemented):', e.detail)}
								/>
							</div>
							<!-- NOT IMPLEMENTED: Backend does not handle SUCTION_SYSTEM yet -->
							<div class="flex justify-between items-center">
								<span>Suction System</span>
								<ToggleSwitch 
									on:change={(e) => console.log('Suction system (not implemented):', e.detail)}
								/>
							</div>
							<!-- NOT IMPLEMENTED: Backend does not handle WATER_DISPENSE yet -->
							<div class="flex justify-between items-center">
								<span>Water Sprinkler</span>
								<button 
									class="btn btn-secondary text-sm"
									on:click={() => console.log('Water dispense (not implemented)')}
								>
									Dispense
								</button>
							</div>
						</div>
						<!-- Sample Carousel -->
						<div class="space-y-3">
							<h3 class="font-semibold text-white flex items-center gap-2">
								<TestTubes class="text-sky-400" />Sample Analysis
							</h3>
							<!-- NOT IMPLEMENTED: Backend does not handle TEST_TUBE_ROTATE yet -->
							<div class="flex justify-between items-center">
								<span>Test Tube Module</span>
								<div class="flex gap-2">
									<button class="btn btn-secondary" on:click={() => rotateTestTube('left')}>
										<RotateCcw />
									</button>
									<span class="p-2 bg-slate-700 rounded-md w-16 text-center font-mono">
										SLOT {testTubeSlot}
									</span>
									<button class="btn btn-secondary" on:click={() => rotateTestTube('right')}>
										<RotateCw />
									</button>
								</div>
							</div>
							<!-- NOT IMPLEMENTED: Backend does not handle LOG_SITE_REASON yet -->
							<div class="flex items-end gap-2">
								<div class="flex-grow">
									<label class="text-xs font-medium">Reason for choosing site:</label>
									<input 
										bind:value={siteReason}
										type="text" 
										class="w-full mt-1 bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
										placeholder="e.g., High mineral concentration..."
									>
								</div>
								<button 
									class="btn btn-primary"
									on:click={() => console.log('Log site reason (not implemented):', siteReason, testTubeSlot)}
								>
									Log
								</button>
							</div>
						</div>
					</div>
				</div>
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Soil & Chemical Analysis</h2>
					</div>
					<div class="p-4 space-y-4">
						<!-- NOT IMPLEMENTED: Backend does not handle PREDICT_SOIL_TYPE yet -->
						<button 
							class="btn btn-primary w-full mb-2"
							on:click={() => console.log('Predict soil type (not implemented)')}
						>
							Predict Soil Type (from Microscope)
						</button>
						<input 
							type="text" 
							class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
							placeholder="Manual Soil Entry..."
						>
						<div class="p-4 bg-slate-900 rounded-lg flex items-center justify-center gap-4">
							<div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 border-4 border-slate-700"></div>
							<p class="font-semibold text-lg">Test: <span class="text-white">Perchlorate+</span></p>
						</div>
					</div>
				</div>
			</div>

			<!-- Column 3: System Health & Data -->
			<div class="space-y-6 xl:col-span-1">
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">System Health</h2>
					</div>
					<div class="p-4 grid grid-cols-2 gap-4">
						<!-- Battery -->
						<div class="flex flex-col items-center">
							<h3 class="font-semibold text-white mb-2 flex items-center gap-2">
								<BatteryCharging class="text-green-400" />Battery
							</h3>
							<div class="relative w-24 h-24">
								<svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
									<circle class="text-slate-700" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3"></circle>
									<circle class="text-green-500" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="85, 100" stroke-linecap="round"></circle>
								</svg>
								<div class="absolute inset-0 flex flex-col items-center justify-center">
									<span class="text-2xl font-bold text-white">85%</span>
								</div>
							</div>
							<p class="text-xs text-slate-400 mt-2">Health: 98%</p>
						</div>
						<!-- Power -->
						<div class="flex flex-col items-center">
							<h3 class="font-semibold text-white mb-2 flex items-center gap-2">
								<Zap class="text-amber-400" />Power
							</h3>
							<div class="relative w-24 h-24">
								<svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
									<circle class="text-slate-700" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3"></circle>
									<circle class="text-amber-500" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="75, 100" stroke-linecap="round"></circle>
								</svg>
								<div class="absolute inset-0 flex flex-col items-center justify-center">
									<span class="text-2xl font-bold text-white">120<span class="text-lg">W</span></span>
								</div>
							</div>
							<p class="text-xs text-slate-400 mt-2">Consumption</p>
						</div>
					</div>
					<div class="p-4 border-t border-slate-700">
						<h3 class="font-semibold text-white mb-2 flex items-center gap-2">
							<Thermometer class="text-red-400" />Heat Status
						</h3>
						<ul class="text-xs space-y-2 text-slate-400">
							<li class="flex justify-between"><span>Ambient Temp</span><span class="font-semibold text-white">-15° C</span></li>
							<li class="flex justify-between"><span>Battery Core</span><span class="text-amber-400">25° C</span></li>
							<li class="flex justify-between"><span>CPU Avionics</span><span class="text-green-400">42° C</span></li>
						</ul>
					</div>
				</div>
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Data & Comms</h2>
					</div>
					<div class="p-4 space-y-4">
						<div class="flex justify-between items-center">
							<h3 class="font-semibold text-white flex items-center gap-2">
								<Antenna class="text-sky-400" />TX/RX Rate
							</h3>
							<span class="text-xl font-bold text-sky-400">2 Mbps</span>
						</div>
						<!-- NOT IMPLEMENTED: Backend does not handle ANTENNA_AUTO yet -->
						<div class="flex justify-between items-center">
							<h3 class="font-semibold text-white">Antenna Alignment</h3>
							<div class="flex items-center gap-2">
								<label class="text-sm">Auto</label>
								<ToggleSwitch 
									checked={true}
									on:change={(e) => console.log('Antenna auto (not implemented):', e.detail)}
								/>
							</div>
						</div>
						<!-- NOT IMPLEMENTED: Backend does not handle SCAN_FREQUENCIES yet -->
						<button 
							class="btn btn-secondary w-full"
							on:click={() => console.log('Scan frequencies (not implemented)')}
						>
							<ScanLine class="w-4 h-4 mr-2" />Scan Frequencies
						</button>
					</div>
				</div>
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Imaging & Reports</h2>
					</div>
					<div class="p-4 space-y-3">
						<!-- IMPLEMENTED: Capture test image -->
						<button 
							class="btn btn-secondary w-full"
							on:click={captureTestImage}
							disabled={$apiStatus !== 'connected'}
						>
							<Aperture class="w-4 h-4 mr-2" />Capture Test Image
						</button>
						<!-- IMPLEMENTED: Run diagnostics -->
						<button 
							class="btn btn-secondary w-full"
							on:click={runDiagnostics}
							disabled={$apiStatus !== 'connected'}
						>
							<ScanLine class="w-4 h-4 mr-2" />Run ROS2 Diagnostics
						</button>
						<!-- IMPLEMENTED: Generate comprehensive report -->
						<button 
							class="btn btn-primary w-full mt-4 border-t border-slate-700 pt-3"
							on:click={generateFullReport}
							disabled={$apiStatus !== 'connected'}
						>
							<FileDown class="w-4 h-4 mr-2" />Generate Full Report (PDF)
						</button>
						<!-- IMPLEMENTED: View reports -->
						<button 
							class="btn btn-secondary w-full"
							on:click={loadReports}
							disabled={$apiStatus !== 'connected'}
						>
							<FileDown class="w-4 h-4 mr-2" />View Reports
						</button>
					</div>
				</div>
			</div>

			<!-- Column 4: Transmission & Wheel Control -->
			<div class="space-y-6 xl:col-span-1">
				<div class="card">
					<div class="p-4 border-b border-slate-700 flex justify-between items-center">
						<h2 class="font-semibold text-lg text-white">Data Transmission</h2>
					</div>
					<div class="p-4 space-y-3">
						{#each cameras as camera}
							<div class="flex items-center justify-between p-2 bg-slate-900 rounded-lg">
								<span class="font-medium text-sm">{camera.label}</span>
								<!-- NOT IMPLEMENTED: Backend does not handle camera feeds yet -->
								<ToggleSwitch 
									checked={camera.checked}
									on:change={(e) => console.log('Camera feed (not implemented):', camera.id, e.detail)}
								/>
							</div>
						{/each}
						<div class="flex items-center justify-between p-2 bg-slate-700 rounded-lg mt-2 border-t border-slate-600 pt-3">
							<span class="font-medium text-sm">Cost Map Feed</span>
							<!-- NOT IMPLEMENTED: Backend does not handle COST_MAP_FEED yet -->
							<ToggleSwitch 
								on:change={(e) => console.log('Cost map feed (not implemented):', e.detail)}
							/>
						</div>
					</div>
				</div>
				<div class="card">
					<div class="p-4 border-b border-slate-700">
						<h2 class="font-semibold text-lg text-white">Individual Wheel Control</h2>
					</div>
					<div class="p-4 grid grid-cols-2 gap-x-4 gap-y-6">
						{#each wheels as wheel}
							<div>
								<h3 class="font-semibold text-sm text-center text-white capitalize">{wheel.replace('_', ' ')}</h3>
								<!-- NOT IMPLEMENTED: Backend does not handle wheel speed yet -->
								<label class="block text-xs">Speed: <span>{wheelSpeeds[wheel]}%</span></label>
								<input 
									type="range" 
									class="w-full" 
									bind:value={wheelSpeeds[wheel]}
									on:input={() => console.log('Wheel speed (not implemented):', wheel, wheelSpeeds[wheel])}
								>
								<!-- NOT IMPLEMENTED: Backend does not handle wheel direction yet -->
								<label class="block text-xs">Direction: <span>{wheelDirections[wheel]}°</span></label>
								<input 
									type="range" 
									class="w-full" 
									min="-45" 
									max="45" 
									bind:value={wheelDirections[wheel]}
									on:input={() => console.log('Wheel direction (not implemented):', wheel, wheelDirections[wheel])}
								>
							</div>
						{/each}
					</div>
				</div>
			</div>

		</main>
	</div>
</div>

{#if showAutoModal}
	<Modal bind:show={showAutoModal} title="Switch to Autonomous Mode">
		<p class="text-slate-400 mb-6">
			Enter the destination GPS coordinates to begin the autonomous journey. The rover will calculate the optimal path.
		</p>
		<div class="space-y-4">
			<div>
				<label for="gps-lat" class="block text-sm font-medium mb-1">Destination Latitude</label>
				<input 
					id="gps-lat" 
					type="text"
					bind:value={gpsLat}
					class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
					placeholder="e.g., 18.4521° S"
				>
			</div>
			<div>
				<label for="gps-lon" class="block text-sm font-medium mb-1">Destination Longitude</label>
				<input 
					id="gps-lon" 
					type="text"
					bind:value={gpsLon}
					class="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" 
					placeholder="e.g., 77.3663° E"
				>
			</div>
		</div>
		<div class="mt-8 flex justify-end gap-4">
			<button class="btn btn-secondary" on:click={() => showAutoModal = false}>Cancel</button>
			<button 
				class="btn btn-primary"
				on:click={initiateAutonomous}
			>
				Add Waypoint & Start
			</button>
		</div>
	</Modal>
{/if}

{#if showWaypointsModal}
	<Modal bind:show={showWaypointsModal} title="Mission Waypoints">
		{#if waypoints.length === 0}
			<p class="text-slate-400">No waypoints found.</p>
		{:else}
			<div class="space-y-3 max-h-96 overflow-y-auto">
				{#each waypoints as waypoint, index}
					<div class="p-4 bg-slate-800 rounded-lg border border-slate-700">
						<div class="flex justify-between items-start mb-2">
							<h3 class="font-semibold text-white">Waypoint #{index + 1}</h3>
							<span class="text-xs px-2 py-1 bg-sky-500/20 text-sky-400 rounded">{waypoint.waypoint_type || 'unknown'}</span>
						</div>
						<div class="text-sm space-y-1">
							<p><strong>Latitude:</strong> {waypoint.latitude}°</p>
							<p><strong>Longitude:</strong> {waypoint.longitude}°</p>
							{#if waypoint.description}
								<p><strong>Description:</strong> {waypoint.description}</p>
							{/if}
							{#if waypoint.timestamp}
								<p class="text-slate-400"><strong>Time:</strong> {new Date(waypoint.timestamp).toLocaleString()}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
		<div class="mt-6 flex justify-end">
			<button class="btn btn-secondary" on:click={() => showWaypointsModal = false}>Close</button>
		</div>
	</Modal>
{/if}

{#if showReportsModal}
	<Modal bind:show={showReportsModal} title="Generated Reports">
		{#if reports.length === 0}
			<p class="text-slate-400">No reports found.</p>
		{:else}
			<div class="space-y-3 max-h-96 overflow-y-auto">
				{#each reports as report}
					<div class="p-4 bg-slate-800 rounded-lg border border-slate-700">
						<div class="flex justify-between items-start">
							<div>
								<h3 class="font-semibold text-white">{report.filename || 'Report'}</h3>
								{#if report.created_at}
									<p class="text-xs text-slate-400 mt-1">{new Date(report.created_at).toLocaleString()}</p>
								{/if}
							</div>
							{#if report.path}
								<a href={report.path} download class="btn btn-primary text-xs">
									<Download class="w-3 h-3 mr-1" />Download
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
		<div class="mt-6 flex justify-end">
			<button class="btn btn-secondary" on:click={() => showReportsModal = false}>Close</button>
		</div>
	</Modal>
{/if}

{#if showRouteAnalysisModal}
	<Modal bind:show={showRouteAnalysisModal} title="Route Analysis">
		{#if routeAnalysis}
			<div class="space-y-4">
				<div class="p-4 bg-slate-800 rounded-lg">
					<h3 class="font-semibold text-white mb-3">Mission Statistics</h3>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<p class="text-slate-400">Total Distance</p>
							<p class="text-xl font-bold text-sky-400">{routeAnalysis.total_distance || 'N/A'} m</p>
						</div>
						<div>
							<p class="text-slate-400">Waypoints</p>
							<p class="text-xl font-bold text-sky-400">{routeAnalysis.waypoint_count || 0}</p>
						</div>
						<div>
							<p class="text-slate-400">Images Captured</p>
							<p class="text-xl font-bold text-green-400">{routeAnalysis.images_count || 0}</p>
						</div>
						<div>
							<p class="text-slate-400">Mission Time</p>
							<p class="text-xl font-bold text-amber-400">{routeAnalysis.duration || 'N/A'}</p>
						</div>
					</div>
				</div>
				{#if routeAnalysis.path_segments}
					<div class="p-4 bg-slate-800 rounded-lg">
						<h3 class="font-semibold text-white mb-3">Path Segments</h3>
						<div class="space-y-2 max-h-48 overflow-y-auto">
							{#each routeAnalysis.path_segments as segment, index}
								<div class="text-sm p-2 bg-slate-900 rounded">
									<p><strong>Segment {index + 1}:</strong> {segment.distance}m</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<p class="text-slate-400">No route analysis data available.</p>
		{/if}
		<div class="mt-6 flex justify-end">
			<button class="btn btn-secondary" on:click={() => showRouteAnalysisModal = false}>Close</button>
		</div>
	</Modal>
{/if}

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
