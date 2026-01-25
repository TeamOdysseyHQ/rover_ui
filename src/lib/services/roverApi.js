/**
 * Rover API Service
 * Handles all HTTP requests to the FastAPI backend
 */

// Default API base URL - can be configured
let API_BASE_URL = 'http://localhost:6767';

export function setApiBaseUrl(url) {
    API_BASE_URL = url.replace(/\/$/, ''); // Remove trailing slash
}

export function getApiBaseUrl() {
    return API_BASE_URL;
}

/**
 * Generic API request handler
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API Request failed for ${endpoint}:`, error);
        throw error;
    }
}

// ============================================
// NAVIGATION ENDPOINTS (/api/nav/)
// ============================================

/**
 * Get available navigation endpoints
 */
export async function getNavEndpoints() {
    return apiRequest('/api/nav/available', { method: 'POST' });
}

/**
 * Capture camera screenshot with metadata
 */
export async function captureImage(formData) {
    const url = `${API_BASE_URL}/api/nav/capture`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData // FormData already sets correct Content-Type
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Capture test data (generates dummy image)
 */
export async function captureTestData(data = {}) {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
        formData.append(key, data[key]);
    });
    
    const url = `${API_BASE_URL}/api/nav/capture_test_data`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Add a waypoint
 */
export async function addWaypoint(data) {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
        formData.append(key, data[key]);
    });
    
    const url = `${API_BASE_URL}/api/nav/waypoint`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Get waypoints
 */
export async function getWaypoints(missionId = null) {
    const params = missionId ? `?mission_id=${missionId}` : '';
    return apiRequest(`/api/nav/get_waypoints${params}`, { method: 'GET' });
}

/**
 * Get metadata
 */
export async function getMetadata(missionId = null) {
    const params = missionId ? `?mission_id=${missionId}` : '';
    return apiRequest(`/api/nav/get_metadata${params}`, { method: 'GET' });
}

/**
 * Generate mission report
 */
export async function generateReport(missionId = 'default') {
    const params = `?mission_id=${missionId}`;
    return apiRequest(`/api/nav/generate_report${params}`, { method: 'POST' });
}

/**
 * Generate comprehensive report with PDF
 */
export async function generateComprehensiveReport(missionId = 'default') {
    const params = `?mission_id=${missionId}`;
    return apiRequest(`/api/nav/generate_comprehensive_report${params}`, { method: 'POST' });
}

/**
 * Get route analysis
 */
export async function getRouteAnalysis(missionId = 'default') {
    const params = `?mission_id=${missionId}`;
    return apiRequest(`/api/nav/route_analysis${params}`, { method: 'POST' });
}

/**
 * Export data
 */
export async function exportData(missionId = null, format = 'json') {
    const params = new URLSearchParams();
    if (missionId) params.append('mission_id', missionId);
    params.append('format', format);
    
    return apiRequest(`/api/nav/export_data?${params.toString()}`, { method: 'POST' });
}

/**
 * List reports
 */
export async function listReports() {
    return apiRequest('/api/nav/reports', { method: 'POST' });
}

// ============================================
// DIAGNOSTICS ENDPOINTS (/api/dgt/)
// ============================================

/**
 * Get available diagnostics endpoints
 */
export async function getDiagnosticsEndpoints() {
    return apiRequest('/api/dgt/available', { method: 'POST' });
}

/**
 * Run ROS2 doctor diagnostics
 */
export async function runDoctor() {
    return apiRequest('/api/dgt/doctor', { method: 'POST' });
}

// ============================================
// SCIENCE ENDPOINTS (/api/sci/)
// ============================================

/**
 * Get available science endpoints
 */
export async function getScienceEndpoints() {
    return apiRequest('/api/sci/available', { method: 'POST' });
}

// ============================================
// ARM ENDPOINTS (/api/arm/)
// ============================================

/**
 * Get available arm endpoints
 */
export async function getArmEndpoints() {
    return apiRequest('/api/arm/available', { method: 'POST' });
}

// ============================================
// OTHER ENDPOINTS (/api/o/)
// ============================================

