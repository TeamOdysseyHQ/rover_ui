import { createSocket } from 'node:dgram';
import { networkInterfaces } from 'node:os';

export const ROVER_API_URL = 'http://192.168.1.3:6767';
const ROVER_MAC = '6c3c8c0a6e17';

export function getRoverAddress(interfaces = networkInterfaces()) {
    const addresses = Object.values(interfaces).flat().filter(entry =>
        entry && !entry.internal && entry.family === 'IPv4' &&
        entry.netmask === '255.255.255.0' && entry.address.startsWith('192.168.1.')
    );
    if (addresses.length !== 1) return null;
    return addresses[0].address;
}

// Destination overrides are for local UDP tests. The HTTP route accepts no targets.
export function sendMagicPacket({ address, broadcast = '192.168.1.255', port = 9 }) {
    const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => Buffer.from(ROVER_MAC, 'hex'))]);
    return new Promise((resolve, reject) => {
        const socket = createSocket('udp4');
        let settled = false;
        const finish = error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch { /* Bind may have failed before opening. */ }
            error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => finish(new Error('Wake packet send timed out')), 2000);
        socket.on('error', finish);
        socket.bind(0, address, () => {
            try {
                socket.setBroadcast(true);
                let remaining = 3;
                for (let i = 0; i < 3; i++) {
                    socket.send(packet, port, broadcast, error => {
                        if (error) finish(error);
                        else if (--remaining === 0) finish();
                    });
                }
            } catch (error) { finish(error); }
        });
    });
}
