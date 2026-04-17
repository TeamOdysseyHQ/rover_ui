# Science Reports Component

## Overview

The `ScienceReports.svelte` component provides an interface for generating and downloading science reports with inference data.

## Location

- **Component**: `dashboard/src/lib/components/sections/ScienceReports.svelte`
- **Service**: `dashboard/src/lib/services/scienceReportService.ts`

## Features

1. **Generate Reports**: Input inference data and generate a new PDF report
2. **Download Options**: Choose to download by ID or by path
3. **Report History**: View and download all available reports
4. **Status Feedback**: Real-time feedback on operations

## API Integration

The component integrates with the following backend endpoints:

- `POST /api/sci/reports` - Generate a new report with inference data
- `GET /api/sci/report/{id}` - Download report by ID
- `GET /api/sci/report/path/{path}` - Download report by path
- `POST /api/sci/get_report` - Download report with both ID and path
- `GET /api/sci/reports/ids` - List all available report IDs

## Usage

### Basic Integration

```svelte
<script lang="ts">
	import ScienceReports from '$lib/components/sections/ScienceReports.svelte';
</script>

<ScienceReports />
```

### Component Features

1. **Text Input**: Enter inference data (required)
2. **Generate Button**: Creates a new report
3. **Download Options**: 
   - By ID (faster, recommended)
   - By Path (fallback method)
4. **Reports List**: Shows all available reports with quick download buttons

## Styling

The component follows the dashboard design system:

- **Background**: Pure black `#000000`
- **Cards**: Flat slate `#1e293b`
- **Borders**: `#334155`
- **Primary accent**: Sky blue `#0ea5e9`
- **Status colors**: Green (success), Red (error), Sky blue (info)

## Service Functions

### `generateReport(inference: string)`
Creates a new report with the provided inference data.

```typescript
const result = await generateReport("Sample inference data");
if (result.success) {
	console.log(`Report created: ${result.report_id}`);
}
```

### `downloadReportById(reportId: string)`
Downloads a report by its ID and returns a Blob.

```typescript
const blob = await downloadReportById("report-123");
if (blob) {
	triggerDownload(blob, "report-123.pdf");
}
```

### `listReportIds()`
Retrieves all available report IDs.

```typescript
const reportIds = await listReportIds();
console.log(`Found ${reportIds.length} reports`);
```

## Error Handling

The component handles various error scenarios:

- Empty inference input
- Network failures
- Report generation failures
- Download errors
- Duplicate report requests (rate limiting)

All errors are displayed to the user with appropriate status messages.

## State Management

The component uses Svelte 5 runes:

- `$state()` for reactive state variables
- `$effect()` for side effects (loading reports on mount)

## Testing

To test the component:

1. Start the backend server: `cd endpoint && uv run main.py`
2. Start the dashboard: `cd dashboard && bun run dev`
3. Navigate to the main page
4. Enter inference data in the text area
5. Click "Generate Report"
6. Use the download options to download the generated report
