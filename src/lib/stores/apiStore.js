import { writable, derived } from 'svelte/store';
import * as roverApi from '$lib/services/roverApi';

// API connection status
export const apiStatus = writable('disconnected'); // 'connected' | 'disconnected' | 'connecting'
export const roverApiUrl = writable('http://localhost:5000');

// Command history for logging
export const commandHistory = writable([]);

// Test API connection
export async function testConnection(url) {
	try {
		apiStatus.set('connecting');
		roverApiUrl.set(url);
		
		// Test the connection
		const response = await fetch(`${url}/api/status`);
		if (response.ok) {
			apiStatus.set('connected');
			return { success: true };
		} else {
			apiStatus.set('disconnected');
			return { success: false, error: 'Connection failed' };
		}
	} catch (error) {
		apiStatus.set('disconnected');
		return { success: false, error: error.message };
	}
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
