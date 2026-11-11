import http from 'node:http';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const now = () => performance.now();
const stats = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : null;
    return { count: sorted.length, min: sorted[0] ?? null, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1) ?? null };
};

export async function createPhoneBridge({ httpPort = 8910, phonePort = 8911, allowedOrigin } = {}) {
    let phone = null, dashboard = null, lastPhone = 0, lastDashboard = 0, clock = null;
    let inputCount = 0, probeCount = 0;
    const pending = new Map(), samples = { uplink_estimate_ms: [], dashboard_ack_ms: [], phone_rtt_ms: [], dashboard_rtt_ms: [] };
    const record = (key, value) => { if (Number.isFinite(value)) { samples[key].push(value); if (samples[key].length > 5000) samples[key].shift(); } };
    const report = () => ({ phone: !!phone, dashboard: !!dashboard, inputCount, probeCount, clock, ...Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, stats(values)])) });
    const toPhone = value => { if (phone && phone.writableLength < 8192) phone.write(JSON.stringify(value) + '\n'); };
    const toDashboard = value => {
        if (dashboard?.readyState === WebSocket.OPEN && dashboard.bufferedAmount < 8192) dashboard.send(JSON.stringify(value));
    };
    const lostPhone = reason => {
        if (!phone) return;
        const previous = phone; phone = null; clock = null; pending.clear();
        previous.destroy(); toDashboard({ type: 'gone', reason });
    };
    const server = http.createServer((request, response) => {
        if (request.headers.origin) { response.writeHead(403).end(); return; }
        if (request.method === 'GET' && request.url === '/health') {
            response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(report()));
        } else if (request.method === 'POST' && request.url === '/benchmark' && phone) {
            for (const values of Object.values(samples)) values.length = 0;
            inputCount = probeCount = 0; toPhone({ type: 'benchmark', count: 500, interval_ms: 20 });
            response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"started":true,"count":500}');
        } else response.writeHead(404).end();
    });
    const ws = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
    server.on('upgrade', (request, socket, head) => {
        let originAllowed = false;
        try {
            const origin = new URL(request.headers.origin);
            originAllowed = allowedOrigin ? origin.origin === allowedOrigin : origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
        } catch { /* Non-browser test clients must supply an Origin too. */ }
        if (request.url !== '/dashboard' || !originAllowed || dashboard) { socket.destroy(); return; }
        ws.handleUpgrade(request, socket, head, client => ws.emit('connection', client));
    });
    ws.on('connection', client => {
        dashboard = client; lastDashboard = now();
        toDashboard({ type: 'phone', connected: !!phone });
        toPhone({ type: 'ready', ready: !!phone });
        client.on('message', raw => {
            let data;
            try { data = JSON.parse(raw.toString()); } catch { client.close(1007); return; }
            if (!data || typeof data !== 'object' || Array.isArray(data)) { client.close(1007); return; }
            lastDashboard = now();
            if (data.type === 'status' && [data.linear, data.angular].every(Number.isFinite) && typeof data.latched === 'boolean') {
                toPhone({ type: 'status', linear: data.linear, angular: data.angular, latched: data.latched, ready: data.ready === true });
            } else if (data.type === 'reset') toPhone({ type: 'reset' });
            else if (data.type === 'applied' && Number.isSafeInteger(data.seq)) {
                const sent = pending.get(data.seq); if (!sent) return;
                pending.delete(data.seq); record('dashboard_ack_ms', now() - sent.host_ms);
                toPhone({ type: 'applied', seq: data.seq, phone_ms: sent.phone_ms });
            }
        });
        client.on('close', () => { if (dashboard === client) { dashboard = null; pending.clear(); toPhone({ type: 'ready', ready: false }); toPhone({ type: 'reset' }); } });
        client.on('error', () => {});
    });
    const tcp = net.createServer(socket => {
        if (phone) { socket.destroy(); return; }
        phone = socket; clock = null; lastPhone = now(); socket.setNoDelay(true); socket.setEncoding('utf8');
        toDashboard({ type: 'phone', connected: true }); toPhone({ type: 'ready', ready: !!dashboard });
        let buffer = '', sequence = -1;
        socket.on('data', chunk => {
            if (phone !== socket) return;
            buffer += chunk;
            if (Buffer.byteLength(buffer) > 8192) { lostPhone('Phone message too large'); return; }
            let newline;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
                let data; try { data = JSON.parse(line); } catch { lostPhone('Invalid phone message'); return; }
                if (!data || typeof data !== 'object' || Array.isArray(data)) { lostPhone('Invalid phone message'); return; }
                const received = now(); lastPhone = received;
                if (data.type === 'clock') {
                    if ([data.offset_ms, data.rtt_ms].every(Number.isFinite) && data.rtt_ms >= 0 && data.rtt_ms < 1000) {
                        clock = { offset_ms: data.offset_ms, uncertainty_ms: data.rtt_ms / 2 };
                    }
                    continue;
                }
                if (data.type === 'sample') {
                    if (data.kind === 'transport') record('phone_rtt_ms', data.rtt_ms);
                    else if (data.kind === 'dashboard') record('dashboard_rtt_ms', data.rtt_ms);
                    continue;
                }
                if (!['input', 'probe'].includes(data.type) || !Number.isSafeInteger(data.seq) || data.seq <= sequence || !Number.isFinite(data.phone_ms)) { lostPhone('Invalid phone sequence'); return; }
                sequence = data.seq;
                if (data.type === 'input' && (![data.linear, data.angular].every(v => Number.isFinite(v) && Math.abs(v) <= 1) || typeof data.held !== 'boolean' || typeof data.locked !== 'boolean' || (!data.held && !data.locked && (data.linear !== 0 || data.angular !== 0)))) { lostPhone('Invalid joystick target'); return; }
                if (data.type === 'input') inputCount++; else probeCount++;
                if (clock) record('uplink_estimate_ms', received - (data.phone_ms + clock.offset_ms));
                toPhone({ type: 'ack', seq: data.seq, phone_ms: data.phone_ms, host_rx_ms: received, host_tx_ms: now() });
                if (dashboard) {
                    pending.set(data.seq, { host_ms: received, phone_ms: data.phone_ms });
                    while (pending.size > 128) pending.delete(pending.keys().next().value);
                    toDashboard({ ...data, host_ms: received });
                }
            }
        });
        socket.on('close', () => { if (phone === socket) lostPhone('Phone disconnected'); });
        socket.on('error', () => { if (phone === socket) lostPhone('Phone connection failed'); });
    });
    const watchdog = setInterval(() => {
        if (phone && now() - lastPhone > 400) lostPhone('Phone heartbeat lost');
        if (dashboard && now() - lastDashboard > 700) dashboard.terminate();
    }, 50);
    try {
        await Promise.all([
            new Promise((resolve, reject) => { server.once('error', reject); server.listen(httpPort, '127.0.0.1', resolve); }),
            new Promise((resolve, reject) => { tcp.once('error', reject); tcp.listen(phonePort, '127.0.0.1', resolve); })
        ]);
    } catch (error) { clearInterval(watchdog); server.close(); tcp.close(); ws.close(); throw error; }
    return { httpPort: server.address().port, phonePort: tcp.address().port, report, async close() {
        clearInterval(watchdog); phone?.destroy(); dashboard?.terminate();
        await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => tcp.close(resolve)), new Promise(resolve => ws.close(resolve))]);
    } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const bridge = await createPhoneBridge();
    console.log(`Phone bridge: dashboard ws://127.0.0.1:${bridge.httpPort}/dashboard; USB TCP ${bridge.phonePort}`);
    const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? join(homedir(), '.local/opt/android-sdk');
    const bundledAdb = join(sdk, 'platform-tools/adb');
    const adb = process.env.ADB ?? (existsSync(bundledAdb) ? bundledAdb : 'adb');
    const run = promisify(execFile);
    let stopped = false, recovery;
    async function restoreUsb() {
        try {
            const { stdout } = await run(adb, ['reverse', '--list'], { timeout: 2000 });
            const mapped = stdout.trim().split('\n').some(line => line.trim().split(/\s+/).at(-2) === 'tcp:8911');
            if (!mapped && !stopped) {
                await run(adb, ['reverse', 'tcp:8911', 'tcp:8911'], { timeout: 2000 });
                console.log('USB phone forwarding restored.');
            }
        } catch { /* Retry when a single authorized phone becomes available. */ }
        if (!stopped) recovery = setTimeout(restoreUsb, 2000);
    }
    void restoreUsb();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { stopped = true; clearTimeout(recovery); await bridge.close(); process.exit(0); });
}
