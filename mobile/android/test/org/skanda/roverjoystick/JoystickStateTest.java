package org.skanda.roverjoystick;
public final class JoystickStateTest {
    public static void main(String[] args) {
        JoystickState state = new JoystickState();
        state.move(0, -1); assert state.linear == 1 && state.angular == 0;
        assert state.x == 0 && state.y == -1;
        state.toggleLock(); state.release(); assert state.locked && state.linear == 1;
        state.move(1, 0); assert state.linear == 1 && state.angular == 0;
        assert state.x == 0 && state.y == -1;
        state.toggleLock(); assert !state.locked && state.linear == 0 && !state.held;
        state.move(-1, -1); assert Math.abs(Math.hypot(state.linear, state.angular)-1) < 1e-9;
        assert Math.abs(Math.hypot(state.x, state.y)-1) < 1e-9;
        assert state.linear > 0 && state.angular > 0;
        state.release(); assert state.linear == 0 && state.angular == 0;
        assert state.x == 0 && state.y == 0;
        state.move(.01, .01); assert state.linear == 0 && state.angular == 0;
        assert state.x == .01 && state.y == .01;
        state.reset(); state.toggleLock(); assert !state.locked;
        System.out.println("Joystick mapping, deadzone, release, lock, unlock and bounds pass.");
    }
}
