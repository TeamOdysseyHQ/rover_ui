<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	
	// Mission state
	let stage = $state<'reconnaissance' | 'delivery'>('reconnaissance');
	let timeRemaining = $state(10); // minutes
	let objectsFound = $state<any[]>([]);
	let objectsDelivered = $state<any[]>([]);
	let autonomousMode = $state(false);
	let storageCache = $state<any>(null);
	
	// GPS popup state
	let showGpsPopup = $state(false);
	let gpsLatitude = $state('');
	let gpsLongitude = $state('');
	let targetGpsCoords = $state<{lat: string, lon: string} | null>(null);
	
	function openGpsPopup() {
		showGpsPopup = true;
		gpsLatitude = '';
		gpsLongitude = '';
	}
	
	function closeGpsPopup() {
		showGpsPopup = false;
	}
	
	function confirmGpsCoordinates() {
		if (gpsLatitude && gpsLongitude) {
			targetGpsCoords = { lat: gpsLatitude, lon: gpsLongitude };
			autonomousMode = true;
			showGpsPopup = false;
		}
	}
	
	function toggleAutonomousMode() {
		if (autonomousMode) {
			// Disable autonomous mode
			autonomousMode = false;
			targetGpsCoords = null;
		} else {
			// Enable autonomous mode - show GPS popup
			openGpsPopup();
		}
	}
</script>

