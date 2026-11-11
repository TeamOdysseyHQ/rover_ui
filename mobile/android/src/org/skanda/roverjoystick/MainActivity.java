package org.skanda.roverjoystick;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class MainActivity extends Activity {
    private final JoystickState state = new JoystickState();
    private final Object wake = new Object();
    private final ConcurrentLinkedQueue<JSONObject> replies = new ConcurrentLinkedQueue<>();
    private volatile boolean running, ready, telemetry;
    private volatile int generation;
    private volatile Socket socket;
    private volatile Input input = new Input(0, 0, false, false, 0);
    private volatile int benchmarkRemaining;
    private long version, sequence;
    private double outputLinear, outputAngular;
    private Pad pad;
    private static double now() { return SystemClock.elapsedRealtimeNanos() / 1e6; }

    private static final class Input {
        final double linear, angular, eventTime;
        final boolean held, locked;
        final long version;
        Input(double linear, double angular, boolean held, boolean locked, long version) {
            this.linear = linear; this.angular = angular; this.held = held; this.locked = locked; this.version = version; eventTime = now();
        }
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        pad = new Pad(); setContentView(pad);
    }
    @Override public void onResume() { super.onResume(); running = true; final int session = ++generation; new Thread(() -> connectLoop(session), "usb-receiver").start(); }
    @Override public void onPause() {
        running = false; generation++; ready = telemetry = false; state.reset(); changed(); closeSocket();
        super.onPause();
    }
    private void changed() {
        input = new Input(state.linear, state.angular, state.held, state.locked, ++version);
        synchronized (wake) { wake.notifyAll(); }
        if (pad != null) pad.postInvalidateOnAnimation();
    }
    private void closeSocket() { Socket value = socket; if (value != null) try { value.close(); } catch (IOException ignored) {} }
    private void enqueue(JSONObject value) { if (replies.size() < 128) replies.add(value); synchronized (wake) { wake.notifyAll(); } }
    private void resetFromHost(boolean available) {
        runOnUiThread(() -> { ready = available; if (!available) telemetry = false; state.reset(); pad.pointer = -1; changed(); });
    }
    private void connectLoop(int session) {
        while (running && generation == session) {
            Socket current = new Socket();
            try {
                current.setTcpNoDelay(true); current.connect(new InetSocketAddress("127.0.0.1", 8911), 1500);
                if (!running || generation != session) { current.close(); return; }
                socket = current; replies.clear(); benchmarkRemaining = 0;
                resetFromHost(false);
                Thread writer = new Thread(() -> writeLoop(current), "usb-sender"); writer.start();
                BufferedReader reader = new BufferedReader(new InputStreamReader(current.getInputStream(), StandardCharsets.UTF_8));
                double bestRtt = Double.POSITIVE_INFINITY, windowStart = now();
                String line;
                while (running && generation == session && (line = reader.readLine()) != null) {
                    double received = now();
                    if (line.length() > 4096) throw new IOException("Oversized bridge response");
                    JSONObject value = new JSONObject(line);
                    String type = value.optString("type");
                    if (type.equals("ready")) resetFromHost(value.optBoolean("ready"));
                    else if (type.equals("reset")) resetFromHost(ready);
                    else if (type.equals("status")) {
                        boolean available = value.optBoolean("ready") && !value.optBoolean("latched");
                        double linear = value.optDouble("linear", 0), angular = value.optDouble("angular", 0);
                        runOnUiThread(() -> {
                            ready = available; telemetry = true; outputLinear = linear; outputAngular = angular;
                            if (!ready && (state.held || state.locked)) { state.reset(); pad.pointer = -1; changed(); }
                            pad.postInvalidateOnAnimation();
                        });
                    } else if (type.equals("benchmark")) {
                        benchmarkRemaining = Math.min(1000, value.optInt("count", 500));
                        synchronized (wake) { wake.notifyAll(); }
                    } else if (type.equals("ack")) {
                        double sent = value.getDouble("phone_ms"), rx = value.getDouble("host_rx_ms"), tx = value.getDouble("host_tx_ms");
                        double rtt = Math.max(0, received - sent - (tx - rx));
                        if (received - windowStart > 10000) { bestRtt = Double.POSITIVE_INFINITY; windowStart = received; }
                        if (rtt < bestRtt) {
                            bestRtt = rtt;
                            enqueue(new JSONObject().put("type", "clock").put("offset_ms", ((rx - sent) + (tx - received)) / 2).put("rtt_ms", rtt));
                        }
                        sample("transport", value.getLong("seq"), received - sent);
                    } else if (type.equals("applied")) sample("dashboard", value.getLong("seq"), received - value.getDouble("phone_ms"));
                }
            } catch (Exception ignored) {
                // Reconnect without preserving targets or a velocity lock.
            } finally {
                try { current.close(); } catch (IOException ignored) {}
                if (socket == current) socket = null;
                if (generation == session) resetFromHost(false);
            }
            if (running && generation == session) try { Thread.sleep(1000); } catch (InterruptedException ignored) { return; }
        }
    }
    private void sample(String kind, long seq, double rtt) throws Exception {
        JSONObject value = new JSONObject().put("type", "sample").put("kind", kind).put("seq", seq).put("rtt_ms", rtt);
        enqueue(value);
    }
    private void writeLoop(Socket current) {
        try {
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(current.getOutputStream(), StandardCharsets.UTF_8));
            long sentVersion = -1; double lastInput = -1e9, lastProbe = -1e9;
            while (running && socket == current && !current.isClosed()) {
                JSONObject reply; while ((reply = replies.poll()) != null) { writer.write(reply.toString()); writer.newLine(); }
                double time = now(); Input latest = input;
                if (latest.version != sentVersion || time - lastInput >= 50) {
                    JSONObject frame = new JSONObject().put("type", "input").put("seq", ++sequence).put("phone_ms", now()).put("event_ms", latest.eventTime)
                        .put("linear", latest.linear).put("angular", latest.angular).put("held", latest.held).put("locked", latest.locked);
                    writer.write(frame.toString()); writer.newLine(); lastInput = time; sentVersion = latest.version;
                }
                if (benchmarkRemaining > 0 && time - lastProbe >= 20) {
                    writer.write(new JSONObject().put("type", "probe").put("seq", ++sequence).put("phone_ms", now()).put("linear", 0).put("angular", 0).toString()); writer.newLine();
                    benchmarkRemaining--; lastProbe = time;
                }
                writer.flush();
                synchronized (wake) { if (input.version == sentVersion && replies.isEmpty()) wake.wait(benchmarkRemaining > 0 ? 10 : 25); }
            }
        } catch (Exception ignored) { try { current.close(); } catch (IOException ignoredClose) {} }
    }

    private final class Pad extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF lockBox = new RectF();
        private float cx, cy, radius;
        private int pointer = -1;
        Pad() { super(MainActivity.this); setBackgroundColor(Color.BLACK); setContentDescription("Rover joystick. Hold and drag to drive. Left button locks the current velocity target."); }
        private void text(Canvas c, String text, float x, float y, float size, int color) {
            paint.setStyle(Paint.Style.FILL); paint.setColor(color); paint.setTypeface(Typeface.MONOSPACE); paint.setTextAlign(Paint.Align.CENTER); paint.setTextSize(size); c.drawText(text, x, y, paint);
        }
        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            float w = getWidth(), h = getHeight();
            cx = w * .72f; cy = h * .50f; radius = Math.min(h * .44f, w * .26f);
            float number = Math.min(h * .105f, w * .055f), small = h * .035f;
            text(c, telemetry ? String.format(Locale.US, "%+.3f", outputLinear) : "—", w * .25f, h * .22f, number, Color.WHITE);
            text(c, "LINEAR  m/s", w * .25f, h * .295f, small, Color.LTGRAY);
            text(c, telemetry ? String.format(Locale.US, "%+.3f", outputAngular) : "—", w * .25f, h * .48f, number, Color.WHITE);
            text(c, "ANGULAR  rad/s", w * .25f, h * .555f, small, Color.LTGRAY);
            lockBox.set(w * .13f, h * .68f, w * .37f, h * .82f);
            paint.setStrokeWidth(Math.max(2, h * .003f)); paint.setColor(ready ? Color.WHITE : Color.DKGRAY);
            paint.setStyle(state.locked ? Paint.Style.FILL : Paint.Style.STROKE); c.drawRoundRect(lockBox, h * .025f, h * .025f, paint);
            text(c, state.locked ? "UNLOCK" : "LOCK", lockBox.centerX(), lockBox.centerY() + small * .35f, small, state.locked ? Color.BLACK : ready ? Color.WHITE : Color.DKGRAY);
            paint.setStyle(Paint.Style.STROKE); paint.setColor(ready ? Color.LTGRAY : Color.DKGRAY); c.drawCircle(cx, cy, radius, paint);
            paint.setColor(Color.DKGRAY); c.drawLine(cx-radius+12, cy, cx+radius-12, cy, paint); c.drawLine(cx, cy-radius+12, cx, cy+radius-12, paint);
            float thumb = Math.min(h * .28f, w * .22f) * .17f;
            float x = cx + (float)state.x * (radius - thumb), y = cy + (float)state.y * (radius - thumb);
            paint.setStyle(Paint.Style.FILL); paint.setColor(ready ? Color.WHITE : Color.DKGRAY); c.drawCircle(x, y, thumb, paint);
        }
        private void move(MotionEvent e, int index) {
            float travel = radius - Math.min(getHeight() * .28f, getWidth() * .22f) * .17f;
            state.move((e.getX(index)-cx)/travel, (e.getY(index)-cy)/travel); changed();
        }
        @Override public boolean onTouchEvent(MotionEvent e) {
            int action = e.getActionMasked(), index = e.getActionIndex(), id = e.getPointerId(index);
            if (!ready) return true;
            if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
                if (lockBox.contains(e.getX(index), e.getY(index))) { state.toggleLock(); if (!state.locked) pointer = -1; changed(); performClick(); }
                else if (pointer == -1 && !state.locked && Math.hypot(e.getX(index)-cx, e.getY(index)-cy) <= radius * 1.15) { pointer = id; move(e, index); }
            } else if (action == MotionEvent.ACTION_MOVE && pointer != -1) {
                int active = e.findPointerIndex(pointer); if (active >= 0 && !state.locked) move(e, active);
            } else if ((action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP) && id == pointer) { pointer = -1; state.release(); changed(); }
            else if (action == MotionEvent.ACTION_CANCEL) { pointer = -1; state.reset(); changed(); }
            return true;
        }
        @Override public boolean performClick() { super.performClick(); return true; }
    }
}
