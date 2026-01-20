/**
 * ROS Bridge Store
 * Manages ROS connection state and provides reactive updates
 */

import { writable, derived } from 'svelte/store';
import * as roverApi from '$lib/services/roverApi';

// ROS connection status
export const rosStatus = writable({
    connected: false,
    url: '',
    subscribedTopics: [],
    publishedTopics: [],
    lastChecked: null
});

// Odometry data
export const odometryData = writable(null);

// Teensy topic data
export const teensyTopicData = writable(null);

// Derived store for connection status (simple boolean)
export const isRosConnected = derived(
    rosStatus,
    $rosStatus => $rosStatus.connected
);

/**
 * Check ROS connection status
 */
export async function checkRosStatus() {
    try {
        const response = await roverApi.getRosStatus();
        if (response.success) {
            rosStatus.update(current => ({
                connected: response.status.connected,
                url: response.status.url,
                subscribedTopics: response.status.subscribed_topics || [],
                publishedTopics: response.status.published_topics || [],
                lastChecked: new Date()
            }));
            return response.status.connected;
        }
        return false;
    } catch (error) {
        console.error('Failed to check ROS status:', error);
        rosStatus.update(current => ({
            ...current,
            connected: false,
            lastChecked: new Date()
        }));
        return false;
    }
}

/**
 * Connect to ROS manually
 */
export async function connectToRos() {
    try {
        const response = await roverApi.connectToRos();
        if (response.success) {
            await checkRosStatus();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to connect to ROS:', error);
        return false;
    }
}

/**
 * Disconnect from ROS
 */
export async function disconnectFromRos() {
    try {
        const response = await roverApi.disconnectFromRos();
        if (response.success) {
            await checkRosStatus();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to disconnect from ROS:', error);
        return false;
    }
}

/**
 * Publish velocity command
 */
export async function publishCmdVel(linear_x = 0, angular_z = 0) {
    try {
        const response = await roverApi.publishCmdVel({
            linear_x,
            linear_y: 0,
            linear_z: 0,
            angular_x: 0,
            angular_y: 0,
            angular_z
        });
        return response.success;
    } catch (error) {
        console.error('Failed to publish cmd_vel:', error);
        return false;
    }
}

/**
 * Stop rover immediately
 */
export async function stopRover() {
    try {
        const response = await roverApi.stopRover();
        return response.success;
    } catch (error) {
        console.error('Failed to stop rover:', error);
        return false;
    }
}

/**
 * Subscribe to odometry and start polling
 */
export async function startOdometryUpdates(intervalMs = 500) {
    try {
        // Subscribe first
        await roverApi.subscribeToOdometry();
        
        // Poll for updates
        const interval = setInterval(async () => {
            try {
                const response = await roverApi.getOdometry();
                if (response.success && response.data) {
                    odometryData.set(response.data);
                }
            } catch (error) {
                console.error('Failed to get odometry:', error);
            }
        }, intervalMs);
        
        return interval;
    } catch (error) {
        console.error('Failed to start odometry updates:', error);
        return null;
    }
}

/**
 * Stop odometry updates
 */
export function stopOdometryUpdates(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

/**
 * Start polling teensy topic data
 * Note: The endpoint automatically subscribes on first call
 */
export async function startTeensyTopicUpdates(intervalMs = 500) {
    try {
        // Poll for updates (endpoint handles subscription automatically)
        const interval = setInterval(async () => {
            try {
                const response = await roverApi.getTeensyTopic();
                if (response.success && response.data !== undefined) {
                    teensyTopicData.set(response.data);
                }
            } catch (error) {
                console.error('Failed to get teensy topic data:', error);
            }
        }, intervalMs);
        
        return interval;
    } catch (error) {
        console.error('Failed to start teensy topic updates:', error);
        return null;
    }
}

/**
 * Stop teensy topic updates
 */
export function stopTeensyTopicUpdates(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

// Auto-check ROS status on module load
if (typeof window !== 'undefined') {
    checkRosStatus();
}
