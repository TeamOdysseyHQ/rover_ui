import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Development-only sink for optical-flow summaries from open dashboards, so a
// session can be analysed after the operator moves the camera.
const file = process.env.ROVER_FLOW_LOG ?? join(tmpdir(), 'rover-ui-flow-log.jsonl');

export async function POST({ request }) {
    if (!dev) error(404, 'Not found');
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body) || body.length > 500) error(400, 'Expected an array of flow samples');
    await appendFile(file, body.map(row => JSON.stringify(row)).join('\n') + '\n');
    return json({ ok: true, file });
}
