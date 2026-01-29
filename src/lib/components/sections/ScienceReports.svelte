<script lang="ts">
	import { FileText, Download, Loader2, Trash2, AlertCircle, PlayCircle, StopCircle, Camera } from 'lucide-svelte';
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
	import { assignExpedition, checkExpeditionStatus } from '$lib/services/roverApi';
	import {
		expeditionStore,
		currentExpeditionId,
		isExpeditionActive,
		expeditionImages,
		expeditionImageCount,
		expeditionStartTime,
		generateImageCaptions
	} from '$lib/stores/expeditionStore';

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

	// Expedition state (derived from store)
	let expeditionId = $derived($currentExpeditionId);
	let isActive = $derived($isExpeditionActive);
	let images = $derived($expeditionImages);
	let imageCount = $derived($expeditionImageCount);
	let startTime = $derived($expeditionStartTime);
	let isStartingExpedition = $state(false);

	async function handleStartExpedition() {
		isStartingExpedition = true;
		setStatus('Starting new expedition...', 'info');

		try {
			const result = await assignExpedition();

			if (result.success && result.expedition_id) {
				expeditionStore.startExpedition(result.expedition_id);
				setStatus(`Expedition started: ${result.expedition_id.slice(0, 8)}...`, 'success');
			} else {
				setStatus(`Failed to start expedition: ${result.message || 'Unknown error'}`, 'error');
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Failed to start expedition';
			setStatus(`Error: ${errorMsg}`, 'error');
		} finally {
			isStartingExpedition = false;
		}
	}

	function handleEndExpedition() {
		expeditionStore.endExpedition();
		setStatus('Expedition ended', 'success');
	}

 $effect(() => { if (statusMessage) console.log(statusMessage) })

	function getElapsedTime() {
		if (!startTime) return '00:00:00';

		const now = new Date();
		const elapsed = now.getTime() - startTime.getTime();
		const hours = Math.floor(elapsed / 3600000);
		const minutes = Math.floor((elapsed % 3600000) / 60000);
		const seconds = Math.floor((elapsed % 60000) / 1000);

		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	// Update elapsed time every second
	let elapsedTime = $state('00:00:00');
	$effect(() => {
		if (isActive && startTime) {
			const interval = setInterval(() => {
				elapsedTime = getElapsedTime();
			}, 1000);

			return () => clearInterval(interval);
		} else {
			elapsedTime = '00:00:00';
		}
	});

	async function handleGenerateReport() {
		if (!inference.trim()) {
			setStatus('Please enter inference data', 'error');
			return;
		}

		if (!isActive || !expeditionId) {
			setStatus('No active expedition. Please start an expedition first.', 'error');
			return;
		}

		isGenerating = true;
		setStatus('Generating report...', 'info');

		try {
			// Generate image captions for all captured images
			const imageCaptions = generateImageCaptions(images);

			const result = await generateReport(inference, expeditionId, imageCaptions, false);

			if (result.success) {
				lastGeneratedReport = result;
				setStatus(
					`Report generated successfully with ${imageCount} image${imageCount !== 1 ? 's' : ''}!`,
					'success'
				);
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

	async function handleForceGenerateReport() {
		if (!inference.trim()) {
			setStatus('Please enter inference data', 'error');
			return;
		}

		if (!isActive || !expeditionId) {
			setStatus('No active expedition. Please start an expedition first.', 'error');
			return;
		}

		isGenerating = true;
		setStatus('Force generating report (ignoring cache)...', 'info');

		try {
			// Generate image captions for all captured images
			const imageCaptions = generateImageCaptions(images);

			const result = await generateReport(inference, expeditionId, imageCaptions, true);

			if (result.success) {
				lastGeneratedReport = result;
				setStatus(
					`Report force-generated successfully with ${imageCount} image${imageCount !== 1 ? 's' : ''}!`,
					'success'
				);
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

	function formatImageTimestamp(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	$effect(() => {
		loadAvailableReports();
	});
</script>

<div class="science-reports space-y-4">
	<!-- Expedition Control Section -->
	<Card.Root class="bg-card border-border">
		<Card.Header class="border-b border-border">
			<Card.Title>Expedition Control</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4 pt-4">
			{#if isActive}
				<div class="expedition-active">
					<div class="expedition-header">
						<div class="expedition-status">
							<Badge variant="default" class="bg-green-500 hover:bg-green-600">Active</Badge>
							<span class="expedition-label">Expedition ID:</span>
							<span class="expedition-id">{expeditionId?.slice(0, 16)}...</span>
						</div>
					</div>
					<div class="expedition-info">
						<div class="info-item">
							<span class="info-label">Duration:</span>
							<span class="info-value">{elapsedTime}</span>
						</div>
						<div class="info-item">
							<span class="info-label">Images Captured:</span>
							<span class="info-value">{imageCount}</span>
						</div>
					</div>
					<Button variant="destructive" class="w-full" onclick={handleEndExpedition}>
						<StopCircle class="w-4 h-4 mr-2" />
						End Expedition
					</Button>
				</div>
			{:else}
				<div class="expedition-inactive">
					<p class="text-sm text-slate-400 mb-4">
						No active expedition. Start a new expedition to begin capturing images for a report.
					</p>
					<Button
						variant="default"
						class="w-full"
						onclick={handleStartExpedition}
						disabled={isStartingExpedition}
					>
						{#if isStartingExpedition}
							<Loader2 class="w-4 h-4 mr-2 animate-spin" />
							Starting...
						{:else}
							<PlayCircle class="w-4 h-4 mr-2" />
							Start New Expedition
						{/if}
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Image Gallery Section -->
	{#if isActive && imageCount > 0}
		<Card.Root class="bg-card border-border">
			<Card.Header class="border-b border-border">
				<Card.Title>Captured Images ({imageCount})</Card.Title>
			</Card.Header>
			<Card.Content class="pt-4">
				<div class="image-gallery">
					{#each images as image}
						<div class="image-card">
							<div class="image-placeholder">
								<Camera class="w-8 h-8 text-slate-600" />
							</div>
							<div class="image-overlay">
								<span class="camera-badge">{image.camera_name}</span>
								<span class="time-badge">{formatImageTimestamp(image.timestamp)}</span>
							</div>
							<div class="image-footer">
								<span class="image-filename">{image.filename.slice(0, 20)}...</span>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Report Generator Section -->
	<Card.Root class="bg-card border-border">
		<Card.Header class="border-b border-border">
			<Card.Title>Science Report Generator</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4 pt-4">
			{#if !isActive}
				<div class="warning-message">
					<AlertCircle class="w-4 h-4" />
					<span>Please start an expedition to generate reports with captured images.</span>
				</div>
			{/if}

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

			<div class="space-y-2">
				<Button
					variant="default"
					class="w-full"
					onclick={handleGenerateReport}
					disabled={isGenerating || !inference.trim() || !isActive}
				>
					{#if isGenerating}
						<Loader2 class="w-4 h-4 mr-2 animate-spin" />
						Generating...
					{:else}
						<FileText class="w-4 h-4 mr-2" />
						Generate Report{imageCount > 0 ? ` (${imageCount} image${imageCount !== 1 ? 's' : ''})` : ''}
					{/if}
				</Button>

				<Button
					variant="outline"
					class="w-full"
					onclick={handleForceGenerateReport}
					disabled={isGenerating || !inference.trim() || !isActive}
				>
					{#if isGenerating}
						<Loader2 class="w-4 h-4 mr-2 animate-spin" />
						Generating...
					{:else}
						<AlertCircle class="w-4 h-4 mr-2" />
						Force Generate (Ignore Cache)
					{/if}
				</Button>

				<p class="text-xs text-slate-500 text-center">
					Use "Force Generate" to regenerate report even if cache exists
				</p>
			</div>

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

	.warning-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 0.375rem;
		color: var(--amber-400);
		font-size: 0.875rem;
	}

	.expedition-active,
	.expedition-inactive {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.expedition-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.expedition-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.expedition-label {
		font-size: 0.875rem;
		color: var(--slate-400);
		font-weight: 600;
	}

	.expedition-id {
		font-size: 0.875rem;
		font-family: monospace;
		color: var(--slate-300);
	}

	.expedition-info {
		display: flex;
		gap: 2rem;
		padding: 0.75rem;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-label {
		font-size: 0.75rem;
		color: var(--slate-500);
		font-weight: 600;
	}

	.info-value {
		font-size: 1rem;
		color: var(--slate-300);
		font-family: monospace;
	}

	.image-gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
		max-height: 300px;
		overflow-y: auto;
	}

	.image-card {
		position: relative;
		background: var(--slate-800);
		border: 1px solid var(--slate-700);
		border-radius: 0.375rem;
		overflow: hidden;
		transition: all 0.15s;
	}

	.image-card:hover {
		border-color: var(--sky-blue);
		transform: translateY(-2px);
	}

	.image-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 120px;
		background: var(--slate-900);
	}

	.image-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
	}

	.camera-badge,
	.time-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: rgba(30, 41, 59, 0.9);
		border-radius: 0.25rem;
		color: var(--slate-300);
		font-weight: 600;
	}

	.image-footer {
		padding: 0.5rem;
		background: var(--slate-800);
		border-top: 1px solid var(--slate-700);
	}

	.image-filename {
		font-size: 0.75rem;
		color: var(--slate-400);
		font-family: monospace;
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
