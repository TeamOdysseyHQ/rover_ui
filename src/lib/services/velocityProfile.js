const EPSILON = 1e-10;
export const PROFILE_DEFAULTS = Object.freeze({ linearAcceleration: 0.20, linearJerk: 0.40, angularAcceleration: 0.40, angularJerk: 0.80 });

/** Velocity is integrated from acceleration; each phase has bounded constant jerk. */
class AxisProfile {
    constructor(accelerationLimit, jerkLimit) {
        this.accelerationLimit = accelerationLimit;
        this.jerkLimit = jerkLimit;
        this.reset();
    }
    reset(velocity = 0) {
        this.velocity = this.target = velocity;
        this.acceleration = 0;
        this.phases = [];
    }
    setTarget(target) {
        if (target === this.target) return;
        this.target = target;
        const delta = target - this.velocity;
        const j = this.jerkLimit;
        // First account for the velocity change needed to bring current
        // acceleration to zero. Retargeting must preserve that acceleration.
        const stoppingDelta = this.acceleration * Math.abs(this.acceleration) / (2 * j);
        const direction = Math.sign(delta - stoppingDelta) || Math.sign(this.acceleration) || 1;
        const initial = direction * this.acceleration;
        const distance = direction * delta;
        const peak = Math.min(this.accelerationLimit, Math.sqrt(Math.max(0, j * distance + initial * initial / 2)));
        const hold = peak > EPSILON ? Math.max(0, (distance - (2 * peak * peak - initial * initial) / (2 * j)) / peak) : 0;
        this.phases = [
            { duration: Math.max(0, (peak - initial) / j), jerk: direction * j },
            { duration: hold, jerk: 0 },
            { duration: peak / j, jerk: -direction * j }
        ].filter(phase => phase.duration > EPSILON);
    }
    advance(seconds) {
        while (seconds > EPSILON && this.phases.length) {
            const phase = this.phases[0];
            const dt = Math.min(seconds, phase.duration);
            this.velocity += this.acceleration * dt + phase.jerk * dt * dt / 2;
            this.acceleration += phase.jerk * dt;
            phase.duration -= dt;
            seconds -= dt;
            if (phase.duration <= EPSILON) this.phases.shift();
        }
        if (!this.phases.length) { this.velocity = this.target; this.acceleration = 0; }
    }
    snapshot() { return { velocity: this.velocity, acceleration: this.acceleration, jerk: this.phases[0]?.jerk ?? 0 }; }
}

export class VelocityProfile {
    constructor(settings = PROFILE_DEFAULTS) { this.configure(settings); }
    configure(settings) {
        for (const key of Object.keys(PROFILE_DEFAULTS)) {
            if (!Number.isFinite(settings[key]) || settings[key] <= 0) throw new Error(`Invalid profile limit: ${key}`);
        }
        if (settings.linearAcceleration > 0.33) throw new Error('Linear acceleration cannot exceed 0.33 m/s²');
        this.settings = { ...settings };
        this.linear = new AxisProfile(settings.linearAcceleration, settings.linearJerk);
        this.angular = new AxisProfile(settings.angularAcceleration, settings.angularJerk);
    }
    setTarget({ linear, angular }) {
        if (![linear, angular].every(Number.isFinite)) throw new Error('Velocity targets must be finite');
        this.linear.setTarget(Math.max(-1, Math.min(1, linear)));
        this.angular.setTarget(Math.max(-1, Math.min(1, angular)));
    }
    advance(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Profile time must be nonnegative');
        this.linear.advance(seconds); this.angular.advance(seconds);
        return this.snapshot();
    }
    reset(target = { linear: 0, angular: 0 }) { this.linear.reset(target.linear); this.angular.reset(target.angular); }
    snapshot() {
        const linear = this.linear.snapshot(), angular = this.angular.snapshot();
        return { output: { linear: linear.velocity, angular: angular.velocity }, acceleration: { linear: linear.acceleration, angular: angular.acceleration }, jerk: { linear: linear.jerk, angular: angular.jerk } };
    }
}
