/**
 * Navigation Report Service
 * 
 * Handles API calls for generating and downloading navigation reconnaissance reports.
 */

const API_BASE = 'http://10.103.111.189:6767';

export interface NavReportResponse {
	success: boolean;
	status: string;
	message: string;
	report_id?: string;
	report_path?: string;
}

export interface NavReportListResponse {
	success: boolean;
	status: string;
	message: string;
	report_ids?: string[];
}

export interface NavReportMetadata {
	report_id: string;
	filename: string;
	size_bytes: number;
	size_kb: number;
	size_mb: number;
	created_at: string;
	modified_at: string;
}

export interface NavReportMetadataResponse {
	success: boolean;
	status: string;
	message: string;
	reports?: NavReportMetadata[];
	count?: number;
}

/**
 * Generate a new navigation reconnaissance report
 */
export async function generateNavReport(
	missionNotes: string,
	expeditionId?: string,
	objectNotes?: Record<string, string>,
	forceGenerate?: boolean
): Promise<NavReportResponse> {
	try {
		const body: any = { mission_notes: missionNotes };
		
		// Add optional expedition_id if provided
		if (expeditionId) {
			body.expedition_id = expeditionId;
		}
		
		// Add optional object_notes if provided
		if (objectNotes && Object.keys(objectNotes).length > 0) {
			body.object_notes = objectNotes;
		}
		
		// Add optional force_generate flag if provided
		if (forceGenerate !== undefined) {
			body.force_generate = forceGenerate;
		}
		
		const response = await fetch(`${API_BASE}/api/nav/nav_reports`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: NavReportResponse = await response.json();
		return data;
	} catch (error) {
		console.error('[NavigationReport] Generate error:', error);
		return {
			success: false,
			status: 'Error',
			message: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Download a navigation report by ID
 */
export async function downloadNavReportById(reportId: string): Promise<Blob | null> {
	try {
		const response = await fetch(`${API_BASE}/api/nav/nav_report/${reportId}`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const blob = await response.blob();
		return blob;
	} catch (error) {
		console.error('[NavigationReport] Download by ID error:', error);
		return null;
	}
}

/**
 * List all available navigation report IDs
 */
export async function listNavReportIds(): Promise<string[]> {
	try {
		const response = await fetch(`${API_BASE}/api/nav/nav_reports/ids`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: NavReportListResponse = await response.json();
		return data.success && data.report_ids ? data.report_ids : [];
	} catch (error) {
		console.error('[NavigationReport] List IDs error:', error);
		return [];
	}
}

/**
 * Helper function to trigger browser download of a blob
 */
export function triggerNavDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Get detailed metadata for all navigation reports
 */
export async function getNavReportsMetadata(): Promise<NavReportMetadata[]> {
	try {
		const response = await fetch(`${API_BASE}/api/nav/nav_reports/metadata`, {
			method: 'GET'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data: NavReportMetadataResponse = await response.json();
		return data.success && data.reports ? data.reports : [];
	} catch (error) {
		console.error('[NavigationReport] Get metadata error:', error);
		return [];
	}
}

/**
 * Delete a navigation report by ID
 */
export async function deleteNavReport(reportId: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}/api/nav/nav_report/${reportId}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return data.success;
	} catch (error) {
		console.error('[NavigationReport] Delete error:', error);
		return false;
	}
}
