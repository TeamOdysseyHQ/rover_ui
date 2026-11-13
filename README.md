# Rover UI

The dashboard receives H.264 over WebRTC UDP from RoverAPI_Endpoint. GStreamer
captures and encodes once per camera with x264 ultrafast. Kreo Owl defaults to
1280×720 at its advertised 60 FPS. MJPEG and JPEG-over-WebSocket playback modes
and automatic fallback to those transports have been removed.

## Run the dashboard

```sh
npm ci
npm run dev
```

With the saved **Rover antenna** Ethernet profile, open
`http://192.168.1.159:5173/`. On this workstation, Firefox selects Wi-Fi for
receive-only WebRTC when the page uses `localhost`. The Ethernet URL selects
the rover-facing interface while Wi-Fi continues to provide internet access.
This URL works with `npm run dev`; no global Firefox settings are required.

## Connect to the rover

Click **Connect** at the top right to connect the rover API and ROS bridge.
Use the chevron beside **Connect** to change the API URL or connect and disconnect
the API and ROS bridge separately. These controls stay collapsed until opened.

## Wake the onboard computer

Run the dashboard on the operator computer, which must have Ethernet access to
the rover network. Select the saved **Rover antenna** connection before opening
the dashboard. That profile uses `192.168.1.159/24`, no gateway or DNS, and no
default route, so Wi-Fi can continue to provide internet access.

Keep power supplied to the OptiPlex and both radios. Click **Power on** at the
top right of the dashboard. The dashboard sends a Wake-on-LAN broadcast for
the rover OptiPlex, waits up to two minutes for its API, and connects when ready.
A sent packet alone does not confirm that the computer has started.

Wake-on-LAN requires the dashboard's Node server on the rover LAN. A static page
or a dashboard server running on the switched-off OptiPlex cannot send the packet.
The wake control does not shut down or reboot a running computer.

## Driving controls

Driving uses ROS only, with WASD controls and an optional **Motion profile** switch. The switch
defaults to on. When enabled, a bounded-jerk S-curve shapes every requested
linear and angular target, including speed reductions and direction changes.
Acceleration changes continuously, so output may briefly keep rising when a
lower target arrives during acceleration, before it begins slowing down.
The dashboard shows requested target, profile output, last sent command,
and 12-second target/output plots. These are commands, not measured
rover velocities.

Open **Profile limits** at rest to adjust acceleration and jerk. Linear
acceleration and braking default to 0.20 m/s² and cannot exceed 0.33 m/s².
Linear jerk defaults to 0.40 m/s³. Angular acceleration defaults to 0.40 rad/s²
and angular jerk to 0.80 rad/s³. Targets retain the existing ±1 m/s and ±1 rad/s
ranges. Profile settings and preview switches are locked while moving.

**Stop normally** requests zero through the profile.
WASD changes targets by 0.05 per press, repeating every 150 ms while held;
key release holds the target. Tab requests a normal stop while moving and keeps
its normal focus-navigation behavior at rest or in editable fields.
**Emergency stop** or Space resets the command to zero and calls the stop endpoint immediately,
bypassing the profile and any pending movement request. Focus loss, a hidden
page, connection changes, and control timing stalls also stop and disarm motion.
Press Space again or use the same button, now **Resume controls**, to enable
driving again. Held Space never toggles repeatedly. Release held driving keys
before sending fresh input; resuming does not restore previous velocity.

Use **Offline preview** to inspect the controls, limits, and plots without sending
motion or stop commands. Ctrl+O toggles preview at rest. WASD works immediately
after toggling a checkbox; text and numeric inputs still block driving shortcuts.
Preview starts enabled and turns on automatically if the ROS driving connection
is lost. Connecting or reconnecting the API and ROS bridge turns preview off
automatically and clears simulated targets and held inputs. Fresh input is
required before driving. A lost live connection still stops and disarms the
controls; reconnecting preserves that stop latch until you resume controls.
The previous game mode and cruise lock have been removed.
This profile runs in the browser. Rover-side enforcement
and physical acceleration verification still require onboard integration and tests.

## USB phone joystick

`mobile/android` contains the native Android app **Rover Joystick**. Its landscape
screen has one joystick, a left-side lock button, and linear/angular command
readouts in black and white. Readouts follow the dashboard's profiled output,
including offline preview; they are not measured vehicle speed.

