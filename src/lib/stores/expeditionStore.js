/**
 * Expedition Store
 *
 * Manages expedition tracking state, captured images, and expedition lifecycle.
 * Uses localStorage to persist expedition data across page refreshes.
 */

import { writable, derived, get } from 'svelte/store';

const STORAGE_KEY = 'rover_expedition_state';

// Load initial state from localStorage
function loadFromStorage() {
	if (typeof window === 'undefined') return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;

		const data = JSON.parse(stored);
		// Convert ISO string back to Date
		if (data.startTime) {
			data.startTime = new Date(data.startTime);
		}
		return data;
	} catch (error) {
		console.error('[ExpeditionStore] Failed to load from localStorage:', error);
		return null;
	}
}

// Save state to localStorage
function saveToStorage(state) {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error('[ExpeditionStore] Failed to save to localStorage:', error);
	}
}

// Initial state
const initialState = loadFromStorage() || {
	currentExpeditionId: null,
	isActive: false,
	startTime: null,
	capturedImages: [],
	isLoading: false,
	error: null
};

// Create the store
const { subscribe, set, update } = writable(initialState);

// Custom store with methods
export const expeditionStore = {
	subscribe,

	/**
	 * Start a new expedition with the given ID
	 */
	startExpedition: (expeditionId) => {
		update((state) => {
			const newState = {
				...state,
				currentExpeditionId: expeditionId,
				isActive: true,
				startTime: new Date(),
				capturedImages: [],
				error: null
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * End the current expedition
	 */
	endExpedition: () => {
		update((state) => {
			const newState = {
				...state,
				currentExpeditionId: null,
				isActive: false,
				startTime: null,
				capturedImages: [],
				error: null
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Add a captured image to the current expedition
	 * @param {Object} imageData - Image data object
	 * @param {string} imageData.filename - Image filename
	 * @param {string} imageData.camera_name - Camera that captured the image
	 * @param {string} imageData.timestamp - ISO timestamp
	 * @param {string} imageData.expedition_id - Expedition ID
	 * @param {number} imageData.file_size_mb - File size in MB
	 * @param {string} [imageData.note] - Optional note explaining why this was captured
	 * @param {Object} [imageData.gps_coords] - Optional GPS coordinates
	 */
	addCapturedImage: (imageData) => {
		update((state) => {
			if (!state.isActive) {
				console.warn('[ExpeditionStore] Cannot add image: No active expedition');
				return state;
			}

			const newState = {
				...state,
				capturedImages: [...state.capturedImages, imageData]
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Update the note for a specific captured image
	 * @param {string} filename - Image filename to update
	 * @param {string} note - New note text
	 */
	updateImageNote: (filename, note) => {
		update((state) => {
			const newImages = state.capturedImages.map((img) =>
				img.filename === filename ? { ...img, note } : img
			);

			const newState = {
				...state,
				capturedImages: newImages
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Set loading state
	 */
	setLoading: (isLoading) => {
		update((state) => ({
			...state,
			isLoading
		}));
	},

	/**
	 * Set error state
	 */
	setError: (error) => {
		update((state) => ({
			...state,
			error
		}));
	},

	/**
	 * Clear expedition data (hard reset)
	 */
	clearExpedition: () => {
		const newState = {
			currentExpeditionId: null,
			isActive: false,
			startTime: null,
			capturedImages: [],
			isLoading: false,
			error: null
		};
		set(newState);
		saveToStorage(newState);
	},

	/**
	 * Get current state (non-reactive)
	 */
	getState: () => {
		return get({ subscribe });
	}
};

// Derived stores for convenient access
export const currentExpeditionId = derived(expeditionStore, ($store) => $store.currentExpeditionId);

export const isExpeditionActive = derived(expeditionStore, ($store) => $store.isActive);

export const expeditionImages = derived(expeditionStore, ($store) => $store.capturedImages);

export const expeditionImageCount = derived(expeditionStore, ($store) => $store.capturedImages.length);

export const expeditionStartTime = derived(expeditionStore, ($store) => $store.startTime);

export const expeditionError = derived(expeditionStore, ($store) => $store.error);

/**
 * Helper function to generate auto-caption for an image
 */
export function generateAutoCaption(image) {
	const time = new Date(image.timestamp).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});

	return `Captured by ${image.camera_name} camera at ${time}`;
}

/**
 * Generate image_captions object for report generation
 */
export function generateImageCaptions(images) {
	const captions = {};

	for (const image of images) {
		captions[image.filename] = generateAutoCaption(image);
	}

	return captions;
}

/**
 * Generate object_notes object for navigation reconnaissance reports
 * Uses the user-provided notes instead of auto-generated captions
 */
export function generateObjectNotes(images) {
	const notes = {};

	for (const image of images) {
		// Use the note field if available, otherwise use auto-caption
		notes[image.filename] = image.note || generateAutoCaption(image);
	}

	return notes;
}
