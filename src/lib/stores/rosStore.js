import { writable, derived } from 'svelte/store';

// ROS connection status
export const rosStatus = writable('disconnected'); // 'connected' | 'disconnected' | 'connecting'
export const isRosConnected = derived(rosStatus, $status => $status === 'connected');

// Teensy topic data
export const teensyTopicData = writable(null);

// Check ROS status
export async function checkRosStatus() {
	try {
		// Implement your ROS status check here
		// For now, return a mock response
		return { connected: false };
	} catch (error) {
		console.error('Error checking ROS status:', error);
		return { connected: false };
	}
}

// Connect to ROS
export async function connectToRos(rosUrl) {
	try {
		rosStatus.set('connecting');
		// Implement your ROS connection logic here
		// For now, simulate connection
		await new Promise(resolve => setTimeout(resolve, 1000));
		rosStatus.set('connected');
		return { success: true };
	} catch (error) {
		rosStatus.set('disconnected');
		return { success: false, error: error.message };
	}
}

// Disconnect from ROS
export function disconnectFromRos() {
	rosStatus.set('disconnected');
}

// Stop the rover
export async function stopRover() {
	try {
		// Implement your stop rover logic here
		// Publish zero velocity to /cmd_vel
		await publishCmdVel(0, 0);
		return true;
	} catch (error) {
		console.error('Error stopping rover:', error);
		return false;
	}
}

// Publish command velocity to ROS
export function publishCmdVel(linearX, angularZ) {
	// Implement your ROS cmd_vel publishing logic here
	console.log('Publishing cmd_vel:', { linear: { x: linearX }, angular: { z: angularZ } });
	return Promise.resolve();
}

// Start teensy topic updates
export async function startTeensyTopicUpdates(rate) {
	const intervalId = setInterval(() => {
		// Mock teensy data - replace with actual ROS topic subscription
		teensyTopicData.set({
			data: Math.floor(Math.random() * 100)
		});
	}, rate);
	
	return intervalId;
}

// Stop teensy topic updates
export function stopTeensyTopicUpdates(intervalId) {
	clearInterval(intervalId);
	teensyTopicData.set(null);
}
