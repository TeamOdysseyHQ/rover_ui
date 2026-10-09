import { json } from '@sveltejs/kit';
import { getNetworkReport } from '$lib/server/networkProbe.js';

// Fixed, read-only targets: this route cannot be used to scan arbitrary hosts.
export async function GET() {
    return json(await getNetworkReport(), { headers: { 'Cache-Control': 'no-store' } });
}
