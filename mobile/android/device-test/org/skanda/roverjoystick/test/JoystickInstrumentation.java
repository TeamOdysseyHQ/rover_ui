package org.skanda.roverjoystick.test;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import java.lang.reflect.Field;

/** Actual view/lifecycle checks, invoked explicitly by adb am instrument. */
public final class JoystickInstrumentation extends Instrumentation {
    private Activity activity;
    private View pad;
    private Object state;
    private long down;
    private double number(String name) throws Exception { return state.getClass().getField(name).getDouble(state); }
    private boolean flag(String name) throws Exception { return state.getClass().getField(name).getBoolean(state); }
    private void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private void stage(String value) { Bundle b = new Bundle(); b.putString("stage", value); sendStatus(1, b); }
    private void event(int action, int[] ids, float[] x, float[] y) {
        MotionEvent.PointerProperties[] properties = new MotionEvent.PointerProperties[ids.length];
        MotionEvent.PointerCoords[] points = new MotionEvent.PointerCoords[ids.length];
        for (int i=0;i<ids.length;i++) { properties[i]=new MotionEvent.PointerProperties(); properties[i].id=ids[i]; properties[i].toolType=MotionEvent.TOOL_TYPE_FINGER; points[i]=new MotionEvent.PointerCoords(); points[i].x=x[i]; points[i].y=y[i]; points[i].pressure=1; points[i].size=1; }
        MotionEvent e = MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,ids.length,properties,points,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
        runOnMainSync(() -> pad.dispatchTouchEvent(e)); e.recycle();
    }
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN).setClassName("org.skanda.roverjoystick", "org.skanda.roverjoystick.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity = startActivitySync(intent); waitForIdleSync();
            Field field = activity.getClass().getDeclaredField("state"); field.setAccessible(true); state=field.get(activity);
            pad=((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
            for(int i=0;i<100 && !activity.hasWindowFocus();i++)Thread.sleep(50);
            check(activity.hasWindowFocus(),"Unlock the phone and leave Rover Joystick visible");
            Field ready = activity.getClass().getDeclaredField("ready"); ready.setAccessible(true);
            for(int i=0;i<100 && !ready.getBoolean(activity);i++)Thread.sleep(50);
            check(ready.getBoolean(activity),"Workstation/dashboard not ready");
            int stable=0,previousWidth=-1,previousHeight=-1;
            for(int i=0;i<100 && stable<5;i++) {
                waitForIdleSync();
                int width=pad.getWidth(),height=pad.getHeight();
                stable=width>height && height>0 && width==previousWidth && height==previousHeight ? stable+1 : 0;
                previousWidth=width;previousHeight=height;Thread.sleep(50);
            }
            float w=pad.getWidth(),h=pad.getHeight(); check(w>h,"Landscape orientation required");
            float cx=w*.72f,cy=h*.50f,r=Math.min(h*.44f,w*.26f),jx=cx,jy=cy-r*1.1f,lx=w*.25f,ly=h*.75f;
            down=SystemClock.uptimeMillis(); event(MotionEvent.ACTION_DOWN,new int[]{0},new float[]{jx},new float[]{jy});
            Thread.sleep(400); check(flag("held") && number("linear")>.7,"Joystick target mapping");
            check(Math.abs(number("x"))<1e-5 && Math.abs(number("y")+1)<1e-5,"Thumb must reach and clamp to the perimeter"); stage("held"); Thread.sleep(800);
            event(MotionEvent.ACTION_POINTER_DOWN | (1<<8),new int[]{0,1},new float[]{jx,lx},new float[]{jy,ly});
            check(flag("locked"),"Second-finger lock");
            event(MotionEvent.ACTION_POINTER_UP,new int[]{0,1},new float[]{jx,lx},new float[]{jy,ly});
            event(MotionEvent.ACTION_UP,new int[]{1},new float[]{lx},new float[]{ly});
            check(!flag("held") && flag("locked") && number("linear")>.7,"Locked target must survive release"); stage("locked");Thread.sleep(1500);
            down=SystemClock.uptimeMillis(); event(MotionEvent.ACTION_DOWN,new int[]{0},new float[]{lx},new float[]{ly});event(MotionEvent.ACTION_UP,new int[]{0},new float[]{lx},new float[]{ly});
            check(!flag("locked") && number("linear")==0,"Unlock must request zero");stage("unlocked");Thread.sleep(3000);
            result.putString("result","PASS: landscape, joystick mapping, two-finger lock, release holds target, unlock requests zero");
            finish(Activity.RESULT_OK,result);
        } catch(Throwable e) { result.putString("result","FAIL: "+e.toString()); finish(Activity.RESULT_CANCELED,result); }
    }
}
