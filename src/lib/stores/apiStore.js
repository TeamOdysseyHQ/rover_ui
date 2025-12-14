import { writable } from 'svelte/store';

// Store for rover command history (for logging purposes)
export const commandHistory = writable([]);

// Store for API connection status
export const apiStatus = writable('disconnected'); // 'connected' | 'disconnected' | 'error'

// Store for rover API base URL
export const roverApiUrl = writable('http://localhost:6767');

/**
 * Test connection to rover API
 */
export async function testConnection(url) {
    try {
        const response = await fetch(`${url}/api/o/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ping: true })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                apiStatus.set('connected');
                roverApiUrl.set(url);
                return true;
            }
        }
        
        apiStatus.set('error');
        return false;
    } catch (error) {
        console.error('Connection test failed:', error);
        apiStatus.set('error');
        return false;
    }
}

/**
 * Disconnect from rover API
 */
export function disconnectFromRover() {
    apiStatus.set('disconnected');
}

/**
 * Log a command to history
 */
export function logCommand(command, status = 'sent', response = null) {
    const entry = {
        id: crypto.randomUUID(),
        command,
        timestamp: new Date().toISOString(),
        status, // 'sent' | 'success' | 'error'
        response
    };
    
    commandHistory.update(history => [...history, entry]);
    return entry;
}

/**
 * Clear command history
 */
export function clearCommandHistory() {
    commandHistory.set([]);
}