Hold the joystick to set the target. While holding it, tap **LOCK** with a second
finger to hold that target after release. **UNLOCK** requests zero through the
motion profile. Releasing an unlocked joystick also requests zero. The dashboard
continues to own profiling and ROS publishing, so the phone does not apply a
second velocity profile. WASD is disabled while the phone owns the target.
Desktop normal/emergency stops clear the phone lock. App backgrounding, USB loss,
and bridge/dashboard loss discard the old input; an active phone disconnect
stops and disarms driving. Reconnection requires neutral input before a fresh
gesture. Existing emergency-stop rearming still applies.

Build with JDK 17, Android SDK platform 35 and build-tools 35.0.0. Set
`ANDROID_SDK_ROOT` if the SDK is outside `~/.local/opt/android-sdk`.

```sh
npm run phone:build
adb install -r mobile/android/build/rover-joystick.apk
npm run phone:bridge
```

Keep that terminal running, start the dashboard normally in another terminal,
and open **Rover Joystick** on the authorized USB-debugging phone. The bridge
binds only to localhost: TCP 8911 for the phone and WebSocket 8910 for one local
dashboard. It never connects to the rover API itself. Preview remains enabled
until you explicitly select live control in the dashboard. Locking does not
survive app exit or reconnection. Stop the app before removing the USB reverse
mapping with `adb reverse --remove tcp:8911`.
Keep the dashboard visible. Hiding or suspending it disarms control.
The bridge restores USB forwarding automatically when a single authorized phone
connects. ADB must be available in the SDK above, on PATH, or via `ADB`.

Run `npm run phone:benchmark` with the app and dashboard connected to collect
500 timestamped, command-sized probes over USB. Probes cannot request motion.
The report is saved to ignored `.local/phone-latency-latest.json`. It contains
phone-to-computer estimated one-way latency, its clock uncertainty, measured
phone/computer round-trip latency, and phone/dashboard acknowledgment round-trip
latency. Clock mapping uses the lowest network RTT in rolling 10-second windows.
These measurements exclude touchscreen dispatch, the profile's intentional
delay, ROS publishing, and motor response. Do not call RTT/2 measured one-way
latency or interpret dashboard acknowledgment as motor execution.

The real-device gesture test is separate from the app. Run
`npm run phone:test-usb` with the phone unlocked. It builds and temporarily
installs the instrumentation helper, uses an isolated localhost bridge and the
production velocity profile with ROS publishing forbidden, and checks landscape
layout and actual two-pointer lock/release/unlock events. It restores the previous
ADB mapping and removes the helper afterward. Run `npm run phone:test-model` for input-model checks without Android.

## Camera streaming

Connect to the onboard API in the connection panel, then start Kreo Owl under
Camera control. The default API address is `http://192.168.1.3:6767`. Set
`VITE_ROVER_API_URL` before building or starting Vite to use another default.
Update the API and UI together. The API's README lists the native GStreamer
packages required on the rover.

Fullscreen pauses the background players and attaches to an already running
camera at its current capture mode. Exiting reconnects the normal player.
Closing a slot releases only its viewer, including an offer that finishes after
the slot closes. Stop the camera before changing a mode shared by other viewers.
Hidden tabs release their video peers and reconnect when visible. Fullscreen
allows one slot per camera or ROS topic. Cameras with no viewers pause capture
after about 10–15 seconds and resume when a viewer returns.
Microscope and ROS camera panels use the same H.264 player. ROS slots use their
configured topic, and disconnecting a ROS player releases only its own peer.

The player shows received FPS and bitrate. When timestamp callbacks are available,
it also estimates source-buffer-to-browser latency. Small clock probes and frame
metadata travel over an unordered WebRTC data channel. Exposure, camera-internal
buffering, and display scanout are outside this measurement. Clock estimates and
latency metrics do not control or delay video frames.

Optical flow is optional and remains off until enabled. OpenCV loading, resizing,
pixel readback, and tracking run in one shared Web Worker. Supported browsers
transfer a decoded `VideoFrame`; other supported browsers use an image bitmap.
Only one analysis frame can be in flight across all cameras, and samples are
capped at 15 FPS. Busy analysis drops samples instead of queuing old frames.
Hidden tabs release tracking references. Disabling the last diagnostic or leaving
its viewer terminates the worker and releases its runtime.

