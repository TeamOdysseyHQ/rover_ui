import { writable, derived } from 'svelte/store';
import * as api from '$lib/services/roverApi.js';

// ARM telemetry data
export const armTelemetry = writable(null);

// ARM connection/subscription status
export const armSubscribed = writable(false);

// Loading states
export const armLoading = writable(false);

// Derived stores
export const armConnected = derived(armTelemetry, ($telemetry) => $telemetry !== null);

/**
 * Subscribe to ARM telemetry
 */
export async function subscribeToArm() {
	try {
		armLoading.set(true);
		const response = await api.subscribeToArmTelemetry();
		if (response.success) {
			armSubscribed.set(true);
			return { success: true };
		}
		return { success: false, error: response.message || 'Failed to subscribe' };
	} catch (error) {
		console.error('Error subscribing to ARM telemetry:', error);
		return { success: false, error: error.message };
	} finally {
		armLoading.set(false);
	}
}

/**
 * Get latest ARM telemetry
 */
export async function fetchArmTelemetry() {
	try {
		const response = await api.getArmTelemetry();
		if (response.success && response.data) {
			armTelemetry.set(response.data);
			return response.data;
		}
		return null;
	} catch (error) {
		console.error('Error fetching ARM telemetry:', error);
		return null;
	}
}

/**
 * Start polling ARM telemetry at regular intervals
 */
export function startArmTelemetryPolling(intervalMs = 200) {
	const intervalId = setInterval(async () => {
		await fetchArmTelemetry();
	}, intervalMs);
	
	return intervalId;
}

/**
 * Stop polling ARM telemetry
 */
export function stopArmTelemetryPolling(intervalId) {
	if (intervalId) {
		clearInterval(intervalId);
	}
	armTelemetry.set(null);
	armSubscribed.set(false);
}

/**
 * Drop payload
 */
export async function dropPayload() {
	try {
		armLoading.set(true);
		const response = await api.dropPayload();
		return response;
	} catch (error) {
		console.error('Error dropping payload:', error);
		throw error;
	} finally {
		armLoading.set(false);
	}
}

/**
 * Emergency stop ARM
 */
export async function stopArm() {
	try {
		armLoading.set(true);
		const response = await api.stopArm();
		return response;
	} catch (error) {
		console.error('Error stopping ARM:', error);
		throw error;
	} finally {
		armLoading.set(false);
	}
}

/**
 * Send target angles to ARM
 */
export async function sendArmTarget(angles) {
	try {
		armLoading.set(true);
		const response = await api.sendArmTarget(angles);
		return response;
	} catch (error) {
		console.error('Error sending ARM target:', error);
		throw error;
	} finally {
		armLoading.set(false);
	}
}

/**
 * Send raw command to ARM
 */
export async function sendArmCommand(command) {
	try {
		armLoading.set(true);
		const response = await api.sendArmCommand(command);
		return response;
	} catch (error) {
		console.error('Error sending ARM command:', error);
		throw error;
	} finally {
		armLoading.set(false);
	}
}
