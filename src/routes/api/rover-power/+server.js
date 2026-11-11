import { json } from '@sveltejs/kit';
import { getRoverAddress, ROVER_API_URL, sendMagicPacket } from '$lib/server/wakeOnLan.js';

const headers = { 'Cache-Control': 'no-store' };

export async function GET({ request }) {
    let ready = false;
    try {
        const response = await fetch(`${ROVER_API_URL}/api/status`, {
            cache: 'no-store',
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(1500)])
        });
        if (response.ok) {
            const health = await response.json();
            ready = health?.success === true && health.status === 'ok';
        }
    } catch { /* An offline rover is an expected result. */ }
    return json({ ready, apiUrl: ROVER_API_URL }, { headers });
}

export async function POST({ request, url }) {
    if (request.headers.get('origin') !== url.origin) {
        return json({ message: 'Wake requests must come from this dashboard.' }, { status: 403, headers });
    }
    const address = getRoverAddress();
    if (!address) {
        return json({ message: 'Select the Rover antenna Ethernet connection on the dashboard computer, then try again. It needs a single 192.168.1.x/24 network connection.' }, { status: 503, headers });
    }
    try {
        await sendMagicPacket({ address });
        return json({ sent: true }, { headers });
    } catch {
        return json({ message: 'Could not send the wake packet. Check the rover Ethernet connection and try again.' }, { status: 503, headers });
    }
}
