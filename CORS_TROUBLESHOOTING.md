# CORS 405 Error Fix - Troubleshooting Guide

## Current Issue
Getting `"OPTIONS /api/o/test HTTP/1.1" 405 Method Not Allowed` when trying to connect.

## Changes Made

### 1. Added CORS Middleware (`endpoint/main.py`)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Added Explicit OPTIONS Handler (`endpoint/app/api/others/test.py`)
```python
@router.options("/test")
async def api_test_options():
    return {"success": True, "message": "OPTIONS request handled"}
```

### 3. Added Root Endpoint (`endpoint/main.py`)
```python
@app.get("/")
async def root():
    return {"status": "ok", "message": "Rover API Server is running"}
```

## CRITICAL: Server Must Be Restarted

The server is likely still running the OLD code without CORS support!

### Step 1: Kill the Server Completely
```bash
# Find the process
ps aux | grep uvicorn

# Kill it (replace PID with actual process ID)
kill -9 <PID>

# Or use:
pkill -9 -f uvicorn
```

### Step 2: Restart the Server
```bash
cd /home/adithya/projects/rover/endpoint

# Start with reload flag
python -m uvicorn main:app --host 0.0.0.0 --port 6767 --reload
```

### Step 3: Verify Server Has New Code
Test the root endpoint:
```bash
curl http://localhost:6767/
```

Should return:
```json
{
  "status": "ok",
  "message": "Rover API Server is running",
  "version": "2.0.0"
}
```

### Step 4: Test OPTIONS Request
```bash
curl -X OPTIONS http://localhost:6767/api/o/test \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

Should return **200 OK** with CORS headers:
```
< HTTP/1.1 200 OK
< access-control-allow-origin: *
< access-control-allow-methods: *
< access-control-allow-headers: *
```

### Step 5: Test POST Request
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

## Alternative: Check if Server is Running Old Code

### Quick Check
Run this command while server is running:
```bash
cat /home/adithya/projects/rover/endpoint/main.py | grep -A 5 "CORSMiddleware"
```

If you see the CORS middleware code, the file is updated.

### Check Server Start Command
Make sure you're running:
```bash
uvicorn main:app --reload
```

NOT:
```bash
python main.py
```

The `--reload` flag ensures code changes are picked up.

## If Still Not Working

### Option 1: Restart Everything
```bash
# Kill backend
pkill -9 -f uvicorn

# Kill frontend  
pkill -9 -f vite

# Start backend
cd /home/adithya/projects/rover/endpoint
python -m uvicorn main:app --host 0.0.0.0 --port 6767 --reload

# In new terminal, start frontend
cd /home/adithya/projects/rover/dashboard
npm run dev
```

### Option 2: Check Python Imports
Verify FastAPI CORS is available:
```bash
cd /home/adithya/projects/rover/endpoint
python -c "from fastapi.middleware.cors import CORSMiddleware; print('CORS import OK')"
```

### Option 3: Add Debug Logging
Edit `endpoint/main.py` and add:
```python
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    print(f"Response status: {response.status_code}")
    return response
```

This will log every request.

## Expected Server Output After Fix

```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:6767
INFO:     172.23.204.89:46580 - "OPTIONS /api/o/test HTTP/1.1" 200 OK
INFO:     172.23.204.89:46580 - "POST /api/o/test HTTP/1.1" 200 OK
```

## Browser Console Check

Open browser dev tools (F12) → Network tab:
1. Try connecting from dashboard
2. Look for `/api/o/test` request
3. Check "Headers" tab
4. Under "Response Headers", should see:
   - `access-control-allow-origin: *`
   - `access-control-allow-methods: *`

If these headers are missing, CORS middleware is NOT running!

## Last Resort: Manual CORS Headers

If middleware isn't working, add manual headers to the test endpoint:

```python
from fastapi import Response

@router.post("/test")
async def api_test_point(request: Request, response: Response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    data = await request.json() if request.headers.get("content-type") == "application/json" else None
    
    return {
        "success": True,
        "status": "Success",
        "message": "The POST Request was successfully validated.",
        "data": data
    }
```

But this is a workaround - the middleware approach should work.
