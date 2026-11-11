/** One USB phone supplies targets to the existing dashboard profile. */
export class PhoneControl {
    constructor({ request, halt, resetInputs, snapshot, onActive = () => {}, url = 'ws://127.0.0.1:8910/dashboard', createSocket = address => new WebSocket(address) }) {
        this.request = request; this.halt = halt; this.resetInputs = resetInputs; this.snapshot = snapshot; this.onActive = onActive;
        this.url = url; this.createSocket = createSocket; this.active = false; this.blocked = true; this.socket = null; this.stopped = false; this.timer = null;
    }
    send(value) { if (this.socket?.readyState === 1 && this.socket.bufferedAmount < 8192) this.socket.send(JSON.stringify(value)); }
    setActive(value) { if (this.active !== value) { this.active = value; this.onActive(value); } }
    suspend() { this.blocked = true; this.setActive(false); this.send({ type: 'reset' }); }
    lost(reason) { const active = this.active; this.blocked = true; this.setActive(false); if (active) this.halt(reason); }
    connect() {
        if (this.stopped) return;
        const socket = this.createSocket(this.url); this.socket = socket;
        socket.onmessage = event => {
            let data; try { data = JSON.parse(event.data); } catch { this.lost('Invalid phone input'); socket.close(); return; }
            if (!data || typeof data !== 'object' || Array.isArray(data)) { this.lost('Invalid phone input'); socket.close(); return; }
            if (data.type === 'gone') { this.lost(data.reason); return; }
            if (data.type === 'phone') { this.blocked = true; return; }
            if (data.type === 'probe') { this.send({ type: 'applied', seq: data.seq }); return; }
            if (data.type !== 'input') return;
            if (![data.linear, data.angular].every(v => Number.isFinite(v) && Math.abs(v) <= 1) || typeof data.held !== 'boolean' || typeof data.locked !== 'boolean') { this.lost('Invalid joystick input'); return; }
            const wantsControl = data.held || data.locked;
            if (!wantsControl && (data.linear !== 0 || data.angular !== 0)) { this.lost('Invalid joystick release'); return; }
            const idle = !wantsControl && data.linear === 0 && data.angular === 0;
            if (idle) {
                this.blocked = false;
                if (this.active) { this.request({ linear: 0, angular: 0 }); this.setActive(false); }
            } else if (!this.blocked && wantsControl && !this.snapshot().latched) {
                if (!this.active) this.resetInputs();
                this.setActive(true);
                if (!this.request({ linear: data.linear, angular: data.angular })) this.suspend();
            }
            this.send({ type: 'applied', seq: data.seq });
        };
        socket.onclose = () => { if (this.socket === socket) { this.socket = null; this.lost('Phone bridge disconnected'); if (!this.stopped) this.retry = setTimeout(() => this.connect(), 1500); } };
        socket.onerror = () => socket.close();
    }
    start() {
        this.stopped = false; this.connect();
        this.timer = setInterval(() => {
            const state = this.snapshot();
            if (state.latched && this.active) this.suspend();
            this.send({ type: 'status', linear: state.output.linear, angular: state.output.angular, latched: state.latched, ready: state.connected || state.preview });
        }, 50);
    }
    close() { this.stopped = true; clearTimeout(this.retry); clearInterval(this.timer); this.lost('Phone controls closed'); this.socket?.close(); }
}
