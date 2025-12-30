# Rover Dashboard Frontend Rewrite

## Summary of Changes

I've rewritten the frontend to accurately query the FastAPI backend routes in the `endpoint` folder, replacing the previous WebSocket-based approach.

## Key Changes

### 1. **Backend Discovery**
The actual backend is a **FastAPI REST API** (not WebSocket) located in `/endpoint/`:
- Port: **6767** (not 8080)
- Protocol: **HTTP REST** (not WebSocket)
- Modules: Navigation, Diagnostics, Science, Arm, Other

### 2. **New Files Created**

#### `/dashboard/src/lib/services/roverApi.js`
Complete API service layer with functions for all backend endpoints:
- Navigation: capture, waypoints, reports, route analysis
- Diagnostics: ROS2 doctor
- Science, Arm, Other: available endpoints
- Convenience functions for health checks and endpoint discovery

#### `/dashboard/src/lib/stores/apiStore.js`
New Svelte store replacing the WebSocket command store:
- `apiStatus` - Connection status ('connected', 'disconnected', 'error')
- `roverApiUrl` - Current API base URL
- `commandHistory` - Log of API calls
- `testConnection()` - Test HTTP connectivity
- `logCommand()` - Log API activity

### 3. **Updated Components**

#### `ConnectionPanel.svelte`
- Changed from WebSocket to HTTP API connection
- Now tests `/api/o/test` endpoint for connectivity
- Updated UI to show API URL instead of IP address
- New instructions for FastAPI backend

#### `CommandLog.svelte`
- Updated to use new apiStore
- Changed status indicators (success/error/sent)
- Now shows API activity instead of WebSocket commands

### 4. **Frontend Integration**

The frontend can now use these **implemented** backend endpoints:

✅ **Navigation**
- `captureTestData()` - Generate test images with metadata
- `addWaypoint()` - Add GPS waypoints
- `generateComprehensiveReport()` - Generate PDF reports with embedded images
- `getWaypoints()`, `getMetadata()` - Retrieve data
- `getRouteAnalysis()` - Get route statistics
- `exportData()` - Export in JSON/CSV format

✅ **Diagnostics**
- `runDoctor()` - Run ROS2 system diagnostics

✅ **Connectivity**
- `testApi()` - Test connection
- `checkApiHealth()` - Verify API is reachable

### 5. **UI Features Status**

**Implemented (Backend + Frontend):**
- Image capture with metadata ✅
- Waypoint management ✅
- Mission report generation (HTML + PDF) ✅
- Route analysis and statistics ✅
- Data export ✅
- ROS2 diagnostics ✅

**NOT Implemented (UI displays, but backend doesn't support):**
- Joystick movement control ❌
- Steering mode toggle ❌
- Drill speed control ❌
- Individual wheel control ❌
- Camera feed streaming ❌
- Collection system controls ❌
- Test tube rotation ❌
- Soil analysis ❌
- Antenna controls ❌

These unimplemented features log to console instead of making API calls.

## How to Use

### Start Backend
```bash
cd endpoint
uvicorn main:app --host 0.0.0.0 --port 6767
# Or with auto-reload for development:
uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### Start Frontend
```bash
cd dashboard
npm run dev
```

### Connect
1. Open dashboard in browser (typically http://localhost:5173)
2. In "Rover API Connection" panel, enter: `http://localhost:6767`
3. Click "Connect" to test connection
4. Green status = ready to use

### Test
- Click "Capture Test Image" to generate a test image with metadata
- Click "Generate Mission Report" to create a PDF report
- Click "Run System Diagnostics" to check ROS2 status
- Use "Add Waypoint" to save GPS coordinates

## API Documentation

See `API_REFERENCE.md` for complete endpoint documentation.

Or view auto-generated FastAPI docs at: http://localhost:6767/docs

## File Structure

```
dashboard/
├── src/
│   ├── lib/
│   │   ├── services/
│   │   │   └── roverApi.js          # NEW: API service layer
│   │   ├── stores/
│   │   │   ├── apiStore.js          # NEW: API connection store
│   │   │   └── commandStore.js      # OLD: WebSocket store (deprecated)
│   │   └── components/
│   │       ├── ConnectionPanel.svelte  # UPDATED: HTTP connection
│   │       ├── CommandLog.svelte       # UPDATED: API activity log
│   │       ├── Joystick.svelte        # Unchanged
│   │       ├── ToggleSwitch.svelte    # Unchanged
│   │       └── Modal.svelte           # Unchanged
│   └── routes/
│       └── +page.svelte              # UPDATED: Uses roverApi.js
└── API_REFERENCE.md                  # NEW: Complete API docs

endpoint/
├── main.py                           # FastAPI app (port 6767)
├── app/api/
│   ├── navigation/                   # Implemented endpoints
│   ├── diagnostics/                  # Implemented: doctor
│   ├── science/                      # Only 'available' endpoint
│   ├── arm/                          # Only 'available' endpoint
│   └── others/                       # Implemented: test
└── storage/                          # Data storage
    ├── images/
    ├── reports/
    ├── metadata.json
    └── waypoints.json
```

## Migration Notes

If you were using the old WebSocket version:

1. **Old:** `ws://localhost:8080` → **New:** `http://localhost:6767`
2. **Old:** `dispatchCommand('COMMAND', data)` → **New:** `await api.functionName(data)`
3. **Old:** WebSocket connection → **New:** HTTP REST API
4. **Old:** `commandStore` → **New:** `apiStore`

## Next Steps

To add new functionality:
1. Implement endpoint in backend (`endpoint/app/api/`)
2. Add function to `roverApi.js`
3. Update UI to call the new function
4. Test with "Connect" → API call → check logs

Enjoy your rover control dashboard! 🚀
