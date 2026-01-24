<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	
	// Mission-specific state
	let sites = $state<any[]>([]);
	let sampleDepth = $state('0');
	let sampleMass = $state('0');
	let temperature = $state('--');
	let humidity = $state('--');
	let pH = $state('--');
	let pressure = $state('--');
</script>

<div class="abex-mission space-y-6">
	<!-- Site Investigation -->
	<Card>
		<CardHeader>
			<CardTitle>Site Investigation</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Sites Documented:</span>
					<Badge>{sites.length}</Badge>
				</div>
				<button class="btn btn-primary w-full">
					Capture Panorama
				</button>
				<button class="btn btn-secondary w-full">
					Log GPS Coordinates
				</button>
			</div>
		</CardContent>
	</Card>
	
	<!-- Sample Collection -->
	<Card>
		<CardHeader>
			<CardTitle>Sample Collection</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-4">
				<div class="stat-row">
					<div class="stat-label">Depth (cm)</div>
					<div class="stat-value" class:warning={parseFloat(sampleDepth) < 10}>
						{sampleDepth}
						{#if parseFloat(sampleDepth) < 10}
							<span class="text-xs text-yellow-500 ml-2">Min: 10cm</span>
						{/if}
					</div>
				</div>
				
				<div class="stat-row">
					<div class="stat-label">Mass (g)</div>
					<div class="stat-value" class:warning={parseFloat(sampleMass) < 10}>
						{sampleMass}
						{#if parseFloat(sampleMass) < 10}
							<span class="text-xs text-yellow-500 ml-2">Min: 10g</span>
						{/if}
					</div>
				</div>
				
				<button class="btn btn-primary w-full">
					Store Sample in Cache
				</button>
			</div>
		</CardContent>
	</Card>
	
	<!-- Onboard Analysis -->
	<Card>
		<CardHeader>
			<CardTitle>Onboard Analysis</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="analysis-grid">
				<div class="analysis-item">
					<div class="analysis-label">Temperature</div>
					<div class="analysis-value">{temperature}°C</div>
				</div>
				
				<div class="analysis-item">
					<div class="analysis-label">Humidity</div>
					<div class="analysis-value">{humidity}%</div>
				</div>
				
				<div class="analysis-item">
					<div class="analysis-label">pH Level</div>
					<div class="analysis-value">{pH}</div>
				</div>
				
				<div class="analysis-item">
					<div class="analysis-label">Pressure</div>
					<div class="analysis-value">{pressure} hPa</div>
				</div>
			</div>
			
			<button class="btn btn-secondary w-full mt-4">
				Run Analysis
			</button>
		</CardContent>
	</Card>
</div>

<style>
	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.375rem;
	}
	
	.stat-label {
		font-size: 0.875rem;
		color: var(--slate-400);
		font-weight: 500;
	}
	
	.stat-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
	}
	
	.stat-value.warning {
		color: var(--yellow-500);
	}
	
	.analysis-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
	
	.analysis-item {
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		text-align: center;
	}
	
	.analysis-label {
		font-size: 0.75rem;
		color: var(--slate-400);
		margin-bottom: 0.5rem;
	}
	
	.analysis-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--sky-light);
		font-family: 'Courier New', monospace;
	}
</style>
