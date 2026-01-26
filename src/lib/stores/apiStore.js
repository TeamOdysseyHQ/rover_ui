import { writable, derived } from 'svelte/store';
import * as roverApi from '$lib/services/roverApi';

// API connection status
export const apiStatus = writable('disconnected'); // 'connected' | 'disconnected' | 'connecting' | 'error'
export const roverApiUrl = writable('http://10.202.197.189:6767');

// Command history for logging
export const commandHistory = writable([]);

// Auto-connect on initialization
let autoConnectAttempted = false;

// Test API connection
export async function testConnection(url) {
	try {
		apiStatus.set('connecting');
		roverApiUrl.set(url);
		
		// Test the connection
		const response = await fetch(`${url}/api/status`);
		if (response.ok) {
			apiStatus.set('connected');
			return true;
		} else {
			apiStatus.set('error');
			return false;
		}
	} catch (error) {
		apiStatus.set('error');
		return false;
	}
}

// Auto-connect to default URL
export async function autoConnect() {
	if (autoConnectAttempted) return;
	autoConnectAttempted = true;
	
	const defaultUrl = 'http://10.202.197.189:6767';
	console.log('[API] Attempting auto-connect to', defaultUrl);
	
	try {
		const response = await fetch(`${defaultUrl}/api/status`, { 
			method: 'GET',
			// Short timeout for auto-connect
			signal: AbortSignal.timeout(3000)
		});
		
		if (response.ok) {
			apiStatus.set('connected');
			roverApiUrl.set(defaultUrl);
			console.log('[API] Auto-connected successfully');
			return true;
		}
	} catch (error) {
		console.log('[API] Auto-connect failed, waiting for manual connection');
	}
	
	return false;
}

// Initialize auto-connect (call this on app startup)
if (typeof window !== 'undefined') {
	// Delay auto-connect slightly to allow page to load
	setTimeout(() => {
		autoConnect();
	}, 500);
}

// Disconnect from rover
export function disconnectFromRover() {
	apiStatus.set('disconnected');
}

// Log a command to history
export function logCommand(command, status, response = null) {
	commandHistory.update(history => {
		const newCommand = {
			id: crypto.randomUUID(),
			command,
			timestamp: Date.now(),
			status,
			response
		};
		return [...history, newCommand].slice(-50); // Keep last 50 commands
	});
}
