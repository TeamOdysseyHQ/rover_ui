<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { motorRpmSample } from '$lib/stores/motorRpmStore.js';
	import { Activity, RefreshCw, Gauge, Play, Square } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	// ── constants ────────────────────────────────────────────────────────────
	const POLL_INTERVAL_MS = 200; // 5 Hz
	const MAX_POINTS = 60; // Up to 12 seconds of successful API readings at 5 Hz

	const WHEEL_KEYS = ['front_left', 'front_right', 'mid_left', 'mid_right', 'rear_left', 'rear_right'] as const;
	const WHEEL_LABELS = ['FL', 'FR', 'ML', 'MR', 'RL', 'RR'];
	const WHEEL_COLORS = [
		'#38bdf8', // sky-400  – FL
		'#34d399', // emerald-400 – FR
		'#fb923c', // orange-400  – ML
		'#a78bfa', // violet-400  – MR
		'#f472b6', // pink-400    – RL
		'#facc15'  // yellow-400  – RR
	];

	// ── state ────────────────────────────────────────────────────────────────
	let isRunning = $state(false);
	let lastError = $state<string | null>(null);
	let lastUpdateTime = $state<Date | null>(null);

	// current RPM values per wheel
	let current = $state<Record<string, number | null>>({
		front_left: null, front_right: null,
		mid_left: null,   mid_right: null,
		rear_left: null,  rear_right: null
	});

	// rolling history arrays (one per wheel)
	let history = $state<(number | null)[][]>(WHEEL_KEYS.map(() => []));
	let timeLabels = $state<string[]>([]);

	let pollTimer: (() => void) | null = null;
	let mounted = false;

	// ── chart data (derived) ─────────────────────────────────────────────────
	let chartData = $derived({
		labels: timeLabels,
		datasets: WHEEL_KEYS.map((key, i) => ({
			label: WHEEL_LABELS[i],
			data: history[i],
			borderColor: WHEEL_COLORS[i],
			backgroundColor: WHEEL_COLORS[i] + '22',
			borderWidth: 2,
			pointRadius: 0,
			pointHoverRadius: 4,
			tension: 0.3,
			fill: false
		}))
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		animation: { duration: 0 },
		interaction: { mode: 'index' as const, intersect: false },
		plugins: {
			legend: {
				labels: { color: '#94a3b8', boxWidth: 12, padding: 16, font: { size: 11 } }
			},
			tooltip: {
				backgroundColor: '#1e293b',
				titleColor: '#e2e8f0',
				bodyColor: '#94a3b8',
				borderColor: '#334155',
				borderWidth: 1,
				callbacks: {
					label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)} RPM`
				}
			}
		},
		scales: {
			x: {
				ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 10 } },
				grid: { color: '#1e293b' }
			},
			y: {
				ticks: { color: '#64748b', font: { size: 10 } },
				grid: { color: '#1e293b' },
				title: { display: true, text: 'RPM', color: '#64748b', font: { size: 11 } }
			}
		}
	} as const;

	// ── helpers ───────────────────────────────────────────────────────────────
	function nowLabel() {
		return new Date().toLocaleTimeString('en-US', { hour12: false });
	}

	function pushData(data: Record<string, number>) {
		const label = nowLabel();
		const newLabels = [...timeLabels, label].slice(-MAX_POINTS);
		const newHistory = WHEEL_KEYS.map((key, i) => [
			...history[i],
			Number.isFinite(data[key]) ? data[key] : null
		].slice(-MAX_POINTS));

		timeLabels = newLabels;
		history = newHistory;

		WHEEL_KEYS.forEach((key) => {
			current[key] = Number.isFinite(data[key]) ? data[key] : null;
		});
		lastUpdateTime = new Date();
	}

	function start() {
		if (!mounted || isRunning) return;
		isRunning = true;
		pollTimer = motorRpmSample.subscribe(sample => {
			if (!mounted || !isRunning) return;
			lastError = sample.error;
			if (sample.data) pushData(sample.data);
			else WHEEL_KEYS.forEach(key => { current[key] = null; });
		});
	}

	function stop() {
		pollTimer?.();
		pollTimer = null;
		isRunning = false;
	}

	function clearData() {
		history = WHEEL_KEYS.map(() => []);
		timeLabels = [];
		WHEEL_KEYS.forEach((key) => { current[key] = null; });
	}

	// Chart component — loaded only in browser to avoid SSR crash
	let LineChart: any = $state(null);

	// ── lifecycle ─────────────────────────────────────────────────────────────
	onMount(() => {
		mounted = true;
		start();
		void (async () => {
			const { Line } = await import('svelte-chartjs');
			const {
				Chart,
				LineElement,
				PointElement,
				LinearScale,
				CategoryScale,
				Tooltip,
				Legend,
				Filler
			} = await import('chart.js');
			Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);
			if (!mounted) return;
			LineChart = Line;
		})().catch(error => { if (mounted) lastError = error.message; });
		return () => { mounted = false; stop(); };
	});
</script>

<Card.Root class="bg-card border-border">
	<Card.Header class="border-b border-border">
		<div class="flex items-center justify-between">
			<div>
				<Card.Title class="flex items-center gap-2 text-base">
					<Gauge class="w-5 h-5 text-sky-400" />
					Motor RPM Monitor
				</Card.Title>
				<p class="text-xs text-muted-foreground mt-0.5">6-wheel API readings · 5 Hz</p>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant={isRunning ? 'default' : 'secondary'} class="text-xs">
					{isRunning ? 'Polling' : 'Stopped'}
				</Badge>
				<Button
					variant={isRunning ? 'destructive' : 'default'}
					size="sm"
					onclick={isRunning ? stop : start}
				>
					{#if isRunning}
						<Square class="w-3.5 h-3.5 mr-1" />Stop
					{:else}
						<Play class="w-3.5 h-3.5 mr-1" />Start
					{/if}
				</Button>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4 pt-4">
		<!-- Current RPM grid ─────────────────────────────────────────────── -->
		<div class="grid grid-cols-3 gap-2">
			{#each WHEEL_KEYS as key, i}
				<div class="bg-secondary rounded-lg p-2 text-center">
					<div class="text-[10px] text-muted-foreground mb-0.5" style="color:{WHEEL_COLORS[i]}">
						{WHEEL_LABELS[i]}
					</div>
					<div class="text-lg font-bold font-mono" style="color:{WHEEL_COLORS[i]}">
						{current[key] !== null ? current[key]!.toFixed(1) : '—'}
					</div>
					<div class="text-[9px] text-muted-foreground">RPM</div>
				</div>
			{/each}
		</div>

		<!-- Chart ────────────────────────────────────────────────────────── -->
		{#if !browser || timeLabels.length === 0}
			<div class="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
				{#if isRunning}
					<RefreshCw class="w-5 h-5 animate-spin" />
					<span class="text-sm">Waiting for data…</span>
				{:else}
					<Activity class="w-5 h-5" />
					<span class="text-sm">Press Start to begin monitoring</span>
				{/if}
			</div>
		{:else if LineChart}
			<div class="h-52 w-full">
				<LineChart data={chartData} options={chartOptions} />
			</div>
		{/if}

		<!-- Footer bar ───────────────────────────────────────────────────── -->
		<div class="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
			<span>
				{#if lastUpdateTime}
					Updated {lastUpdateTime.toLocaleTimeString('en-US', { hour12: false })}
				{:else}
					No data yet
				{/if}
			</span>
			<div class="flex items-center gap-3">
				{#if lastError}
					<span class="text-red-400 truncate max-w-[180px]" title={lastError}>{lastError}</span>
				{/if}
				<button
					onclick={clearData}
					class="text-muted-foreground hover:text-foreground transition-colors"
					title="Clear chart history"
				>
					Clear
				</button>
			</div>
		</div>
	</Card.Content>
</Card.Root>
