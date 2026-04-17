<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Loader2, RefreshCw, Thermometer, Droplet, Gauge, Mountain, Wind, Beaker, TestTube } from 'lucide-svelte';
	import { getScienceSensorData } from '$lib/services/roverApi';

	// Props
	let { autoRefresh = true }: { autoRefresh?: boolean } = $props();

	// State
	let sensorData = $state<any>(null);
	let isLoading = $state(false);
	let lastUpdated = $state<Date | null>(null);
	let errorMessage = $state('');

	// Parsed sensor values
	let colorDetection = $derived(sensorData?.cs_tcs_34725 || 'N/A');
	let humidity = $derived(sensorData?.humidity ?? null);
	let temperature = $derived(sensorData?.['gy-bmp280_temp'] ?? null);
	let pressure = $derived(sensorData?.['gy-bmp280_pressure'] ?? null);
	let altitude = $derived(sensorData?.['gy-bmp280_altitude'] ?? null);
	let co2 = $derived(sensorData?.mq_135 ?? null);
	let ph = $derived(sensorData?.ph ?? null);
	let nitrogen = $derived(sensorData?.NPK_sensor_nitrogen ?? null);
	let phosphorus = $derived(sensorData?.NPK_sensor_phos ?? null);
	let potassium = $derived(sensorData?.NPK_sensor_potassium ?? null);
	let distance = $derived(sensorData?.vl53lox ?? null);
	let gps = $derived(sensorData?.gps || 'N/A');

	// Polling interval
	let pollInterval: number | null = null;

	async function fetchSensorData() {
		isLoading = true;
		errorMessage = '';

		try {
			const result = await getScienceSensorData();
			if (result.success && result.data) {
				sensorData = result.data;
				lastUpdated = new Date();
			} else {
				errorMessage = result.message || 'Failed to fetch sensor data';
			}
		} catch (error) {
			errorMessage = 'Error fetching sensor data';
			console.error(error);
		} finally {
			isLoading = false;
		}
	}

	function startAutoRefresh() {
		if (pollInterval) return;
		fetchSensorData(); // Immediate fetch
		pollInterval = window.setInterval(fetchSensorData, 2000); // Every 2 seconds
	}

	function stopAutoRefresh() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			stopAutoRefresh();
		};
	});

	// Auto-refresh control
	$effect(() => {
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	});

	function formatValue(value: number | null, unit: string, decimals: number = 1): string {
		if (value === null || value === undefined) return 'N/A';
		return `${value.toFixed(decimals)} ${unit}`;
	}
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<Card.Title>Science Sensor Data</Card.Title>
			<Button variant="ghost" size="sm" onclick={fetchSensorData} disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else}
					<RefreshCw class="w-4 h-4" />
				{/if}
			</Button>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4 pt-4">
		{#if errorMessage}
			<div class="error-message">
				{errorMessage}
			</div>
		{:else if !sensorData}
			<div class="empty-state">
				<TestTube class="w-8 h-8 text-slate-600" />
				<span class="text-sm text-slate-400">No sensor data available</span>
				<Button variant="outline" size="sm" onclick={fetchSensorData}>
					Fetch Data
				</Button>
			</div>
		{:else}
			<!-- Environmental Sensors -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Thermometer class="w-4 h-4" />
					Environmental
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">Temperature</span>
						<span class="sensor-value">{formatValue(temperature, '°C')}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Humidity</span>
						<span class="sensor-value">{formatValue(humidity, '%')}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Pressure</span>
						<span class="sensor-value">{formatValue(pressure, 'hPa', 0)}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Altitude</span>
						<span class="sensor-value">{formatValue(altitude, 'm')}</span>
					</div>
				</div>
			</div>

			<!-- Gas Sensors -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Wind class="w-4 h-4" />
					Gas Analysis
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">CO₂</span>
						<span class="sensor-value">{formatValue(co2, 'ppm', 0)}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">pH</span>
						<span class="sensor-value">{formatValue(ph, '', 2)}</span>
					</div>
				</div>
			</div>

			<!-- Soil Sensors -->
			<div class="sensor-section">
				<h3 class="section-title">
					<Beaker class="w-4 h-4" />
					Soil Composition (NPK)
				</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">Nitrogen (N)</span>
						<span class="sensor-value">{formatValue(nitrogen, 'mg/kg', 0)}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Phosphorus (P)</span>
						<span class="sensor-value">{formatValue(phosphorus, 'mg/kg', 0)}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">Potassium (K)</span>
						<span class="sensor-value">{formatValue(potassium, 'mg/kg', 0)}</span>
					</div>
				</div>
			</div>

			<!-- Color Detection -->
			<div class="sensor-section">
				<h3 class="section-title">Color Detection</h3>
				<div class="color-status">
					<Badge variant="secondary">{colorDetection}</Badge>
				</div>
			</div>

			<!-- Other Sensors -->
			<div class="sensor-section">
				<h3 class="section-title">Other</h3>
				<div class="sensor-grid">
					<div class="sensor-item">
						<span class="sensor-label">Drill Depth</span>
						<span class="sensor-value">{formatValue(distance, 'mm', 0)}</span>
					</div>
					<div class="sensor-item">
						<span class="sensor-label">GPS</span>
						<span class="sensor-value text-xs">{gps}</span>
					</div>
				</div>
			</div>

			<!-- Last Updated -->
			{#if lastUpdated}
				<div class="timestamp">
					Last updated: {lastUpdated.toLocaleTimeString()}
				</div>
			{/if}
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

	.error-message {
		padding: 0.75rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 0.375rem;
		color: #ef4444;
		text-align: center;
		font-size: 0.875rem;
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

	.color-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.timestamp {
		padding: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--slate-500);
		font-style: italic;
	}
</style>
