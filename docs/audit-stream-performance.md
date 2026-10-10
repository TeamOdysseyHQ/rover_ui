# Stream service audit, 9 October 2026

These findings came from the UI source and its existing tests. No rover controls were used.

## Issues recorded before changes

1. WebRTC stats polling waits for every adaptive-feedback request before scheduling its next sample. A slow feedback endpoint therefore delays subsequent FPS and loss readings by up to its request timeout. Sampling and feedback should run independently, with at most one feedback request in flight.
2. WebRTC `getStats()` has no timeout. A native promise that stops resolving prevents further metric updates until disconnect. Feedback response-body parsing is also unbounded.
3. The WebRTC stats sampler accepts non-finite timestamps, frame counters, jitter and decode counters. Those values can produce NaN metrics and invalid feedback. Changing from received-frame counters to decoded-frame counters also compares different quantities.
4. A closed video WebSocket remains the current socket. Late events from it can mark the client connected or deliver frames before the replacement socket exists.
5. WebSocket disconnect and close leave the last FPS and bitrate visible. Reopening also retains old latency samples, so the new connection can display measurements from its predecessor.
6. Header-framed JPEG creation copies the image payload with `ArrayBuffer.slice()` before Blob construction. A view avoids that extra payload allocation.
7. WebSocket stream configuration accepts non-finite FPS and quality. Dynamic quality sends can throw if the socket closes between the state check and `send()`.
8. An established WebRTC peer that stays `disconnected` never reports an error. The consumer can keep a frozen video indefinitely if ICE neither recovers nor moves to `failed`. Allow five seconds for recovery, then release the peer and notify the consumer.

The existing decoder already keeps one active decode and only the newest pending frame. Preserve that bound. Stream quality may decrease under sustained load; target FPS must stay unchanged.

## Changes and verification

Fixed the eight issues above. Feedback runs separately from stats polling, with one request in flight. A slow feedback response changes scale on the next fresh stats snapshot rather than replaying old FPS. Native stats calls have a timeout and an in-flight guard because the browser API cannot cancel the underlying call.

Closed sockets no longer deliver events. Throughput clears when disconnected, and a new connection starts a fresh latency window. JPEG payload construction uses a typed-array view instead of making an extra full payload copy. Configuration values are bounded; control-send failures reach the error callback.

Ran `node --test tests/webRtcStreamClient.test.js tests/videoStreamMetrics.test.js tests/streamAdaptation.test.js`: 31 tests passed. The regressions cover stalled feedback, stale feedback, temporary and persistent ICE loss, invalid stats, closed-socket events and fresh reconnect measurements. Existing tests also verify that a 200-frame burst retains only the current decode and newest pending frame.

This verifies client behavior with simulated peers and sockets. It does not measure live radio latency or camera throughput. Header-based WebSocket latency also assumes the rover and operator clocks are synchronized.
