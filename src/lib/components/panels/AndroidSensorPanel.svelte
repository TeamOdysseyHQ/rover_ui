<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Smartphone, Navigation, Compass, Activity, Loader2 } from 'lucide-svelte';
	import {
		androidSensorData,
		isAndroidConnected,
		connectToAndroidSensors,
		disconnectFromAndroidSensors,
		resetReconnectionAttempts
	} from '$lib/stores/androidSensorStore';
	import { roverApiUrl } from '$lib/stores/apiStore';

	// Props
	let { autoConnect = true }: { autoConnect?: boolean } = $props();

	// Derived sensor values
	let gps = $derived($androidSensorData.gps);
	let accelerometer = $derived($androidSensorData.accelerometer);
	let gyroscope = $derived($androidSensorData.gyroscope);
	let compass = $derived($androidSensorData.compass);
	let connected = $derived($androidSensorData.connected);
	let lastUpdate = $derived($androidSensorData.lastUpdate);

	// Connection management
	let isConnecting = $state(false);

	async function handleConnect() {
		isConnecting = true;
		try {
			resetReconnectionAttempts();
			connectToAndroidSensors($roverApiUrl);
		} catch (error) {
			console.error('Failed to connect to Android sensors:', error);
		} finally {
			setTimeout(() => {
				isConnecting = false;
			}, 1000);
		}
	}

	function handleDisconnect() {
		disconnectFromAndroidSensors();
	}

	// Auto-connect on mount
	$effect(() => {
		if (autoConnect) {
			handleConnect();
		}

		return () => {
			// Cleanup on unmount
			disconnectFromAndroidSensors();
		};
	});

	// Format helpers
	function formatCoordinate(value: number | undefined, decimals: number = 6): string {
		if (value === undefined || value === null) return 'N/A';
		return value.toFixed(decimals);
	}

	function formatValue(value: number | undefined, decimals: number = 2): string {
		if (value === undefined || value === null) return 'N/A';
		return value.toFixed(decimals);
	}

	function formatAngle(value: number | undefined): string {
		if (value === undefined || value === null) return 'N/A';
		return `${value.toFixed(1)}°`;
	}

	function formatTimestamp(timestamp: string | null): string {
		if (!timestamp) return 'Never';
		try {
			return new Date(timestamp).toLocaleTimeString();
		} catch {
			return 'Invalid';
		}
	}
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Smartphone class="w-5 h-5 text-sky-blue" />
				<Card.Title>Android Sensors</Card.Title>
			</div>
			<div class="flex items-center gap-2">
				{#if connected}
					<Badge variant="default" class="bg-green-500">Connected</Badge>
				{:else}
					<Badge variant="secondary">Disconnected</Badge>
				{/if}
				{#if connected}
					<Button variant="outline" size="sm" onclick={handleDisconnect}>
						Disconnect
					</Button>
				{:else}
					<Button variant="outline" size="sm" onclick={handleConnect} disabled={isConnecting}>
						{#if isConnecting}
							<Loader2 class="w-4 h-4 animate-spin mr-1" />
						{/if}
						Connect
					</Button>
				{/if}
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4 pt-4">
		{#if !connected}
			<div class="empty-state">
				<Smartphone class="w-12 h-12 text-slate-600" />
				<span class="text-sm text-slate-400">Not connected to Android device</span>
				<span class="text-xs text-slate-500">
					Ensure the Android app is running and connected to port 8989
				</span>
			</div>
		{:else}
			<!-- GPS Data -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Navigation class="w-4 h-4" />
					GPS Location
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">Latitude</span>
						<span class="sensor-value">
							{gps ? formatCoordinate((gps as any).latitude) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Longitude</span>
						<span class="sensor-value">
							{gps ? formatCoordinate((gps as any).longitude) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Accuracy</span>
						<span class="sensor-value">
							{gps && (gps as any).accuracy !== undefined ? `${(gps as any).accuracy.toFixed(1)} m` : 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Compass Data -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Compass class="w-4 h-4" />
					Compass Orientation
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">Azimuth</span>
						<span class="sensor-value">
							{compass ? formatAngle((compass as any).azimuth) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Pitch</span>
						<span class="sensor-value">
							{compass ? formatAngle((compass as any).pitch) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Roll</span>
						<span class="sensor-value">
							{compass ? formatAngle((compass as any).roll) : 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Accelerometer Data -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Activity class="w-4 h-4" />
					Accelerometer
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">X-Axis</span>
						<span class="sensor-value">
							{accelerometer ? formatValue((accelerometer as any).x) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Y-Axis</span>
						<span class="sensor-value">
							{accelerometer ? formatValue((accelerometer as any).y) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Z-Axis</span>
						<span class="sensor-value">
							{accelerometer ? formatValue((accelerometer as any).z) : 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Gyroscope Data -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Activity class="w-4 h-4" />
					Gyroscope
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">X-Axis</span>
						<span class="sensor-value">
							{gyroscope ? formatValue((gyroscope as any).x) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Y-Axis</span>
						<span class="sensor-value">
							{gyroscope ? formatValue((gyroscope as any).y) : 'N/A'}
						</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Z-Axis</span>
						<span class="sensor-value">
							{gyroscope ? formatValue((gyroscope as any).z) : 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Last Updated -->
			<div class="timestamp">
				Last updated: {formatTimestamp(lastUpdate)}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		gap: 0.75rem;
	}

	.sensor-section {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.5rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--slate-300);
		margin-bottom: 0.75rem;
	}

	.sensor-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.sensor-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sensor-label {
		font-size: 0.75rem;
		color: var(--slate-400);
		font-weight: 500;
	}

	.sensor-value {
		font-size: 1rem;
		color: var(--slate-200);
		font-family: monospace;
		font-weight: 600;
	}

	.timestamp {
		padding: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--slate-500);
		font-style: italic;
	}
</style>