/**
 * Get available other endpoints
 */
export async function getOtherEndpoints() {
    return apiRequest('/api/o/available', { method: 'POST' });
}

/**
 * Test endpoint
 */
export async function testApi(data = {}) {
    return apiRequest('/api/o/test', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// ============================================
// CAMERA ENDPOINTS (/api/nav/cameras/)
// ============================================

/**
 * Detect all connected cameras
 */
export async function detectCameras(maxCameras = 10) {
    const params = `?max_cameras=${maxCameras}`;
    return apiRequest(`/api/nav/cameras/detect${params}`, { method: 'GET' });
}

/**
 * Get supported resolutions for a specific camera
 */
export async function getSupportedResolutions(cameraName) {
    const url = `${API_BASE_URL}/api/nav/cameras/${cameraName}/resolutions`;
    const response = await fetch(url, {
        method: 'GET'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Start a specific camera
 */
export async function startCamera(cameraName, width = 1280, height = 720, fps = 30) {
    const formData = new FormData();
    formData.append('width', width.toString());
    formData.append('height', height.toString());
    formData.append('fps', fps.toString());
    
    const url = `${API_BASE_URL}/api/nav/cameras/${cameraName}/start`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Stop a specific camera
 */
export async function stopCamera(cameraName) {
    const url = `${API_BASE_URL}/api/nav/cameras/${cameraName}/stop`;
    const response = await fetch(url, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Stop all cameras
 */
export async function stopAllCameras() {
    const url = `${API_BASE_URL}/api/nav/cameras/stop_all`;
    const response = await fetch(url, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Get all cameras status
 */
export async function getCamerasStatus() {
    return apiRequest('/api/nav/cameras/status', { method: 'GET' });
}

/**
 * Get specific camera status
 */
export async function getCameraStatus(cameraName) {
    return apiRequest(`/api/nav/cameras/${cameraName}/status`, { method: 'GET' });
}

/**
 * Capture image from a specific camera
 */
export async function captureCameraImage(cameraName, telemetry = {}) {
    const formData = new FormData();
    
    // Add telemetry data
    Object.entries(telemetry).forEach(([key, value]) => {
        formData.append(key, value.toString());
    });
    
    const url = `${API_BASE_URL}/api/nav/cameras/${cameraName}/capture`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Get camera stream URL (MJPEG)
 */
export function getCameraStreamUrl(cameraName) {
    return `${API_BASE_URL}/api/nav/cameras/${cameraName}/stream`;
}

/**
 * Get camera WebSocket stream URL
 */
export function getCameraWebSocketUrl(cameraName, quality = 85, fps = 30) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = API_BASE_URL.replace(/^https?:\/\//, '');
    return `${protocol}//${host}/api/nav/cameras/${cameraName}/ws?quality=${quality}&fps=${fps}`;
}

/**
 * Get WebSocket streaming status for all cameras
 */
export async function getWebSocketStatus() {
    return apiRequest('/api/nav/cameras/ws/status', { method: 'GET' });
}

/**
 * Get WebSocket streaming status for specific camera
 */
export async function getCameraWebSocketStatus(cameraName) {
    return apiRequest(`/api/nav/cameras/${cameraName}/ws/status`, { method: 'GET' });
}

// ============================================
// MICROSCOPE ENDPOINTS (/api/sci/microscope/)
// ============================================

/**
 * Start microscope device
 */
export async function startMicroscope(width = 640, height = 480, fps = 30) {
    const formData = new FormData();
    formData.append('width', width.toString());
    formData.append('height', height.toString());
    formData.append('fps', fps.toString());
    
    const url = `${API_BASE_URL}/api/sci/microscope/start`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Stop microscope device
 */
export async function stopMicroscope() {
    const url = `${API_BASE_URL}/api/sci/microscope/stop`;
    const response = await fetch(url, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Get microscope status
 */
export async function getMicroscopeStatus() {
    return apiRequest('/api/sci/microscope/status', { method: 'GET' });
}

/**
 * Get microscope MJPEG stream URL
 */
export function getMicroscopeStreamUrl() {
    return `${API_BASE_URL}/api/sci/microscope/stream`;
}

/**
 * Capture microscope image with metadata
 */
export async function captureMicroscopeImage(metadata) {
    const formData = new FormData();
    formData.append('latitude', metadata.latitude);
    formData.append('longitude', metadata.longitude);
    formData.append('altitude', metadata.altitude);
    formData.append('battery_level', metadata.battery_level);
    formData.append('mission_id', metadata.mission_id);
    formData.append('rover_id', metadata.rover_id);
    formData.append('note', metadata.note || '');
    formData.append('tags', 'microscope,science'); // Auto-tags
    
    const url = `${API_BASE_URL}/api/sci/microscope/capture`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// ============================================
// ROS BRIDGE ENDPOINTS (/api/ros/ and /api/nav/ros/)
// ============================================

/**
 * Get ROS connection status
 */
export async function getRosStatus() {
    return apiRequest('/api/ros/status', { method: 'GET' });
}

/**
 * Connect to ROS manually
 */
export async function connectToRos() {
    return apiRequest('/api/ros/connect', { method: 'POST' });
}

/**
 * Disconnect from ROS
 */
export async function disconnectFromRos() {
    return apiRequest('/api/ros/disconnect', { method: 'POST' });
}

/**
 * Publish velocity command to /cmd_vel
 */
export async function publishCmdVel(velocityCommand) {
    return apiRequest('/api/nav/ros/cmd_vel', {
        method: 'POST',
        body: JSON.stringify(velocityCommand)
    });
}

/**
 * Send stop command to rover
 */
export async function stopRover() {
    return apiRequest('/api/nav/ros/cmd_vel/stop', { method: 'POST' });
}

/**
 * Subscribe to odometry data
 */
export async function subscribeToOdometry() {
    return apiRequest('/api/nav/ros/odom/subscribe', { method: 'POST' });
}

/**
 * Get latest odometry data
 */
export async function getOdometry() {
    return apiRequest('/api/nav/ros/odom', { method: 'GET' });
}

/**
 * Get latest teensy topic data
 */
export async function getTeensyTopic() {
    return apiRequest('/api/o/teensy_topic', { method: 'GET' });
}

/**
 * Unsubscribe from teensy topic
 */
export async function unsubscribeTeensyTopic() {
    return apiRequest('/api/o/teensy_topic/unsubscribe', { method: 'POST' });
}

/**
 * Debug teensy topic state
 */
export async function debugTeensyTopic() {
    return apiRequest('/api/o/teensy_topic/debug', { method: 'GET' });
}

/**
 * Publish custom ROS message
 */
export async function publishRosMessage(topic, messageType, message) {
    return apiRequest('/api/nav/ros/publish', {
        method: 'POST',
        body: JSON.stringify({ topic, message_type: messageType, message })
    });
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Check if API is reachable
 */
export async function checkApiHealth() {
    try {
        const response = await testApi({ ping: true });
        return response.success === true;
    } catch (error) {
        return false;
    }
}

/**
 * Get all available endpoints from all modules
 */
export async function getAllEndpoints() {
    try {
        const [nav, dgt, sci, arm, other] = await Promise.all([
            getNavEndpoints().catch(() => ({ endpoints: [] })),
            getDiagnosticsEndpoints().catch(() => ({ endpoints: [] })),
            getScienceEndpoints().catch(() => ({ endpoints: [] })),
            getArmEndpoints().catch(() => ({ endpoints: [] })),
            getOtherEndpoints().catch(() => ({ endpoints: [] }))
        ]);
        
        return {
            navigation: nav.endpoints || [],
            diagnostics: dgt.endpoints || [],
            science: sci.endpoints || [],
            arm: arm.endpoints || [],
            other: other.endpoints || []
        };
    } catch (error) {
        console.error('Failed to fetch endpoints:', error);
        return {
            navigation: [],
            diagnostics: [],
            science: [],
            arm: [],
            other: []
        };
    }
}