Track counts and motion measurements appear in the video overlay. This requires
Web Workers and OffscreenCanvas. Unsupported diagnostics report an error while
video playback continues. Optical flow does not correct rolling shutter or prove
that a video is free of geometric distortion.

A live Kreo comparison on 3 November 2026 measured a 119 ms main-thread long task
while the previous OpenCV implementation loaded and about 10 ms per tracking
sample. In matched 10-second development measurements, moving analysis and
readback to the worker reduced the UI timer's p95 scheduling delay from 10.1 ms
to 0.5 ms. The production bundle measured 1.4 ms with diagnostics active, with
about 0.1 ms p95 spent transferring a video frame. No main-thread long tasks
were observed during those worker runs, and active diagnostics retained about
60 FPS video delivery. These timings describe UI responsiveness.

Visible Chrome on this workstation needed `google-chrome --disable-gpu` to avoid
intermittent 1–2 second video/canvas stalls in its accelerated path. This is a
local browser workaround; it does not change system graphics settings. Three
720p60 fullscreen cycles then retained one viewer, stopped diagnostics while
fullscreen was open, and resumed tracking after exit. Rapid toggles and disabling
the last diagnostic also released the worker. A visible 30-second run with this
workaround delivered about 59.9 FPS with no dropped display frames. Active
diagnostics measured 0.8 ms p95 UI scheduling delay.

Run `npm test` and `npm run build` for local checks. On 3 November 2026, live
checks passed four fullscreen entry/exit cycles at 480p, five transitions during
pending offers, Kreo snapshots, and shared ROS test-image viewing. Each fullscreen
handoff retained one active viewer. The Kreo delivered about 60 FPS at 720p with
no reported RTP loss or decoded-frame drops.

