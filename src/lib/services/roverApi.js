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
