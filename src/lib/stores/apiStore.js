import { writable, get } from "svelte/store";
import * as roverApi from "../services/roverApi.js";
import { pollEvery } from "../services/polling.js";

// API connection status
export const apiStatus = writable("disconnected"); // 'connected' | 'disconnected' | 'connecting' | 'error'
export const roverApiUrl = writable(roverApi.DEFAULT_API_URL);
export const apiHealth = writable({ lastChecked: null, latencyMs: null, error: null });

// Command history for logging
export const commandHistory = writable([]);

// Auto-connect on initialization
let autoConnectAttempted = false;
let connectionAttempt = 0;
let connectionController;

async function connect(url, automatic = false) {
    const attempt = ++connectionAttempt;
    connectionController?.abort();
    connectionController = new AbortController();
    const normalizedUrl = url.trim().replace(/\/+$/, "");
    apiStatus.set("connecting");
    apiHealth.set({ lastChecked: null, latencyMs: null, error: null });
    const started = performance.now();

    try {
        const response = await fetch(`${normalizedUrl}/api/status`, {
            method: "GET",
            cache: 'no-store',
            signal: AbortSignal.any([connectionController.signal, AbortSignal.timeout(automatic ? 3000 : 5000)]),
        });

        // A newer connection or a disconnect supersedes this response.
        if (attempt !== connectionAttempt) return false;

        if (response.ok) {
            const health = await response.json();
            if (attempt !== connectionAttempt) return false;
            if (health?.success !== true || health.status !== 'ok') throw new Error('Invalid API health response');
            // Configure requests BEFORE connected subscribers discover cameras
            // or poll ROS; the badge and the service must refer to the same host.
            roverApi.setApiBaseUrl(normalizedUrl);
            roverApiUrl.set(normalizedUrl);
            apiHealth.set({ lastChecked: Date.now(), latencyMs: Math.round(performance.now() - started), error: null });
            apiStatus.set("connected");
            return true;
        }
    } catch (error) {
        if (attempt !== connectionAttempt) return false;
        apiHealth.set({ lastChecked: Date.now(), latencyMs: null, error: error.message });
    }

    apiStatus.set(automatic ? "disconnected" : "error");
    return false;
}

// A manual attempt also supersedes the delayed startup auto-connect.
export function testConnection(url) {
    autoConnectAttempted = true;
    return connect(url);
}

// Auto-connect to default URL
export async function autoConnect() {
    if (autoConnectAttempted) return;
    autoConnectAttempted = true;

    const defaultUrl = roverApi.DEFAULT_API_URL;
    console.log("[API] Attempting auto-connect to", defaultUrl);

    const connected = await connect(defaultUrl, true);
    console.log(connected
        ? "[API] Auto-connected successfully"
        : "[API] Auto-connect did not connect; manual connection is available");
    return connected;
}

// Initialize auto-connect (call this on app startup)
if (typeof window !== "undefined") {
    // Delay auto-connect slightly to allow page to load
    setTimeout(() => {
        autoConnect();
    }, 500);
}

// Disconnect from rover
export function disconnectFromRover() {
    autoConnectAttempted = true;
    connectionAttempt++;
    connectionController?.abort();
    apiStatus.set("disconnected");
    apiHealth.set({ lastChecked: null, latencyMs: null, error: null });
}

// The component owns this monitor, so navigation tears down pending reads.
export function monitorConnection() {
    const attempt = connectionAttempt;
    const url = roverApi.getApiBaseUrl();
    let failures = 0;
    let first = true;
    return pollEvery(async signal => {
        if (first) {
            first = false;
            const health = get(apiHealth);
            if (health.lastChecked && !health.error && Date.now() - health.lastChecked < 1500) return;
        }
        const started = performance.now();
        try {
            const response = await fetch(`${url}/api/status`, {
                cache: 'no-store',
                signal: AbortSignal.any([signal, AbortSignal.timeout(2000)])
            });
            if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
            const status = await response.json();
            if (status?.success !== true || status.status !== 'ok') throw new Error('Invalid API health response');
            if (signal.aborted || attempt !== connectionAttempt) return;
            failures = 0;
            apiHealth.set({ lastChecked: Date.now(), latencyMs: Math.round(performance.now() - started), error: null });
        } catch (error) {
            if (signal.aborted || attempt !== connectionAttempt) return;
            apiHealth.set({ lastChecked: Date.now(), latencyMs: null, error: error.message });
            if (++failures >= 2) apiStatus.set('error');
        }
    }, 2000);
}

// Log a command to history
export function logCommand(command, status, response = null) {
    commandHistory.update((history) => {
        const newCommand = {
            id: crypto.randomUUID(),
            command,
            timestamp: Date.now(),
            status,
            response,
        };
        return [...history, newCommand].slice(-50); // Keep last 50 commands
    });
}
