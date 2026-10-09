# UI component audit, 9 October 2026

Issues recorded before fixes. Checks use mocked motor and camera outputs; no rover movement was requested.

| Issue | Evidence | Effect |
| --- | --- | --- |
| Classic controls ignore focus and visibility safety stops | `DrivingControls.svelte` calls `stopGame()` only when Game controls are enabled. Classic ROS publishing and Arduino ramp timers survive blur, hidden pages and text-field focus. | The UI can keep commanding motion after the operator leaves it. |
| Classic controls accept shortcuts and editable elements | The Classic key handler ignores only input and textarea elements; Ctrl/Alt/Meta and contenteditable/select targets remain active. Key release from an input returns before clearing held timers. | Typing or browser shortcuts can command or keep ramping motion. |
| Classic controls retain state after disconnect or rover URL change | The connection effect clears only Game state. Classic velocity and ramp timers remain active. | Reconnection can resume an old motion command. |
| Classic movement requests can overlap | ROS publishes every 100 ms and Arduino ramp requests start without waiting for prior requests. | Network delay can queue stale movement and let a stop be overtaken. |
| ROS mode switch connects Arduino before stopping ROS | `toggleControlMode()` awaits connection and status before calling `stopMovement()`. | Existing ROS motion continues during a slow mode switch. |
| ROS teardown does not send a Classic stop | `onDestroy()` clears Classic ROS timers without publishing zero velocity. | The last motion command may outlive the component. |
| MJPEG slider debounce does not debounce its stream URL | `handleMjpegParamChange()` immediately replaces `mjpegParams`; `getStreamUrl()` reads that same map before its timeout. | Each slider input reconnects the MJPEG stream, wasting bandwidth and delaying frames. |
| Camera teardown waits on server before clearing active state | `stopAllCameras()` clears `activeCameras` after its server request; unmount calls this operation. | Late start callbacks and retries can recreate viewers during teardown. |
| Camera panel unmount stops every backend camera | Its mount cleanup calls `stopAllCameras()`, which invokes the global server stop endpoint. | Leaving this panel disrupts other viewers, including fullscreen slots. |
| Microscope and ROS camera modes retain late startup and retry callbacks | Both panels schedule client attachment without guarding panel lifetime; status uses overlapping async interval requests. | Leaving the panel can recreate peers or update obsolete status. |
| Microscope and ROS camera unmount stops shared backend resources | Microscope cleanup calls its backend stop; ROS cleanup unsubscribes the shared ROS topic. | Other viewers can lose their frames. |
| Microscope stream mode change attaches before DOM update | It starts its next client immediately after changing the mode. | The new canvas/video element may not exist yet. |
| Microscope and ROS camera established WebRTC errors only log | Their `onError` handlers log; retries run only in the original negotiation promise catch. | An established peer failure leaves a dead feed without recovery. |
| Microscope MJPEG debounce reconnects on every input | The stream URL reads live slider values directly. | A slider drag repeatedly reconnects the feed. |
| Microscope mode buttons all cycle modes | Each labeled mode button calls the same cycle function without passing its mode. | Clicking MJPEG, WS or WebRTC can select a different transport. |
| Fullscreen WebSocket startup has no catch | `initStream()` awaits `connect()`/`connectCustom()` outside a try block; its effect does not catch the returned promise. | A stream failure can become an unhandled rejection without a visible error. |
| Science telemetry overlaps slow reads | `ScienceSensorDisplay` and `ScienceControlPanel` use async 2-second intervals without waiting for completion or passing cancellation signals. | Slow endpoints accumulate requests; late responses can overwrite newer data after disconnect or unmount. |
| Science polling ignores API connection identity | Poll effects watch only auto-refresh or science mode. | Disconnected panels keep polling, and results from a previous rover can appear after switching endpoints. |

Joystick.svelte also accepts keyboard input in editable fields and has no blur/unmount stop, but it is currently unused (`rg` found no imports). It remains a follow-up unless a live route uses it.

## Fixes and verification

Classic drive commands now use the existing one-request queue. The first ROS command starts immediately; pending movement coalesces, and stop takes precedence. Blur, hidden pages, editable-field focus, disconnect and component teardown clear both drive modes. A held key must be released before it can rearm after a safety stop. ROS mode switches wait for zero velocity before connecting Arduino. Arduino teardown waits for its stop before disconnecting. Classic key highlighting now replaces its Set after changes so Svelte can update it.

Camera panels release local viewers before awaiting network shutdown. Unmount and disconnect no longer stop shared backend cameras or ROS subscriptions. Explicit Stop All, Stop and Unsubscribe actions retain their backend requests. Late startup, retry and metrics callbacks cannot revive a removed viewer. ROS and microscope status polling uses completion-based scheduling. Established WebRTC failures use the same bounded retry path as negotiation failures; the original error stays visible. WebRTC and WebSocket badges report live only when frames are measured; MJPEG does not claim measured delivery.

MJPEG sliders keep their immediate display values separate from committed stream settings. One reconnect happens after the last 300 ms debounce. Stream attachment waits for Svelte's DOM update rather than fixed delays of 50–150 ms; camera resolution restart no longer adds a 300 ms delay after the stop response. Microscope mode buttons select the clicked label. Fullscreen WebSocket startup errors appear in the slot.

Tests execute the actual component handlers with mocked peers, API calls and timers. They cover safety stops, delayed movement ordering, callback races, retry deduplication and mode changes. Browser rendering and live motor response still require field validation with the rover secured.

Science panels now schedule the next telemetry cycle after the current reads complete. Each cycle passes cancellation through to the API, stops when disconnected and invalidates late responses on endpoint change or teardown. Manual sensor refresh shares the same in-flight guard. Drill and warning reads settle independently, so a failed endpoint does not discard its companion's successful result or start an overlapping cycle. Ten simulated-timer tests cover slow reads, cancellation, disconnect, endpoint changes and manual refresh.
