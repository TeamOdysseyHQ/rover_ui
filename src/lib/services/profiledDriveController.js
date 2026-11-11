import { VelocityProfile, PROFILE_DEFAULTS } from './velocityProfile.js';
import { DriveCommandQueue } from './driveCommandQueue.js';
const zero = () => ({ linear: 0, angular: 0 });
const moving = value => Math.abs(value.linear) > 1e-9 || Math.abs(value.angular) > 1e-9;

/** Local command shaping and transport ownership. No timers or hardware access. */
export class ProfiledDriveController {
    constructor({ send, stop, onChange = () => {} }) {
        this.send = send; this.stop = stop; this.onChange = onChange;
        this.profile = new VelocityProfile(); this.enabled = true; this.preview = true;
        this.connected = false; this.url = ''; this.epoch = 0; this.target = zero();
        this.lastTick = null; this.lastPublish = -Infinity; this.lastSent = null; this.lastAccepted = null;
        this.latched = false; this.error = ''; this.stopping = false; this.inflight = null;
        this.queue = new DriveCommandQueue(async command => {
            if (command.epoch !== this.epoch || this.preview || !this.connected) return;
            const controller = new AbortController(); this.inflight = controller;
            this.lastSent = { linear: command.linear, angular: command.angular }; this.emit();
            try {
                await this.send({ ...command, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1000)]) });
                if (command.epoch === this.epoch) this.lastAccepted = { linear: command.linear, angular: command.angular };
            } catch (error) {
                if (command.epoch === this.epoch && !controller.signal.aborted) throw error;
            } finally { if (this.inflight === controller) this.inflight = null; this.emit(); }
        }, error => { void this.halt(error instanceof Error ? error.message : String(error)); });
    }
    snapshot() {
        const profile = this.profile.snapshot();
        return { ...profile, target: { ...this.target }, enabled: this.enabled, preview: this.preview,
            connected: this.connected, latched: this.latched, error: this.error, stopping: this.stopping,
            lastSent: this.lastSent, lastAccepted: this.lastAccepted, settings: { ...this.profile.settings },
            atRest: !moving(this.target) && !moving(profile.output) && !moving(profile.acceleration) };
    }
    emit() { this.onChange(this.snapshot()); }
    setConnection(connected, url) {
        if (connected === this.connected && url === this.url) return;
        if (!this.preview && this.connected && (!connected || url !== this.url)) void this.halt('Connection changed.');
        if (!connected && !this.preview) {
            this.preview = true;
            this.lastSent = this.lastAccepted = null;
        }
        if (connected && this.preview) {
            this.queue.clear(); this.profile.reset(); this.target = zero();
            this.preview = false; this.lastTick = null;
            this.lastSent = this.lastAccepted = null;
        }
        this.connected = connected; this.url = url; this.emit();
    }
    setPreview(preview) {
        if (!this.snapshot().atRest || this.stopping || this.inflight) return false;
        this.epoch++; this.queue.clear(); this.profile.reset(); this.target = zero();
        this.preview = preview; this.lastSent = this.lastAccepted = null; this.emit(); return true;
    }
    setEnabled(enabled) {
        if (!this.snapshot().atRest || this.stopping) return false;
        this.enabled = enabled; this.profile.reset(); this.emit(); return true;
    }
    configure(settings) {
        if (!this.snapshot().atRest || this.stopping) return false;
        this.profile.configure({ ...PROFILE_DEFAULTS, ...settings }); this.emit(); return true;
    }
    request(target) {
        if (this.latched || this.stopping || (!this.preview && !this.connected)) return false;
        if (![target.linear, target.angular].every(Number.isFinite)) return false;
        this.target = { linear: Math.max(-1, Math.min(1, target.linear)), angular: Math.max(-1, Math.min(1, target.angular)) };
        if (this.enabled) this.profile.setTarget(this.target);
        else { this.profile.reset(this.target); this.publish(); }
        this.emit(); return true;
    }
    publish() {
        if (this.preview || !this.connected) return;
        const output = this.profile.snapshot().output;
        void this.queue.submit({ ...output, url: this.url, epoch: this.epoch });
    }
    tick(now) {
        if (this.lastTick === null) { this.lastTick = now; return; }
        const elapsed = now - this.lastTick; this.lastTick = now;
        if (elapsed < 0 || elapsed > 250) {
            if (!this.snapshot().atRest) void this.halt('Control timing paused.');
            return;
        }
        const wasMoving = !this.snapshot().atRest;
        if (this.enabled && !this.latched) this.profile.advance(elapsed / 1000);
        if (!this.latched && (wasMoving || moving(this.target)) && (now - this.lastPublish >= 100 || this.snapshot().atRest)) {
            this.lastPublish = now; this.publish();
        }
        this.emit();
    }
    async halt(reason = 'Emergency stop') {
        const url = this.url, shouldSend = this.connected && !this.preview;
        const hadInflight = !!this.inflight;
        this.epoch++; const epoch = this.epoch;
        this.queue.clear(); this.inflight?.abort(); this.target = zero(); this.profile.reset();
        this.latched = true; this.error = reason; this.stopping = shouldSend;
        this.emit();
        // The stop endpoint is called immediately, outside the movement queue.
        // A zero barrier also follows an aborted in-flight command.
        if (hadInflight && shouldSend) this.publish();
        if (!shouldSend) return;
        this.lastSent = zero(); this.emit();
        try { await this.stop({ url, signal: AbortSignal.timeout(1000) }); if (epoch === this.epoch) this.lastAccepted = zero(); }
        catch (error) { if (epoch === this.epoch) this.error = `Stop unconfirmed: ${error instanceof Error ? error.message : String(error)}`; }
        finally { if (epoch === this.epoch) { this.stopping = false; this.emit(); } }
    }
    rearm() {
        if (this.stopping || this.inflight || this.queue.running || (!this.connected && !this.preview)) return false;
        this.latched = false; this.error = ''; this.lastTick = null; this.emit(); return true;
    }
}
