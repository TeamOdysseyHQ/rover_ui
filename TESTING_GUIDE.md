# Frontend Testing Guide

## Overview
This guide helps you test the updated Rover Dashboard frontend that now uses the FastAPI REST API backend.

## Prerequisites
1. **Backend running**: FastAPI server on port 6767
2. **Frontend running**: SvelteKit dev server on port 5173
3. **CORS enabled**: Backend must have CORS middleware configured

## Starting the Servers

### Backend
```bash
cd /home/adithya/projects/rover/endpoint
uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### Frontend
```bash
cd /home/adithya/projects/rover/dashboard
npm run dev
```

## Test Checklist

### 1. Connection Test
- [ ] Open browser to `http://localhost:5173`
- [ ] In the "Connection Panel", enter API URL: `http://localhost:6767`
- [ ] Click "Connect"
- [ ] Status should change to green "Connected"
- [ ] Check browser console for any errors

**Expected Result**: Green connected status, no CORS errors in console

### 2. Test Image Capture
- [ ] Ensure API is connected
- [ ] Click "Capture Test Image" button in the "Imaging & Reports" section
- [ ] Check for success feedback message at the top of the page
- [ ] Check Command Log for the API call

**Expected Result**: Success message appears, command logged as "success"

**Backend Verification**:
```bash
ls /home/adithya/projects/rover/endpoint/storage/images/
curl http://localhost:6767/api/nav/get_metadata
```

### 3. Add Waypoint (Autonomous Mode)
- [ ] Click "Go Autonomous" button
- [ ] Modal opens with GPS coordinate inputs
- [ ] Enter test coordinates (default: 16.5062, 80.6480)
- [ ] Click "Add Waypoint & Start"
- [ ] Check for success feedback message
- [ ] Check Command Log

**Expected Result**: Success message with waypoint ID, command logged

**Backend Verification**:
```bash
curl http://localhost:6767/api/nav/get_waypoints
cat /home/adithya/projects/rover/endpoint/storage/waypoints.json
```

### 4. View Waypoints
- [ ] Click "View Waypoints" button in Navigation section
- [ ] Modal opens showing list of waypoints
- [ ] Each waypoint displays: latitude, longitude, type, timestamp
- [ ] Close modal

**Expected Result**: All added waypoints are displayed with correct data

### 5. Generate Report
- [ ] Click "Generate Full Report (PDF)" button
- [ ] Wait for success feedback message
- [ ] Check Command Log

**Expected Result**: Success message with report filename

**Backend Verification**:
```bash
ls /home/adithya/projects/rover/endpoint/storage/reports/
curl -X POST http://localhost:6767/api/nav/reports
```

### 6. View Reports
- [ ] Click "View Reports" button
- [ ] Modal opens showing list of generated reports
- [ ] Each report shows filename and timestamp
- [ ] Download links should be available

**Expected Result**: All generated reports are listed

### 7. Route Analysis
- [ ] Add at least 2 waypoints first
- [ ] Click "Route Analysis" button
- [ ] Modal opens showing mission statistics
- [ ] Should display: total distance, waypoint count, images captured

**Expected Result**: Route analysis data displayed correctly

### 8. Run Diagnostics
- [ ] Click "Run ROS2 Diagnostics" button
- [ ] Wait for completion
- [ ] Check feedback message

**Expected Result**: Success or error message indicating diagnostics ran

### 9. Command Log
- [ ] Perform several API actions
- [ ] Check Command Log panel
- [ ] Should show entries for each action with status (sent/success/error)
- [ ] Entries should have timestamps

**Expected Result**: All API calls are logged with correct status

### 10. Error Handling
- [ ] Disconnect backend (stop uvicorn)
- [ ] Try clicking "Capture Test Image"
- [ ] Should see red error feedback message
- [ ] Command should be logged as "error" status

**Expected Result**: Graceful error handling with user feedback

## API Endpoint Testing

### Test All Navigation Endpoints
```bash
# Test endpoint
curl -X POST http://localhost:6767/api/o/test -H "Content-Type: application/json" -d '{"ping": true}'

# Add waypoint
curl -X POST http://localhost:6767/api/nav/waypoint -F "latitude=16.5062" -F "longitude=80.6480" -F "description=Test point"

# Get waypoints
curl http://localhost:6767/api/nav/get_waypoints

# Capture test data
curl -X POST http://localhost:6767/api/nav/capture_test_data -F "latitude=16.5062" -F "longitude=80.6480"

# Get metadata
curl http://localhost:6767/api/nav/get_metadata

# Generate report
curl -X POST "http://localhost:6767/api/nav/generate_comprehensive_report?mission_id=default"

# List reports
curl -X POST http://localhost:6767/api/nav/reports

# Route analysis
curl -X POST "http://localhost:6767/api/nav/route_analysis?mission_id=default"

# Run diagnostics
curl -X POST http://localhost:6767/api/dgt/doctor
```

## Known Limitations

### Not Implemented in Backend
The following UI controls do NOT have backend implementations:
- Joystick movement
- Steering mode toggles (Ackerman/Independent)
- Drill controls (speed, toggle)
- Test tube rotation
- Soil type prediction
- Site reason logging
- Camera feeds
- Individual wheel control
- Antenna alignment
- Frequency scanning

These controls will log to console but won't send API requests.

### Implemented Features
The following features ARE fully implemented:
- ✅ Connection testing
- ✅ Test image capture
- ✅ Waypoint management
- ✅ Report generation (text + PDF)
- ✅ Route analysis
- ✅ ROS2 diagnostics
- ✅ Metadata retrieval
- ✅ Command logging

## Troubleshooting

### CORS Errors
If you see CORS errors in browser console:
```bash
# Restart backend to load CORS middleware
cd /home/adithya/projects/rover/endpoint
pkill -9 -f uvicorn
python -m uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### Connection Fails
1. Verify backend is running: `curl http://localhost:6767/`
2. Check API test endpoint: `curl -X POST http://localhost:6767/api/o/test`
3. Clear browser cache and reload
4. Check browser console for errors

### Feedback Not Showing
- Feedback messages auto-dismiss after 5 seconds
- Click the ✕ button to dismiss manually
- Messages appear at the top of the dashboard

### Modal Not Opening
- Ensure API is connected (green status)
- Check Command Log for errors
- Verify backend has data (waypoints, reports, etc.)

## Success Criteria

A successful test run should:
1. ✅ Connect to API without CORS errors
2. ✅ Capture test images successfully
3. ✅ Add and retrieve waypoints
4. ✅ Generate and list reports
5. ✅ Display route analysis
6. ✅ Log all commands in Command Log
7. ✅ Show appropriate feedback messages
8. ✅ Handle errors gracefully

## Browser Console Checks

### Expected Console Output
```
Connection successful
Command sent: CAPTURE_TEST_DATA
API response: {success: true, ...}
```

### Unexpected Console Output (Errors)
```
CORS error                          → Restart backend
Failed to fetch                     → Check backend is running
404 Not Found                       → Check API URL is correct
Network request failed              → Check firewall/network
```

## Next Steps After Testing

If all tests pass:
1. Document any bugs found
2. Add more test data (waypoints, images)
3. Implement additional features as needed
4. Deploy to production environment

## Support

For issues:
1. Check this testing guide
2. Review `/dashboard/CORS_TROUBLESHOOTING.md`
3. Check backend logs: `tail -f endpoint/logs/server.log`
4. Review API documentation: `http://localhost:6767/docs`