<!-- GPS Coordinates Popup - Rendered at top level -->
{#if showGpsPopup}
	<div class="popup-overlay" onclick={closeGpsPopup} role="dialog" aria-modal="true">
		<div class="popup-content" onclick={(e) => e.stopPropagation()}>
			<h3 class="popup-title">Enter GPS Coordinates</h3>
			
			<div class="popup-form">
				<div class="form-group">
					<label for="latitude">Latitude</label>
					<input 
						id="latitude"
						type="text" 
						bind:value={gpsLatitude}
						placeholder="e.g., 38.4024"
						class="gps-input"
						autocomplete="off"
					/>
				</div>
				
				<div class="form-group">
					<label for="longitude">Longitude</label>
					<input 
						id="longitude"
						type="text" 
						bind:value={gpsLongitude}
						placeholder="e.g., -110.7920"
						class="gps-input"
						autocomplete="off"
					/>
				</div>
			</div>
			
			<div class="popup-buttons">
				<button class="btn btn-secondary" onclick={closeGpsPopup} type="button">
					Cancel
				</button>
				<button 
					class="btn btn-primary" 
					onclick={confirmGpsCoordinates}
					disabled={!gpsLatitude || !gpsLongitude}
					type="button"
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="rado-mission space-y-6">
	<!-- Mission Stage -->
	<Card>
		<CardHeader>
			<CardTitle>Mission Stage</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-4">
				<div class="stage-buttons">
					<button 
						class="stage-btn"
						class:active={stage === 'reconnaissance'}
						onclick={() => stage = 'reconnaissance'}
					>
						Stage 1: Reconnaissance
					</button>
					<button 
						class="stage-btn"
						class:active={stage === 'delivery'}
						onclick={() => stage = 'delivery'}
					>
						Stage 2: Autonomous Delivery
					</button>
				</div>
				
				<div class="timer">
					<div class="timer-label">Time Remaining:</div>
					<div class="timer-value">{timeRemaining}:00</div>
				</div>
				
				{#if stage === 'delivery'}
					<div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
						<span class="text-sm">Autonomous Mode:</span>
						<Badge variant={autonomousMode ? 'success' : 'secondary'}>
							{autonomousMode ? 'ENABLED (100%)' : 'Manual (50%)'}
						</Badge>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>
	
	{#if stage === 'reconnaissance'}
		<!-- Reconnaissance Stage -->
		<Card>
			<CardHeader>
				<CardTitle>Object Search</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Objects Found:</span>
						<Badge variant="success">{objectsFound.length}</Badge>
					</div>
					
					<button class="btn btn-primary w-full">
						Document Object
					</button>
					
					<button class="btn btn-secondary w-full" disabled={storageCache !== null}>
						Pick Up & Store (Optional)
					</button>
					
					{#if storageCache}
						<div class="storage-status">
							Object stored in cache
						</div>
					{/if}
					
					<div class="object-list">
						{#each objectsFound as obj, i}
							<div class="object-item">
								<span class="object-name">{obj.type}</span>
								<span class="object-gps">{obj.lat}, {obj.lon}</span>
							</div>
						{/each}
					</div>
				</div>
			</CardContent>
		</Card>
	{:else}
		<!-- Delivery Stage -->
		<Card>
			<CardHeader>
				<CardTitle>Object Delivery</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<div class="delivery-stats">
						<div class="stat">
							<div class="stat-label">To Deliver</div>
							<div class="stat-value">{objectsFound.length - objectsDelivered.length}</div>
						</div>
						<div class="stat">
							<div class="stat-label">Delivered</div>
							<div class="stat-value success">{objectsDelivered.length}</div>
						</div>
						<div class="stat">
							<div class="stat-label">Total</div>
							<div class="stat-value">{objectsFound.length}</div>
						</div>
					</div>
					
					<button class="btn btn-primary w-full">
						Pick Up Object
					</button>
					
					<button class="btn btn-secondary w-full">
						Navigate to Delivery Point
					</button>
					
					<button class="btn btn-secondary w-full">
						Confirm Delivery
					</button>
				</div>
			</CardContent>
		</Card>
		
		<Card>
			<CardHeader>
				<CardTitle>Autonomous Control</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<button 
						class="btn w-full"
						class:btn-primary={!autonomousMode}
						class:btn-danger={autonomousMode}
						onclick={toggleAutonomousMode}
					>
						{autonomousMode ? 'Disable Autonomous Mode' : 'Enable Autonomous Mode'}
					</button>
					
					{#if autonomousMode && targetGpsCoords}
						<div class="warning-box">
							<strong>Autonomous Mode Active</strong>
							<p>Target: {targetGpsCoords.lat}, {targetGpsCoords.lon}</p>
							<p>Monitor only - no commands allowed</p>
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

<style>
	.stage-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	
	.stage-btn {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		color: var(--slate-300);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	
	.stage-btn:hover {
		background: var(--slate-700);
		border-color: var(--sky-blue);
	}
	
	.stage-btn.active {
		background: var(--sky-blue);
		border-color: var(--sky-blue);
		color: white;
	}
	
	.timer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
	}
	
	.timer-label {
		font-size: 0.875rem;
		color: var(--slate-400);
	}
	
	.timer-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
	}
	
	.storage-status {
		padding: 0.75rem;
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid rgb(34, 197, 94);
		border-radius: 0.375rem;
		color: rgb(134, 239, 172);
		text-align: center;
		font-size: 0.875rem;
	}
	
	.object-list {
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid var(--slate-700);
		border-radius: 0.5rem;
	}
	
	.object-item {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem;
		border-bottom: 1px solid var(--slate-700);
		font-size: 0.875rem;
	}
	
	.object-item:last-child {
		border-bottom: none;
	}
	
	.object-name {
		font-weight: 600;
		color: var(--slate-200);
	}
	
	.object-gps {
		color: var(--slate-400);
		font-family: monospace;
		font-size: 0.75rem;
	}
	
	.delivery-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	
	.stat {
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		text-align: center;
	}
	
	.stat-label {
		font-size: 0.75rem;
		color: var(--slate-400);
		margin-bottom: 0.5rem;
	}
	
	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
	}
	
	.stat-value.success {
		color: rgb(34, 197, 94);
	}
	
	.btn-danger {
		background: rgb(220, 38, 38);
		color: white;
		border-color: rgb(220, 38, 38);
	}
	
	.btn-danger:hover {
		background: rgb(185, 28, 28);
	}
	
	.warning-box {
		padding: 1rem;
		background: rgba(234, 179, 8, 0.2);
		border: 1px solid rgb(234, 179, 8);
		border-radius: 0.5rem;
		color: rgb(250, 204, 21);
	}
	
	.warning-box strong {
		display: block;
		margin-bottom: 0.25rem;
	}
	
	.warning-box p {
		font-size: 0.875rem;
		margin: 0;
		opacity: 0.9;
	}
	
	/* GPS Popup Styles */
	.popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		backdrop-filter: blur(4px);
	}
	
	.popup-content {
		background: var(--slate-900);
		border: 2px solid var(--slate-700);
		border-radius: 0.5rem;
		padding: 1.5rem;
		width: 90%;
		max-width: 400px;
		box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5);
		position: relative;
		z-index: 10000;
	}
	
	.popup-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: white;
		margin: 0 0 1.5rem 0;
	}
	
	.popup-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--slate-300);
	}
	
	.gps-input {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		color: white;
		font-size: 0.875rem;
		font-family: 'Courier New', monospace;
		transition: border-color 0.15s;
	}
	
	.gps-input:focus {
		outline: none;
		border-color: var(--sky-blue);
	}
	
	.gps-input::placeholder {
		color: var(--slate-500);
	}
	
	.popup-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}
	
	.popup-buttons .btn {
		width: auto;
		padding: 0.625rem 1.25rem;
	}
	
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
