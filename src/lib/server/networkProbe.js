import { createConnection } from 'node:net';

export const TARGETS = [
    { id: 'radio20', host: '192.168.1.20', port: 80, label: 'Access point .20' },
    { id: 'radio21', host: '192.168.1.21', port: 80, label: 'Station .21' },
    { id: 'rover', host: '192.168.1.3', port: 22, label: 'Rover SSH' },
    { id: 'api', host: '192.168.1.3', port: 6767, label: 'Rover API listener' }
];

export function probeTcp(target, timeoutMs = 1200, connect = createConnection) {
    return new Promise(resolve => {
        const started = performance.now();
        let settled = false;
        let socket;
        const finish = (reachable, error = null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket?.destroy();
            resolve({ ...target, reachable, latencyMs: Math.round(performance.now() - started), error });
        };
        // Absolute deadline also bounds connection establishment.
        const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
        try {
            socket = connect({ host: target.host, port: target.port });
            socket.once('connect', () => finish(true));
            socket.once('error', error => finish(false, error.code || 'connection error'));
        } catch (error) { finish(false, error.code || 'connection error'); }
    });
}

let pending;
let lastReport;
export async function getNetworkReport() {
    if (lastReport && Date.now() - lastReport.checkedAt < 1000) return lastReport;
    if (!pending) {
        pending = Promise.all(TARGETS.map(target => probeTcp(target)))
            .then(probes => lastReport = { checkedAt: Date.now(), probes, vantage: 'UI server' })
            .finally(() => { pending = null; });
    }
    return pending;
}
