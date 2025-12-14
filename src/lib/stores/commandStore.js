import { writable } from 'svelte/store';

export const commandHistory = writable([]);
export const connectionStatus = writable('disconnected');
export const roverIP = writable('');

let ws = null;

export function connectToRover(ip) {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.close();
	}
	
	try {
		// Connect via WebSocket to the rover
		ws = new WebSocket(`ws://${ip}:6767`);
		
		ws.onopen = () => {
			console.log('✅ Connected to rover at', ip);
			console.log('WebSocket ready state:', ws.readyState);
			connectionStatus.set('connected');
			roverIP.set(ip);
			
			// Send test message
			ws.send(JSON.stringify({ command: 'CONNECTION_TEST', data: {}, timestamp: new Date().toISOString() }));
		};
		
		ws.onclose = () => {
			console.log('❌ Disconnected from rover');
			connectionStatus.set('disconnected');
		};
		
		ws.onerror = (error) => {
			console.error('❌ WebSocket error:', error);
			connectionStatus.set('error');
		};
		
		ws.onmessage = (event) => {
			console.log('📥 Received from rover:', event.data);
		};
	} catch (error) {
		console.error('Failed to connect:', error);
		connectionStatus.set('error');
	}
}

export function disconnectFromRover() {
	if (ws) {
		ws.close();
		ws = null;
	}
	connectionStatus.set('disconnected');
	roverIP.set('');
}

// Fallback UUID generator for older browsers
function generateUUID() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

export function dispatchCommand(command, data = {}) {
	const timestamp = new Date().toISOString();
	const commandEntry = {
		id: generateUUID(),
		command,
		data,
		timestamp,
		status: 'sent'
	};
	
	commandHistory.update(history => [...history, commandEntry]);
	
	console.log('🚀 Command Dispatched:', commandEntry);
	
	// Send command to rover via WebSocket
	if (ws && ws.readyState === WebSocket.OPEN) {
		try {
			ws.send(JSON.stringify(commandEntry));
			console.log('📤 Sent to rover:', commandEntry);
			
			// Update status to transmitted
			setTimeout(() => {
				commandHistory.update(history => 
					history.map(cmd => 
						cmd.id === commandEntry.id 
							? { ...cmd, status: 'transmitted' }
							: cmd
					)
				);
			}, 100);
		} catch (error) {
			console.error('Failed to send command:', error);
			commandHistory.update(history => 
				history.map(cmd => 
					cmd.id === commandEntry.id 
						? { ...cmd, status: 'failed' }
						: cmd
				)
			);
		}
	} else {
		console.warn('⚠️ Not connected to rover. Command logged locally only.');
		// Simulate local execution
		setTimeout(() => {
			commandHistory.update(history => 
				history.map(cmd => 
					cmd.id === commandEntry.id 
						? { ...cmd, status: 'local_only' }
						: cmd
				)
			);
		}, 500);
	}
	
	return commandEntry;
}
