import { get } from 'svelte/store';
import { apiStatus, roverApiUrl, testConnection } from '../stores/apiStore.js';
import { checkRosStatus, connectToRos } from '../stores/rosStore.js';

export async function connectRover(url) {
    const target = url.trim().replace(/\/+$/, '');
    if (get(apiStatus) !== 'connected' || get(roverApiUrl) !== target) {
        if (!await testConnection(target)) return false;
    }
    if ((await checkRosStatus()).connected) return true;
    if (!(await connectToRos()).success) return false;
    return (await checkRosStatus()).connected;
}
