import { writable, derived } from 'svelte/store';

// Android sensor data state
export const androidSensorData = writable({
	gps: null,
	accelerometer: null,
	gyroscope: null,
	compass: null,
	connected: false,
	lastUpdate: null
});

// Connection status
export const isAndroidConnected = derived(
	androidSensorData,
	$data => $data.connected === true
);

// WebSocket connection
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

/**
 * Connect to Android sensor WebSocket stream
 * @param {string} baseUrl - API base URL (e.g., 'http://localhost:6767')
 */
export function connectToAndroidSensors(baseUrl = 'http://localhost:6767') {
	// Close existing connection
	if (ws) {
		ws.close();
		ws = null;
	}

	// Convert HTTP to WS protocol
	const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/android/sensors/ws';

	try {
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('Connected to Android sensor stream');
			reconnectAttempts = 0;
			androidSensorData.update(data => ({
				...data,
				connected: true
			}));
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				const sensorType = data.type;

				androidSensorData.update(state => {
					const newState = { ...state };

					if (sensorType === 'gps') {
						newState.gps = data;
					} else if (sensorType === 'accelerometer') {
						newState.accelerometer = data;
					} else if (sensorType === 'gyroscope') {
						newState.gyroscope = data;
					} else if (sensorType === 'compass') {
						newState.compass = data;
					} else if (sensorType === 'status') {
						newState.connected = data.connected;
						newState.lastUpdate = data.last_update;
					} else if (sensorType === 'ping') {
						// Keepalive ping, ignore
						return state;
					}

					newState.lastUpdate = new Date().toISOString();
					return newState;
				});
			} catch (error) {
				console.error('Error parsing Android sensor message:', error);
			}
		};

		ws.onerror = (error) => {
			console.error('Android sensor WebSocket error:', error);
		};

		ws.onclose = () => {
			console.log('Android sensor WebSocket closed');
			androidSensorData.update(data => ({
				...data,
				connected: false
			}));

			// Attempt reconnection
			if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
				reconnectAttempts++;
				console.log(`Reconnecting to Android sensors (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
				setTimeout(() => {
					connectToAndroidSensors(baseUrl);
				}, RECONNECT_DELAY);
			} else {
				console.error('Max reconnection attempts reached for Android sensors');
			}
		};
	} catch (error) {
		console.error('Failed to create Android sensor WebSocket:', error);
		androidSensorData.update(data => ({
			...data,
			connected: false
		}));
	}
}

/**
 * Disconnect from Android sensor WebSocket stream
 */
export function disconnectFromAndroidSensors() {
	if (ws) {
		reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
		ws.close();
		ws = null;
	}

	androidSensorData.set({
		gps: null,
		accelerometer: null,
		gyroscope: null,
		compass: null,
		connected: false,
		lastUpdate: null
	});
}

/**
 * Reset reconnection attempts (useful after manual reconnect)
 */
export function resetReconnectionAttempts() {
	reconnectAttempts = 0;
}
