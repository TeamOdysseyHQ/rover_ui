import { writable } from 'svelte/store';

/** Whether the fullscreen camera HUD is visible */
export const isFullscreen = writable(false);

/** Selected layout ID (1 to 8) */
export const fullscreenLayout = writable(1);

/**
 * Array of slot configurations for the fullscreen camera view.
 * cameraType: 'hardware' | 'ros'
 * streamMode: 'mjpeg' | 'websocket' | 'webrtc'
 */
export const fullscreenSlots = writable([
	{
		id: 0,
		isConfigured: false,
		cameraType: 'hardware',
		cameraName: '',
		topicName: '/camera/camera/color/image_raw',
		streamMode: 'mjpeg',
		fps: 30,
		quality: 80
	}
]);
