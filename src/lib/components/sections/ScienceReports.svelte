<script lang="ts">
	import { FileText, Download, Loader2, Trash2, AlertCircle } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		generateReport,
		downloadReportById,
		downloadReportByPath,
		listReportIds,
		triggerDownload,
		getReportsMetadata,
		deleteReport,
		type ReportResponse,
		type ReportMetadata
	} from '$lib/services/scienceReportService';

	let inference = $state('');
	let isGenerating = $state(false);
	let isLoadingReports = $state(false);
	let lastGeneratedReport = $state<ReportResponse | null>(null);
	let statusMessage = $state('');
	let statusType = $state<'success' | 'error' | 'info'>('info');
	let availableReports = $state<ReportMetadata[]>([]);
	let showDownloadOptions = $state(false);
	let downloadingReports = $state<Set<string>>(new Set());
	let deletingReports = $state<Set<string>>(new Set());
	let confirmDelete = $state<string | null>(null);

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
				await loadAvailableReports();
			} else {
				setStatus(`Failed: ${result.message}`, 'error');
				lastGeneratedReport = null;
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
			setStatus(`Error: ${errorMsg}`, 'error');
			lastGeneratedReport = null;
		} finally {
			isGenerating = false;
		}
	}

	async function handleDownloadById(reportId: string) {
		downloadingReports.add(reportId);
		downloadingReports = downloadingReports;
		setStatus(`Downloading report ${reportId}...`, 'info');

		try {
			const blob = await downloadReportById(reportId);

			if (blob) {
				triggerDownload(blob, `${reportId}.pdf`);
				setStatus('Download complete!', 'success');
			} else {
				setStatus('Failed to download report', 'error');
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Download failed';
			setStatus(`Error: ${errorMsg}`, 'error');
		} finally {
			downloadingReports.delete(reportId);
			downloadingReports = downloadingReports;
		}
	}

	async function handleDownloadByPath(reportPath: string) {
		setStatus('Downloading report by path...', 'info');

		try {
			const blob = await downloadReportByPath(reportPath);

			if (blob) {
				const filename = reportPath.split('/').pop() || 'report.pdf';
				triggerDownload(blob, filename);
				setStatus('Download complete!', 'success');
			} else {
				setStatus('Failed to download report', 'error');
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Download failed';
			setStatus(`Error: ${errorMsg}`, 'error');
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

	async function handleDeleteReport(reportId: string) {
		if (confirmDelete !== reportId) {
			confirmDelete = reportId;
			setStatus('Click delete again to confirm', 'info');
			setTimeout(() => {
				if (confirmDelete === reportId) {
					confirmDelete = null;
				}
			}, 3000);
			return;
		}

		deletingReports.add(reportId);
		deletingReports = deletingReports;
		confirmDelete = null;
		setStatus(`Deleting report ${reportId}...`, 'info');

		try {
			const success = await deleteReport(reportId);

			if (success) {
				setStatus('Report deleted successfully!', 'success');
				await loadAvailableReports();
			} else {
				setStatus('Failed to delete report', 'error');
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Delete failed';
			setStatus(`Error: ${errorMsg}`, 'error');
		} finally {
			deletingReports.delete(reportId);
			deletingReports = deletingReports;
		}
	}

	async function loadAvailableReports() {
		isLoadingReports = true;
		try {
			const reports = await getReportsMetadata();
			availableReports = reports;
		} catch (error) {
			console.error('Failed to load reports:', error);
			setStatus('Failed to load reports', 'error');
		} finally {
			isLoadingReports = false;
		}
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

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	$effect(() => {
		loadAvailableReports();
	});
</script>

<div class="science-reports space-y-4">
	<Card.Root class="bg-card border-border">
		<Card.Header class="border-b border-border">
			<Card.Title>Science Report Generator</Card.Title>
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
					{#each availableReports as report}
						<div class="report-item">
							<div class="report-item-content">
								<div class="report-item-header">
									<FileText class="w-4 h-4 text-sky-400" />
									<span class="report-id">{report.report_id.slice(0, 16)}...</span>
								</div>
								<div class="report-metadata">
									<span class="metadata-item">
										<span class="metadata-label">Size:</span>
										<span class="metadata-value">{formatFileSize(report.size_bytes)}</span>
									</span>
									<span class="metadata-item">
										<span class="metadata-label">Created:</span>
										<span class="metadata-value">{formatDate(report.created_at)}</span>
									</span>
								</div>
							</div>
							<div class="report-actions">
								<Button
									variant="ghost"
									size="sm"
									onclick={() => handleDownloadById(report.report_id)}
									disabled={downloadingReports.has(report.report_id)}
								>
									{#if downloadingReports.has(report.report_id)}
										<Loader2 class="w-4 h-4 animate-spin" />
									{:else}
										<Download class="w-4 h-4" />
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => handleDeleteReport(report.report_id)}
									disabled={deletingReports.has(report.report_id)}
									class={confirmDelete === report.report_id ? 'text-red-400' : ''}
								>
									{#if deletingReports.has(report.report_id)}
										<Loader2 class="w-4 h-4 animate-spin" />
									{:else if confirmDelete === report.report_id}
										<AlertCircle class="w-4 h-4" />
									{:else}
										<Trash2 class="w-4 h-4" />
									{/if}
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

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

	.report-item-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.report-item-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.report-id {
		font-size: 0.875rem;
		font-family: monospace;
		color: var(--slate-300);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.report-metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.75rem;
	}

	.metadata-item {
		display: flex;
		gap: 0.25rem;
	}

	.metadata-label {
		color: var(--slate-500);
		font-weight: 600;
	}

	.metadata-value {
		color: var(--slate-400);
	}

	.report-actions {
		display: flex;
		gap: 0.25rem;
	}

	.report-item-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
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