A steady 30-second run measured 35.4 ms median and 37.5 ms p95
source-buffer-to-browser delay. After repeated view changes, a run measured
45.9 ms median and 77.6 ms p95. These clock-corrected estimates exclude exposure
and display scanout. The onboard API service now runs the new H.264 release;
its [camera setup and rollback notes](https://github.com/TeamOdysseyHQ/RoverAPI_Endpoint/blob/master/README.md#camera-video)
describe the deployment. Physical microscope and camera/IMU motion tests remain
unverified.

## Earlier camera diagnostics

The sections below record the earlier optical-flow work. References to old
transport choices and capture implementations describe those earlier revisions.


## Performance review follow-up (4 October 2026)

Optical-flow diagnostics are optional per camera and disabled by default. Enabling
**Optical-flow diagnostics** loads OpenCV on demand. Processing is capped at 15 FPS
and pauses in hidden tabs. The service has been simplified while retaining the same
LK, forward/backward, MAD and spatial measurement stages.

Camera status, ROS status, and RPM polling were serialized with request deadlines
and cancellation on teardown. Viewers released their connections without stopping
shared capture. The JPEG rendering and adaptive-quality paths from this revision
have since been removed.

## PR #2 review updates (4 October 2026)

The handoff below records the initial prototype. Review fixes now load OpenCV as a
local, lazy browser asset (the original generated-code import failed the production
build), share initialization across panel instances, and start cameras that connected
before initialization finished. Stop All, peer failure, mode changes and unmount
release trackers and cancel video callbacks. Native frame allocations are released
on processing errors as well as successful frames.

Reported `points` and the next LK reference contain only accepted tracks. Non-finite
forward/backward errors and out-of-frame tracks are rejected. FAST selects at most
240 strong corners away from the border to bound processing cost; grid selection
and minimum-distance feature distribution remain future work. Low-feature warnings
are no longer emitted on every detection attempt.

Band means are `null` / logged as `unavailable` when there are no accepted tracks;
`topPoints`, `middlePoints`, and `bottomPoints` identify coverage. `mediaTime` and
`deltaTime` are seconds from decoded-frame metadata; dx/dy remain pixels per frame
at 320×240. Repeated timestamps are skipped and timeline resets or gaps above 0.5 s
re-seed tracking. `fbRetention` now measures acceptance before MAD filtering, while
`trackingRetention` measures final acceptance.

Validation: `npm test` includes synthetic images processed by the actual OpenCV
runtime, filter and allocation-error regressions, and camera lifecycle tests.
`npm run build` must also pass. Real rover motion, feature distribution under blur,
IMU synchronization and rolling-shutter correction still require hardware validation.


## 1. Project context

This document is a handoff for the current work on **post-processing the rover camera feed to measure and eventually reduce rolling-shutter ("jello") distortion**.

The current work is being done in the `rover_ui` frontend. The camera feed itself is already delivered through WebRTC, and the optical-flow processing is performed on the **dashboard/client PC after the WebRTC frame has been decoded**.

### Hardware / environment

- Rover computer: Intel i7 OptiPlex running Linux
- Dashboard development/testing machine: Windows PC
- Camera currently being tested:
  - Logitech C270 rolling-shutter webcam
- Another RGB camera exists:
  - Kreo Owl
- IMU:
  - BNO055
- RealSense and LiDAR are **not part of the current implementation**
- Current measured Logitech C270 behavior:
  - ~1280×720: about 10 FPS
  - ~640×480: about 20 FPS
- WebRTC transport is already working.

## 2. Main goal

The long-term goal is to reduce visible rolling-shutter/jello distortion in rover camera footage **without changing the existing rover camera capture or WebRTC backend**.

The intended approach is software post-processing:

```text
Rover RGB Camera
      |
      | WebRTC
      v
HTMLVideoElement in rover_ui
      |
      +----> Normal camera display (unchanged)
      |
      v
Reduced-resolution processing canvas
      |
      v
OpenCV.js
      |
      v
Feature detection + optical flow
      |
      v
Motion vectors (dx, dy)
      |
      v
Spatial motion analysis
      |
      v
Rolling-shutter model
      |
      v
Future row-dependent correction / warping
```

The important concept is that a rolling-shutter camera does **not expose every image row at exactly the same instant**. During camera/scene motion, different rows can therefore experience different apparent transformations.

A global-shutter correction would use approximately one transform for the whole frame. A rolling-shutter correction ultimately needs a **row-dependent transformation** such as `T(y)` (or more generally `T(x,y)`).

## 3. Current phase

We are **not correcting or warping the image yet**.

The current phase is:

> **Measurement and diagnostics first.**

We need reliable motion measurements before attempting to estimate a rolling-shutter model.

This distinction is important:

**Observed spatially varying optical flow does NOT by itself prove rolling-shutter distortion.**

Spatially varying flow can also result from:
- camera translation
- scene depth
- parallax
- independently moving objects
- poor feature tracks
- motion blur
- feature concentration in one part of the image

Therefore the current objective is to build a robust measurement pipeline and then distinguish camera motion / scene geometry from rolling-shutter effects.

---

# 4. Current repository integration

The main optical-flow implementation is:

```text
src/lib/services/opticalFlowService.ts
```

The WebRTC client is:

```text
src/lib/services/webRtcStreamClient.ts
```

The camera UI/integration is:

```text
src/lib/components/panels/CameraPanel.svelte
```

## WebRTC integration

`H264Viewer.svelte` now owns the video element, WebRTC client, and optional diagnostics.

The important architecture is:

```text
WebRTC client
      |
      v
HTMLVideoElement
      |
      v
OpticalFlowService.start(...)
```

The original displayed video is not modified.

The optical-flow service creates its own hidden/reduced-resolution canvas and copies frames from the video element into that canvas.

### Important constraint

The original optical-flow stage kept the capture backend unchanged. The H.264
migration above now replaces that capture implementation while retaining optional
client-side optical flow.

The goal is to process the already-decoded WebRTC frames in the dashboard frontend.

---

# 5. What has been completed

## 5.1 OpenCV.js installation

The project uses:

```text
@techstark/opencv-js
```

The package was installed successfully and is present in `package.json`.

The OpenCV initialization was adapted for the package's initialization behavior.

Runtime confirmation:

```text
[OpticalFlow] OpenCV.js ready in 1 ms
```

(or a similarly small initialization time).

OpenCV initialization is therefore working.

---

## 5.2 WebRTC camera feed

The `science` WebRTC stream is working.

Typical console sequence:

```text
[CameraPanel] WebRTC 'science' state: connecting
[CameraPanel] WebRTC 'science' state: connected
[OpticalFlow] Started processing: science
```

Therefore the optical-flow service is receiving an actual decoded WebRTC video element.

---

## 5.3 Reduced-resolution processing

Current optical-flow processing resolution:

```text
processingWidth  = 320
processingHeight = 240
```

The full-resolution video display remains unchanged.

The service copies the current WebRTC video frame into a 320×240 canvas and obtains `ImageData` from that canvas.

This was intentionally chosen to keep browser-side OpenCV processing lightweight.

---

## 5.4 Frame/brightness diagnostic

The service temporarily/diagnostically reports:

```text
[OpticalFlow] Frame brightness:
{
    min: ...,
    max: ...,
    mean: ...
}
```

This was useful for confirming that real image data is reaching the OpenCV pipeline.

Observed values include examples such as:

```text
min: ~1
max: 255
mean: ~113–120
```

Therefore the processing canvas is not simply receiving an empty frame.

An initial frame can show:

```text
min: 0
max: 0
mean: 0
```

This occurred during startup and is not by itself considered a failure because subsequent frames contain valid image data.

---

# 6. Feature detection

The original plan considered `goodFeaturesToTrack`, but the installed OpenCV.js build did not expose it as expected.

The implementation therefore uses:

```text
cv.FastFeatureDetector
```

with:

```text
threshold = 5
nonMaxSuppression = true
type = cv.FastFeatureDetector_TYPE_9_16
```

The detected OpenCV keypoints are converted into a `CV_32FC2` matrix suitable for Lucas-Kanade optical flow.

Current feature detection therefore works.

Example:

```text
[OpticalFlow] Low FAST feature count: 0
```

followed later by useful counts such as:

```text
85 features
185 features
```

---

# 7. Lucas-Kanade optical flow

The service uses pyramidal Lucas-Kanade optical flow:

```text
cv.calcOpticalFlowPyrLK(...)
```

Parameters currently include approximately:

```text
window size = 21 × 21
max pyramid level = 3
termination criteria:
    COUNT = 30
    EPS   = 0.01
```

The forward direction is:

```text
previous frame -> current frame
```

and a backward pass is also performed:

```text
current frame -> previous frame
```

This gives forward/backward consistency checking.

---

# 8. Forward-backward tracking validation

For each feature, the code calculates:

```text
old position
      |
      v
forward tracked position
      |
      v
backward tracked position
      |
      v
compare against original position
```

The current rejection threshold is:

```text
fbError > 1.5
```

Such tracks are rejected.

This significantly improves reliability during motion.

The console reports:

```text
detected
fbAccepted
robustAccepted
fbRetention
robustRetention
```

Example good result:

```text
detected: 55
fbAccepted: 53
robustAccepted: 53
fbRetention: 0.9636
robustRetention: 1
```

Example degraded result during stronger motion:

```text
detected: 23
fbAccepted: 14
robustAccepted: 10
fbRetention: ~0.43
robustRetention: ~0.71
```

This demonstrates that the tracker behaves differently under stronger motion and that the quality metrics are useful.

---

# 9. Motion vectors

For every accepted feature:

```text
dx = newX - oldX
dy = newY - oldY
```

and:

```text
magnitude = sqrt(dx² + dy²)
```

Large obviously invalid vectors are rejected using:

```text
magnitude > 50
```

The service calculates:

```text
meanDx
meanDy
meanMagnitude
```

These values are currently being printed by `CameraPanel`.

Example stationary/small-motion output:

```text
points: 85
dx: -0.01
dy: -0.00
magnitude: 0.02
```

Example larger movement:

```text
points: 18
dx: 19.90
dy: 28.53
magnitude: 34.98
```

This confirms that the optical-flow system responds to actual camera movement.

---

# 10. Robust median/MAD filtering

After forward/backward validation, the accepted flow vectors are stored in:

```text
points
```

The service then calculates:

```text
medianDx
medianDy
MAD(dx)
MAD(dy)
```

and applies robust thresholds:

```text
robustDxThreshold = max(3 * MAD(dx), 1.0)
robustDyThreshold = max(3 * MAD(dy), 1.0)
```

The resulting set is:

```text
filteredPoints
```

The reported `trackedPoints` count is based on `filteredPoints`.

This was added to reduce the influence of outlier motion vectors.

---

# 11. Vertical spatial analysis

The eventual rolling-shutter analysis needs to know whether motion changes with image row.

The current implementation divides the image vertically into:

```text
top third
middle third
bottom third
```

and calculates:

```text
topMeanDy
middleMeanDy
bottomMeanDy
```

Conceptually:

```text
+-----------------------------+
|          TOP                |
|       topMeanDy             |
+-----------------------------+
|          MIDDLE             |
|       middleMeanDy          |
+-----------------------------+
|          BOTTOM             |
|       bottomMeanDy          |
+-----------------------------+
```

This is one of the key measurements for the next stage.

However:

> Different top/middle/bottom motion does not automatically prove rolling shutter.

Parallax, camera translation, scene geometry, independently moving objects, and poor feature distributions can also produce spatially varying flow.

---

# 12. Known problems that were encountered and fixed

## Problem 1 — `filteredPoints is not defined`

Runtime error:

```text
ReferenceError: filteredPoints is not defined
```

Cause:

The tracking loop existed, but the median/MAD `filteredPoints` declaration had temporarily been removed/misplaced.

Fix:

The robust filtering block was restored:

```text
dxValues
dyValues
medianDx
medianDy
madDx
madDy
robustDxThreshold
robustDyThreshold
filteredPoints
```

This runtime error is now gone.

---

## Problem 2 — malformed `detectFeatures` assignment

A later edit accidentally produced:

```ts
= this.detectFeatures(gray);
```

Vite reported:

```text
Unexpected "="
```

Fix:

```ts
const points = this.detectFeatures(gray);
```

This is now fixed.

---

## Problem 3 — malformed `backwardError` declaration

A later edit also accidentally produced:

```ts
const backwardEconst points rror = new cv.Mat();
```

Fix:

```ts
const backwardError = new cv.Mat();
```

This is now fixed.

---

# 13. Current known issue: FAST feature instability

This is currently the main issue.

During difficult motion the console can become flooded with messages such as:

```text
[OpticalFlow] Low FAST feature count: 5
[OpticalFlow] Low FAST feature count: 9
[OpticalFlow] Low FAST feature count: 0
[OpticalFlow] Low FAST feature count: 1
...
```

This is not a WebRTC failure.

It means the FAST detector is sometimes finding too few features at the current 320×240 processing resolution.

The current service refreshes feature detection when:

```text
frameCount % 30 === 0
```

or:

```text
trackedPoints < 30
```

Therefore, when tracking falls below 30 points, the system can repeatedly call FAST again.

This can create the repeated warning pattern:

```text
few tracked points
    ↓
refresh FAST
    ↓
few FAST points
    ↓
few tracked points
    ↓
refresh FAST
    ↓
...
```

This needs to be addressed.

---

# 14. Current behavior during stronger movement

The system has already shown several useful behaviors.

Example:

```text
detected: 23
fbAccepted: 14
robustAccepted: 10
fbRetention: ~0.43
robustRetention: ~0.71
```

This indicates that strong motion can cause a substantial number of feature tracks to fail forward/backward consistency.

Another example:

```text
detected: 50
fbAccepted: 50
robustAccepted: 30
fbRetention: 0.60
robustRetention: 0.60
```

Here the forward/backward tracks are accepted, but the robust motion filter rejects a substantial portion as inconsistent with the dominant motion distribution.

There are also large motion measurements such as:

```text
dx: ~19.9
dy: ~28.5
magnitude: ~35
```

These are evidence that the measurement pipeline responds to strong camera movement.

They are **not yet evidence of rolling-shutter distortion**.

---

# 15. Current build/runtime state

The project previously built successfully after the optical-flow implementation was added.

A successful build included:

```text
✓ modules transformed
✓ client built
✓ server built
✔ done
```

There were unrelated warnings involving:
- Svelte accessibility labels
- deprecated Svelte component syntax
- textarea syntax
- a dynamic/static import warning
- OpenCV browser bundling warnings
- large chunk warnings

These did not prevent the build.

After fixing the later syntax errors, runtime testing reached:

```text
[OpticalFlow] OpenCV.js ready
[CameraPanel] WebRTC 'science' state: connected
[OpticalFlow] Started processing: science
```

and then produced optical-flow tracking results.

---

# 16. Current architecture

The intended architecture is:

```text
                  ROVER
+--------------------------------------+
| Logitech C270 / Kreo Owl             |
|                                      |
| rolling-shutter RGB camera           |
+-------------------+------------------+
                    |
                    | WebRTC
                    v
             DASHBOARD PC
+--------------------------------------+
| HTMLVideoElement                     |
|                                      |
|       +------------------------+     |
|       | Normal display         |     |
|       | unchanged              |     |
|       +------------------------+     |
|                                      |
|       +------------------------+     |
|       | 320 × 240 canvas       |     |
|       |                        |     |
|       | OpenCV.js              |     |
|       | FAST                   |     |
|       | Lucas-Kanade            |     |
|       | FB validation           |     |
|       | MAD filtering           |     |
|       | spatial flow statistics |     |
|       +------------------------+     |
+--------------------------------------+
```

The current implementation is intentionally camera-agnostic enough that the same service can eventually be used for multiple RGB cameras.

---

# 17. What is NOT implemented yet

The following are not complete.

## 17.1 No actual rolling-shutter correction

There is currently:

- no image warping
- no row-dependent transform
- no frame synthesis
- no temporal reprojection
- no corrected video output

The existing displayed video remains unchanged.

---

## 17.2 No RANSAC/global-motion model yet

The current robust filtering uses median/MAD.

A more principled next step is to estimate a dominant motion model using robust geometric estimation/RANSAC.

This is particularly important because:

```text
optical flow = camera motion + scene motion + parallax + tracking noise
```

We eventually need to separate these components as much as possible.

---

## 17.3 No BNO055 synchronization yet

The rover has a BNO055 IMU.

The future plan is to use gyro measurements to estimate rotational motion and synchronize it with camera frames.

This could help distinguish:

```text
camera rotation
```

from:

```text
translation / parallax
```

and could provide an important prior for rolling-shutter correction.

This has **not** been implemented yet.

---

## 17.4 No depth-assisted correction

RealSense/LiDAR information is not currently being used.

It may be useful later for estimating depth-dependent motion/parallax, but it is outside the current phase.

---

# 18. Recommended next development step

Do **not** jump directly to image correction.

The next step should be to improve feature distribution.

Current:

```text
320×240 image
      ↓
FAST over whole image
      ↓
arbitrary feature distribution
      ↓
LK tracking
```

Recommended:

```text
320×240 image
      ↓
divide image into grid
      ↓
run FAST in each grid cell
      ↓
keep a controlled number of features per cell
      ↓
LK forward/backward tracking
      ↓
MAD / RANSAC filtering
      ↓
top/middle/bottom analysis
```

For example:

```text
+----------+----------+----------+----------+
|  cell    |  cell    |  cell    |  cell    |
+----------+----------+----------+----------+
|  cell    |  cell    |  cell    |  cell    |
+----------+----------+----------+----------+
|  cell    |  cell    |  cell    |  cell    |
+----------+----------+----------+----------+
```

This prevents all features from clustering in one textured region.

It will make the top/middle/bottom motion statistics much more meaningful.

---

# 19. After feature distribution is fixed

The next experimental sequence should be:

### Step 1 — Stationary camera

Record:

```text
topMeanDy
middleMeanDy
bottomMeanDy
```

Expected behavior:

Small values with no systematic spatial trend.

### Step 2 — Pure/controlled rotation

Move the camera through controlled rotational motion.

Compare:

```text
top
middle
bottom
```

and compare those measurements against BNO055 gyro data once IMU synchronization is implemented.

### Step 3 — Controlled translation

Move the camera laterally/vertically.

Observe how much spatial flow comes from parallax.

### Step 4 — Fast motion

Introduce the motion that visibly produces the "jello" effect.

Record:
- frame timestamps
- optical-flow vectors
- top/middle/bottom motion
- feature retention
- gyro measurements

### Step 5 — Build a rolling-shutter model

Only after the measurements are reliable should a row-dependent transformation be estimated.

Conceptually:

```text
row 0       -> T(0)
row 1       -> T(1)
row 2       -> T(2)
...
row H-1     -> T(H-1)
```

The exact model should be selected based on the measured camera/IMU behavior rather than assumed beforehand.

---

# 20. Important constraints for whoever continues this work

### Do NOT currently:

- modify RoverAPI
- modify rover camera capture
- modify the WebRTC backend
- replace WebRTC with WebSocket/JPEG
- change the normal camera display
- add image warping yet
- claim that spatial flow differences prove rolling shutter
- immediately add a complicated correction algorithm before validating the measurements

### DO:

- keep processing on the dashboard/client side
- keep the normal video display unchanged
- improve feature distribution
- collect reliable spatial optical-flow measurements
- retain forward/backward consistency checks
- retain robust outlier rejection
- eventually synchronize the BNO055 gyro
- validate against controlled camera motion
- only then implement row-dependent rolling-shutter correction

---

# 21. How to run and test

From:

```text
rover_ui/
```

install dependencies if needed:

```powershell
npm.cmd ci
```

Run the development server:

```powershell
npm.cmd run dev
```

Open the rover dashboard.

Connect the `science` WebRTC camera.

Look for:

```text
[API] Auto-connected successfully
[OpticalFlow] OpenCV.js ready
[CameraPanel] WebRTC 'science' state: connected
[OpticalFlow] Started processing: science
```

Then inspect:

```text
[OpticalFlow] Tracking quality:
{
    detected: ...,
    fbAccepted: ...,
    robustAccepted: ...,
    fbRetention: ...,
    robustRetention: ...
}
```

and:

```text
[OpticalFlow] science
{
    points: ...,
    dx: ...,
    dy: ...,
    magnitude: ...,
    topDy: ...,
    ...
}
```

If a build check is needed:

```powershell
npm.cmd run build
```

---

# 22. How to interpret tracking quality

### Good

Something like:

```text
detected: 85
fbAccepted: 85
robustAccepted: 85
fbRetention: 1
robustRetention: 1
```

means most/all features are surviving both filters.

### Degraded

Something like:

```text
detected: 23
fbAccepted: 14
robustAccepted: 10
fbRetention: 0.43
robustRetention: 0.71
```

means the tracker is struggling.

Do not interpret the resulting mean flow as highly reliable when only a handful of points survive.

### Very poor

If you repeatedly see:

```text
Low FAST feature count: 0
Low FAST feature count: 1
Low FAST feature count: 2
...
```

the feature detector/tracking configuration needs attention before using those frames for geometric inference.

---

# 23. Current file to focus on

Primary file:

```text
src/lib/services/opticalFlowService.ts
```

This contains:

- OpenCV initialization
- video-to-canvas processing
- grayscale conversion
- FAST feature detection
- forward LK
- backward LK
- forward/backward error rejection
- median/MAD filtering
- flow statistics
- top/middle/bottom spatial analysis
- OpenCV resource cleanup

Integration file:

```text
src/lib/components/panels/CameraPanel.svelte
```

WebRTC implementation:

```text
src/lib/services/webRtcStreamClient.ts
```

The WebRTC implementation should not need modification for the current optical-flow stage.

---

# 24. Current project status in one view

```text
                    CURRENT STATUS
                    ==============

WebRTC RGB camera                         DONE
        |
        v
HTMLVideoElement                          DONE
        |
        v
320x240 processing canvas                 DONE
        |
        v
OpenCV.js                                 DONE
        |
        v
FAST feature detection                    DONE
        |
        v
Lucas-Kanade forward flow                 DONE
        |
        v
Lucas-Kanade backward flow                DONE
        |
        v
Forward/backward validation               DONE
        |
        v
Median/MAD robust filtering               DONE
        |
        v
Mean dx/dy/magnitude                      DONE
        |
        v
Top/middle/bottom dy                      DONE
        |
        v
Spatially distributed feature selection   NEXT
        |
        v
Better robust geometric model/RANSAC      NEXT
        |
        v
BNO055 synchronization                    NEXT
        |
        v
Rolling-shutter model                     NEXT
        |
        v
Row-dependent correction                  NOT STARTED
        |
        v
Corrected video output                    NOT STARTED
```

---

# 25. Bottom line for the next developer

The project is **past the initial integration stage**.

The WebRTC feed reaches the browser, OpenCV.js initializes, frames are processed, FAST features are detected, Lucas-Kanade tracks them forward and backward, unreliable tracks are rejected, and robust median/MAD filtering is working.

The current major weakness is **unstable/insufficient FAST features during stronger motion**.

Therefore, the immediate engineering task is:

> **Improve the spatial distribution and stability of tracked features, then collect controlled top/middle/bottom optical-flow measurements before attempting any rolling-shutter correction.**

Do not mistake a large optical-flow value for rolling-shutter distortion. The system first needs to establish what portion of the motion is global camera motion, what portion is parallax/scene geometry, and what portion is consistent with the temporal row-by-row exposure behavior of the rolling-shutter camera.

That is the current state of the work.
