# Testing the Connection

## Issue
The frontend was getting a 405 error for OPTIONS requests because:
1. The backend didn't have CORS middleware configured
2. Browsers send OPTIONS preflight requests before POST requests from different origins

## Fix Applied
Added CORS middleware to `endpoint/main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## How to Test

### 1. Restart the Backend
The CORS changes require a server restart:

```bash
cd endpoint
# Stop the server if running (Ctrl+C)
# Start it again:
uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### 2. Test the Connection
Open the dashboard and try connecting:
1. Go to http://localhost:5173 (or your dev server port)
2. Enter API URL: `http://localhost:6767`
3. Click "Connect"

### 3. Verify in Browser Console
You should see:
- ✅ OPTIONS request returns 200 OK (CORS preflight)
- ✅ POST request returns 200 OK with `{"success": true, ...}`
- ✅ Green "Connected" status in dashboard

### 4. Test API Endpoints
Once connected, try:
- Click "Capture Test Image" button
- Click "Generate Mission Report" button
- Check the "API Activity Log" for successful calls

## Expected Behavior

**Before Fix:**
```
INFO: 172.23.204.89:36580 - "OPTIONS /api/o/test HTTP/1.1" 405 Method Not Allowed
```

**After Fix:**
```
INFO: 172.23.204.89:36580 - "OPTIONS /api/o/test HTTP/1.1" 200 OK
INFO: 172.23.204.89:36580 - "POST /api/o/test HTTP/1.1" 200 OK
```

## Troubleshooting

If still not working:

### Check Backend is Running
```bash
curl -X POST http://localhost:6767/api/o/test \
  -H "Content-Type: application/json" \
  -d '{"ping": true}'
```

Should return:
```json
{
  "success": true,
  "status": "Success",
  "message": "The POST Request was successfully validated...",
  "data": {"ping": true}
}
```

### Check CORS Headers
```bash
curl -X OPTIONS http://localhost:6767/api/o/test \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

Should include headers like:
```
< access-control-allow-origin: *
< access-control-allow-methods: *
< access-control-allow-headers: *
```

### Check Frontend API URL
Make sure you're using the correct URL format:
- ✅ `http://localhost:6767` (correct)
- ❌ `http://localhost:6767/` (trailing slash may cause issues)
- ❌ `localhost:6767` (missing protocol)

## Production Notes

For production deployment, restrict CORS to specific origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://your-production-domain.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
```
