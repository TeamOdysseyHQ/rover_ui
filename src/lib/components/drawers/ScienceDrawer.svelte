<script lang="ts">
	import * as Drawer from '$lib/components/ui/drawer';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import MicroscopePanel from '$lib/components/panels/MicroscopePanel.svelte';
	import ScienceControlPanel from '$lib/components/panels/ScienceControlPanel.svelte';
	import ScienceSensorDisplay from '$lib/components/panels/ScienceSensorDisplay.svelte';
	import { FileText, Download, Loader2 } from 'lucide-svelte';
	import {
		generateReport,
		downloadReportById,
		downloadReportByPath,
		listReportIds,
		triggerDownload,
		type ReportResponse
	} from '$lib/services/scienceReportService';
	
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
	
	// Report state (moved from ScienceReports.svelte)
	let inference = $state('');
	let isGenerating = $state(false);
	let isLoadingReports = $state(false);
	let lastGeneratedReport = $state<ReportResponse | null>(null);
	let statusMessage = $state('');
	let statusType = $state<'success' | 'error' | 'info'>('info');
	let availableReports = $state<string[]>([]);
	let showDownloadOptions = $state(false);
	
	async function handleGenerateReport() {
		if (!inference.trim()) {
			setStatus('Please enter inference data', 'error');
			return;
		}

		isGenerating = true;
		setStatus('Generating report...', 'info');

		try {
			const result = await generateReport(inference);

			if (result.success) {
				lastGeneratedReport = result;
				setStatus('Report generated successfully!', 'success');
				inference = '';
				loadAvailableReports();
			} else {
				setStatus(`Failed: ${result.message}`, 'error');
				lastGeneratedReport = null;
			}
		} catch (error) {
			setStatus('An unexpected error occurred', 'error');
			lastGeneratedReport = null;
		} finally {
			isGenerating = false;
		}
	}

	async function handleDownloadById(reportId: string) {
		setStatus(`Downloading report ${reportId}...`, 'info');

		const blob = await downloadReportById(reportId);

		if (blob) {
			triggerDownload(blob, `${reportId}.pdf`);
			setStatus('Download complete!', 'success');
		} else {
			setStatus('Failed to download report', 'error');
		}
	}

	async function handleDownloadByPath(reportPath: string) {
		setStatus('Downloading report by path...', 'info');

		const blob = await downloadReportByPath(reportPath);

		if (blob) {
			const filename = reportPath.split('/').pop() || 'report.pdf';
			triggerDownload(blob, filename);
			setStatus('Download complete!', 'success');
		} else {
			setStatus('Failed to download report', 'error');
		}
	}

	async function handleDownloadLastReport(method: 'id' | 'path') {
		if (!lastGeneratedReport) return;

		if (method === 'id' && lastGeneratedReport.report_id) {
			await handleDownloadById(lastGeneratedReport.report_id);
		} else if (method === 'path' && lastGeneratedReport.report_path) {
			await handleDownloadByPath(lastGeneratedReport.report_path);
		}

		showDownloadOptions = false;
	}

	async function loadAvailableReports() {
		isLoadingReports = true;
		const reports = await listReportIds();
		availableReports = reports;
		isLoadingReports = false;
	}

	function setStatus(message: string, type: 'success' | 'error' | 'info') {
		statusMessage = message;
		statusType = type;

		setTimeout(() => {
			statusMessage = '';
		}, 5000);
	}

	function getStatusColor() {
		switch (statusType) {
			case 'success':
				return 'text-green-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-sky-400';
		}
	}

	$effect(() => {
		if (show) {
			loadAvailableReports();
		}
	});
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
			
			<!-- Section 4: Report Generator -->
			<Card.Root class="bg-card border-border">
				<Card.Header class="border-b border-border">
					<Card.Title>Inference Input</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4 pt-4">
					<div class="space-y-2">
						<label for="inference" class="text-sm font-medium text-slate-300">
							Inference Data
						</label>
						<textarea
							id="inference"
							bind:value={inference}
							placeholder="Enter inference data for the report..."
							class="inference-input"
							rows="4"
							disabled={isGenerating}
						/>
					</div>

					<Button
						variant="default"
						class="w-full"
						onclick={handleGenerateReport}
						disabled={isGenerating || !inference.trim()}
					>
						{#if isGenerating}
							<Loader2 class="w-4 h-4 mr-2 animate-spin" />
							Generating...
						{:else}
							<FileText class="w-4 h-4 mr-2" />
							Generate Report
						{/if}
					</Button>

					{#if statusMessage}
						<div class="status-message {getStatusColor()}">
							{statusMessage}
						</div>
					{/if}

					{#if lastGeneratedReport && lastGeneratedReport.success}
						<div class="report-info">
							<div class="report-info-header">
								<span class="text-sm font-semibold">Last Generated Report</span>
								<Badge variant="success">Ready</Badge>
							</div>
							<div class="report-details">
								{#if lastGeneratedReport.report_id}
									<div class="detail-item">
										<span class="detail-label">ID:</span>
										<span class="detail-value">{lastGeneratedReport.report_id}</span>
									</div>
								{/if}
								{#if lastGeneratedReport.report_path}
									<div class="detail-item">
										<span class="detail-label">Path:</span>
										<span class="detail-value truncate">{lastGeneratedReport.report_path}</span>
									</div>
								{/if}
							</div>

							{#if !showDownloadOptions}
								<Button
									variant="secondary"
									class="w-full mt-3"
									onclick={() => (showDownloadOptions = true)}
								>
									<Download class="w-4 h-4 mr-2" />
									Download Report
								</Button>
							{:else}
								<div class="download-options">
									<div class="text-xs text-slate-400 mb-2">Choose download method:</div>
									<div class="download-buttons">
										{#if lastGeneratedReport.report_id}
											<Button
												variant="default"
												size="sm"
												onclick={() => handleDownloadLastReport('id')}
											>
												By ID
											</Button>
										{/if}
										{#if lastGeneratedReport.report_path}
											<Button
												variant="default"
												size="sm"
												onclick={() => handleDownloadLastReport('path')}
											>
												By Path
											</Button>
										{/if}
										<Button
											variant="outline"
											size="sm"
											onclick={() => (showDownloadOptions = false)}
										>
											Cancel
										</Button>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
			
			<!-- Section 3: Available Reports -->
			<Card.Root class="bg-card border-border">
				<Card.Header class="border-b border-border">
					<div class="flex items-center justify-between">
						<Card.Title>Available Reports</Card.Title>
						<Button variant="ghost" size="sm" onclick={loadAvailableReports} disabled={isLoadingReports}>
							{#if isLoadingReports}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								Refresh
							{/if}
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="pt-4">
					{#if isLoadingReports}
						<div class="loading-state">
							<Loader2 class="w-5 h-5 animate-spin text-sky-400" />
							<span class="text-sm text-slate-400">Loading reports...</span>
						</div>
					{:else if availableReports.length === 0}
						<div class="empty-state">
							<FileText class="w-8 h-8 text-slate-600 mb-2" />
							<span class="text-sm text-slate-400">No reports available</span>
						</div>
					{:else}
						<div class="reports-list">
							{#each availableReports as reportId}
								<div class="report-item">
									<div class="report-item-info">
										<FileText class="w-4 h-4 text-sky-400" />
										<span class="report-id">{reportId}</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleDownloadById(reportId)}
									>
										<Download class="w-4 h-4" />
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</Drawer.Content>
</Drawer.Root>

<style>
	.inference-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		color: white;
		font-size: 0.875rem;
		font-family: 'Courier New', monospace;
		resize: vertical;
		transition: border-color 0.15s;
	}

	.inference-input:focus {
		outline: none;
		border-color: var(--sky-blue);
	}

	.inference-input::placeholder {
		color: var(--slate-500);
	}

	.inference-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-message {
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		text-align: center;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.report-info {
		padding: 1rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.5rem;
	}

	.report-info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		color: var(--slate-200);
	}

	.report-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-item {
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.detail-label {
		color: var(--slate-400);
		font-weight: 600;
		min-width: 40px;
	}

	.detail-value {
		color: var(--slate-300);
		font-family: monospace;
		flex: 1;
	}

	.download-options {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--slate-700);
	}

	.download-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.reports-list {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.report-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		transition: all 0.15s;
	}

	.report-item:hover {
		background: var(--slate-700);
		border-color: var(--sky-blue);
	}

	.report-item-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.report-id {
		font-size: 0.875rem;
		font-family: monospace;
		color: var(--slate-300);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		gap: 0.5rem;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
