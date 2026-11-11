package org.skanda.roverjoystick;

/** Joystick targets only. The workstation owns velocity profiling. */
public final class JoystickState {
    public double linear, angular, x, y;
    public boolean held, locked;
    public void move(double x, double y) {
        if (locked) return;
        held = true;
        double length = Math.hypot(x, y);
        this.x = x / Math.max(1, length);
        this.y = y / Math.max(1, length);
        double amount = Math.min(1, Math.max(0, (length - .05) / .95));
        linear = length > 0 ? -y / length * amount : 0;
        angular = length > 0 ? -x / length * amount : 0;
    }
    public void release() { held = false; if (!locked) linear = angular = x = y = 0; }
    public void toggleLock() {
        if (locked) reset();
        else if (held && Math.hypot(linear, angular) > 0) locked = true;
    }
    public void reset() { linear = angular = x = y = 0; held = locked = false; }
}
