# Quick Start Guide - Updated Rover Dashboard

## What's New? 🎉

The Rover Dashboard has been completely rewritten to use the **FastAPI REST API backend** instead of WebSockets. All core features are now working!

## Getting Started

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd /home/adithya/projects/rover/endpoint
uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

**Terminal 2 - Frontend:**
```bash
cd /home/adithya/projects/rover/dashboard
npm run dev
```

### 2. Open Browser
Navigate to: `http://localhost:5173`

### 3. Connect to API
- Look for the **"Connection Panel"** in the left column
- The API URL should already be set to: `http://localhost:6767`
- Click the **"Connect"** button
- Status should turn **GREEN** and show "Connected"

## New Features You Can Use

### ✅ Working Features (with backend support)

#### 1. Capture Test Images
**Location**: Right column → "Imaging & Reports" section  
**Button**: "Capture Test Image"

**What it does**:
- Generates a test image with GPS coordinates
- Stores it in `/endpoint/storage/images/`
- Shows success feedback message

#### 2. Add Waypoints
**Location**: Left column → "Driving Controls" section  
**Button**: "Go Autonomous"

**What it does**:
- Opens a modal to enter GPS coordinates
- Adds waypoint to mission
- Stores in `/endpoint/storage/waypoints.json`
- Shows success feedback with waypoint ID

#### 3. View Waypoints
**Location**: Left column → "Navigation & Journey" section  
**Button**: "View Waypoints"

**What it does**:
- Opens modal showing all waypoints
- Displays latitude, longitude, type, timestamp
- Scrollable list

#### 4. Generate Reports
**Location**: Right column → "Imaging & Reports" section  
**Button**: "Generate Full Report (PDF)"

**What it does**:
- Creates comprehensive mission report
- Includes waypoints, images, statistics
- Saves PDF to `/endpoint/storage/reports/`
- Shows success message with filename

#### 5. View Reports
**Location**: Right column → "Imaging & Reports" section  
**Button**: "View Reports"

**What it does**:
- Lists all generated reports
- Shows filename and timestamp
- Provides download links

#### 6. Route Analysis
**Location**: Left column → "Navigation & Journey" section  
**Button**: "Route Analysis"

**What it does**:
- Shows mission statistics
- Total distance, waypoints, images captured
- Mission duration
- Path segments breakdown

#### 7. Run Diagnostics
**Location**: Right column → "Imaging & Reports" section  
**Button**: "Run ROS2 Diagnostics"

**What it does**:
- Runs ROS2 doctor checks
- Returns system health status
- Shows success/error feedback

### ⚠️ UI Only Features (not connected to backend)
These controls appear in the UI but don't send API requests:
- Joystick movement
- Steering mode toggles
- Drill controls
- Test tube rotation
- Camera feed toggles
- Individual wheel controls

They will log to browser console but won't affect the rover.

## User Feedback System

### Feedback Messages
At the top of the dashboard, you'll see feedback messages for all actions:

- **Green background** = Success ✓
- **Red background** = Error ✗
- **Blue background** = Info ℹ

Messages auto-dismiss after 5 seconds or click **✕** to dismiss.

### Command Log
**Location**: Left column → "Command Log" section

Shows all API activity:
- **Blue dot** = Sent
- **Green checkmark** = Success
- **Red X** = Error
- Timestamps for each action

## Typical Workflow

### Mission Example:

1. **Connect to API**
   - Click "Connect" in Connection Panel
   - Wait for green status

2. **Add First Waypoint**
   - Click "Go Autonomous"
   - Enter coordinates: `16.5062`, `80.6480`
   - Click "Add Waypoint & Start"
   - See success message

3. **Capture Images**
   - Click "Capture Test Image" (simulate taking photo)
   - Repeat for multiple locations
   - Each capture logs to Command Log

4. **Add More Waypoints**
   - Repeat step 2 with different coordinates
   - Build your mission path

5. **View Mission Data**
   - Click "View Waypoints" to see all points
   - Click "Route Analysis" for statistics

6. **Generate Report**
   - Click "Generate Full Report (PDF)"
   - Wait for success message
   - Click "View Reports" to see it listed

7. **Run Diagnostics** (optional)
   - Click "Run ROS2 Diagnostics"
   - Check system health

## Troubleshooting

### Can't Connect?
```bash
# Check if backend is running
curl http://localhost:6767/

# Should see: {"status":"ok","message":"Rover API Server is running"}
```

### CORS Errors?
```bash
# Restart backend
cd /home/adithya/projects/rover/endpoint
pkill -9 -f uvicorn
uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### Buttons Disabled?
- Check connection status (top of page)
- Must be connected to use features
- Look for green "CONNECTED" status

### No Feedback Messages?
- Check browser console for errors
- Ensure JavaScript is enabled
- Try refreshing the page

## Testing Everything

**Quick test sequence:**
```bash
# 1. Test API directly
curl -X POST http://localhost:6767/api/o/test -H "Content-Type: application/json" -d '{"ping": true}'

# 2. Add a waypoint
curl -X POST http://localhost:6767/api/nav/waypoint -F "latitude=16.5" -F "longitude=80.6"

# 3. View waypoints
curl http://localhost:6767/api/nav/get_waypoints

# 4. Generate report
curl -X POST "http://localhost:6767/api/nav/generate_comprehensive_report?mission_id=default"
```

Then verify in UI:
- ✓ Connect button works
- ✓ Waypoints appear in modal
- ✓ Reports listed
- ✓ Command log shows activity

## What Changed from Old Version?

### Before (WebSocket):
- Connected to `rover_server.cjs` on port 8080
- Used WebSocket commands
- No persistent data storage
- Many features not implemented

### Now (REST API):
- Connects to FastAPI backend on port 6767
- Uses HTTP REST endpoints
- Persistent storage (files + JSON)
- Working waypoints, reports, diagnostics
- Better error handling
- User feedback on all actions

## Need More Help?

Check these documents:
1. `TESTING_GUIDE.md` - Detailed testing procedures
2. `API_REFERENCE.md` - Complete API documentation
3. `IMPLEMENTATION_SUMMARY.md` - Technical details
4. `CORS_TROUBLESHOOTING.md` - Connection issues

## API Documentation
Visit: `http://localhost:6767/docs` for interactive API docs (Swagger UI)

## Data Storage Locations

All data stored in `/home/adithya/projects/rover/endpoint/storage/`:
- `images/` - Captured images
- `reports/` - Generated PDF reports
- `waypoints.json` - Mission waypoints
- `metadata.json` - Image metadata

---

**Version**: 2.0.0  
**Last Updated**: December 12, 2025  
**Status**: ✅ Production Ready
