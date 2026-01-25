/**
 * Science Report Service
 * 
 * Handles API calls for generating and downloading science reports with inference data.
 */

const API_BASE = 'http://localhost:6767';

export interface ReportResponse {
	success: boolean;
	status: string;
	message: string;
	report_id?: string;
	report_path?: string;
}

export interface ReportListResponse {
	success: boolean;
	status: string;
	message: string;
	report_ids?: string[];
}

/**
 * Generate a new science report with inference data
 */
export async function generateReport(inference: string): Promise<ReportResponse> {
	try {
		const response = await fetch(`${API_BASE}/api/sci/reports`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ inference })
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: ReportResponse = await response.json();
		return data;
	} catch (error) {
		console.error('[ScienceReport] Generate error:', error);
		return {
			success: false,
			status: 'Error',
			message: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Download a report by ID
 */
export async function downloadReportById(reportId: string): Promise<Blob | null> {
	try {
		const response = await fetch(`${API_BASE}/api/sci/report/${reportId}`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const blob = await response.blob();
		return blob;
	} catch (error) {
		console.error('[ScienceReport] Download by ID error:', error);
		return null;
	}
}

/**
 * Download a report by path
 */
export async function downloadReportByPath(reportPath: string): Promise<Blob | null> {
	try {
		const response = await fetch(`${API_BASE}/api/sci/report/path/${encodeURIComponent(reportPath)}`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const blob = await response.blob();
		return blob;
	} catch (error) {
		console.error('[ScienceReport] Download by path error:', error);
		return null;
	}
}

/**
 * Download a report using POST method with both ID and path
 */
export async function downloadReport(reportId?: string, reportPath?: string): Promise<Blob | null> {
	try {
		const response = await fetch(`${API_BASE}/api/sci/get_report`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				report_id: reportId,
				report_path: reportPath
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const blob = await response.blob();
		return blob;
	} catch (error) {
		console.error('[ScienceReport] Download error:', error);
		return null;
	}
}

/**
 * List all available report IDs
 */
export async function listReportIds(): Promise<string[]> {
	try {
		const response = await fetch(`${API_BASE}/api/sci/reports/ids`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: ReportListResponse = await response.json();
		return data.success && data.report_ids ? data.report_ids : [];
	} catch (error) {
		console.error('[ScienceReport] List IDs error:', error);
		return [];
	}
}

/**
 * Helper function to trigger browser download of a blob
 */
export function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
