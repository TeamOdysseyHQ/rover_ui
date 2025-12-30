# Rover Control Dashboard - API Reference

## Backend Overview
- **Server:** FastAPI
- **Port:** 6767
- **Base URL:** `http://localhost:6767`

## Frontend Changes
The frontend has been rewritten to use **HTTP REST API** instead of WebSocket:
- New API service layer: `/dashboard/src/lib/services/roverApi.js`
- New store: `/dashboard/src/lib/stores/apiStore.js`
- Updated components: `ConnectionPanel.svelte`, `CommandLog.svelte`

## Implemented API Endpoints

### Navigation (/api/nav/)
✅ **POST /api/nav/capture** - Upload image with metadata  
✅ **POST /api/nav/capture_test_data** - Generate test image  
✅ **POST /api/nav/waypoint** - Add GPS waypoint  
✅ **GET /api/nav/get_waypoints** - Get all waypoints  
✅ **GET /api/nav/get_metadata** - Get image metadata  
✅ **POST /api/nav/generate_report** - Generate HTML report  
✅ **POST /api/nav/generate_comprehensive_report** - Generate PDF report with images  
✅ **POST /api/nav/route_analysis** - Get route statistics  
✅ **POST /api/nav/export_data** - Export data (JSON/CSV)  
✅ **POST /api/nav/reports** - List reports  
✅ **GET /api/nav/download/{filename}** - Download report  

### Diagnostics (/api/dgt/)
✅ **POST /api/dgt/doctor** - Run ROS2 diagnostics  

### Science (/api/sci/)
❌ **POST /api/sci/available** - Only returns available endpoints  
❌ No drill, sample, or analysis endpoints implemented yet

### Arm (/api/arm/)
❌ **POST /api/arm/available** - Only returns available endpoints  
❌ No arm control endpoints implemented yet

### Other (/api/o/)
✅ **POST /api/o/test** - Test API connectivity  

## Quick Start

### Start Backend
```bash
cd endpoint
uvicorn main:app --host 0.0.0.0 --port 6767
```

### Start Frontend
```bash
cd dashboard
npm run dev
```

### Connect in Dashboard
1. Enter API URL: `http://localhost:6767`
2. Click "Connect"
3. Test with "Capture Test Image" button

## Frontend API Usage

```javascript
import * as api from '$lib/services/roverApi';

// Capture test image
const result = await api.captureTestData({
    latitude: 16.5062,
    longitude: 80.6480,
    mission_id: 'mission_001',
    battery_level: 85,
    temperature: 22
});

// Add waypoint
const waypoint = await api.addWaypoint({
    latitude: 16.5062,
    longitude: 80.6480,
    name: 'Checkpoint 1',
    mission_id: 'mission_001'
});

// Generate report
const report = await api.generateComprehensiveReport('mission_001');
```

## UI Features NOT Implemented in Backend

These UI controls log to console only:
- ❌ Joystick movement
- ❌ Steering mode toggle
- ❌ Drill speed control
- ❌ Wheel speed/direction control  
- ❌ Camera feed toggle
- ❌ Collection system controls
- ❌ Test tube rotation
- ❌ Soil analysis
- ❌ Antenna controls

## Data Storage

Backend stores data in:
- `endpoint/storage/images/` - Captured images
- `endpoint/storage/metadata.json` - Image metadata  
- `endpoint/storage/waypoints.json` - Waypoint data
- `endpoint/storage/reports/` - Generated reports

## Key Changes from Previous Version

1. **WebSocket → HTTP REST API**
   - Old: `ws://localhost:8080`
   - New: `http://localhost:6767`

2. **Command dispatching removed**
   - Old: `dispatchCommand('COMMAND', data)`
   - New: `await api.functionName(data)`

3. **Connection testing**
   - Old: WebSocket connection
   - New: HTTP test endpoint

4. **Implemented features:**
   - Image capture with metadata
   - Waypoint management
   - Report generation (HTML + PDF with embedded images)
   - Route analysis
   - Data export
   - ROS2 diagnostics

For detailed endpoint documentation, see the FastAPI auto-generated docs at:
`http://localhost:6767/docs`
