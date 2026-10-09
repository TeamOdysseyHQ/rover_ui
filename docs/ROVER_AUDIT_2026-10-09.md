# Rover UI and network audit — 9 October 2026

Issues were recorded before repairs in [the transport audit](audit-ui-transport.md), [component audit](audit-ui-components.md), [stream audit](audit-stream-performance.md), and [network audit](audit-network.md). RoverAPI_Endpoint was excluded from changes.

## Network inventory

| Address | Verified role | Physical placement |
| --- | --- | --- |
| 192.168.1.3 | OptiPlex, Ubuntu 22.04.5, hostname rover-avvb | On-board computer, supplied by operator |
| 192.168.1.20 | Rocket M5 access point | Likely on-board; cabling unverified |
| 192.168.1.21 | Rocket M5 station | Likely local/base; cabling unverified |

Radio discovery confirms AP/station roles. Relative timings, neighbour-table MAC translation and the operator's Ethernet ping measurements support physical placement, but do not prove it.

## Repairs

Classic controls now stop on lost focus, hidden pages, editing, disconnect and teardown. Movement requests use a bounded, single-request queue; stops take priority, and reconnecting cannot resume old input. Switching to Arduino stops ROS before awaiting the new connection.

Camera viewers release their own connections without stopping another viewer's shared capture. Established WebRTC failures recover, stale callbacks cannot reopen closed viewers, and MJPEG parameter changes debounce the actual stream URL. Mode buttons select the labeled transport. Camera hardware operations have longer bounded deadlines; mutations are not automatically retried.

The latency work removes fixed 50–150 ms attachment waits and a 300 ms resolution-restart pause. WebRTC metrics no longer await adaptive feedback. WebSocket rendering keeps one active decode and only the newest pending frame; JPEG payloads use a view instead of an extra buffer copy. Numeric RPM reads start before chart code loads.

Response-time work adds connection-health checks and request cancellation, guards superseded requests, and serializes science reads. Bandwidth work shares one 5 Hz RPM session across dashboard/fullscreen consumers: two viewers previously issued 10 reads per second, now 5 while data is available. Failed telemetry uses bounded retry delays. External font requests were removed so initial rendering does not depend on Internet access. Control cadence and camera FPS preference are preserved.

Stack health combines browser online state and UI scheduling delay with API/ROS/Arduino evidence and fixed TCP probes from the UI server. It distinguishes an unavailable API listener from browser request failure and identifies a reported Arduino serial disconnection. Unverified boundaries remain explicit. Cached RPMs have no producer timestamp, so successful API reads do not prove live motor telemetry. The header no longer reports unconditional NOMINAL status.

On the rover, the phone-sensor receiver's existing ADB retry loop now has subprocess deadlines and capped backoff. Live logs confirm retries at 1, 2, 4, then 5 seconds and service restarts roughly every 45 seconds instead of 8. The original file is backed up outside its repository; rollback details are in the network audit.

## Validation

`npm test`: 121 tests passed. Coverage includes real OpenCV processing, drive stop ordering, request coalescing, stale camera callbacks, recovery, cancellation, science polling and diagnostic fault attribution. `npm run build` passed; the final artifact check includes the local favicon and removal of remote fonts.

Live browser verification on the rover LAN showed the expected Arduino disconnection and missing motor RPMs. API round trips were approximately 5–11 ms; UI-server TCP connections were about 1 ms to .21 and 2–5 ms to .20/rover in the observed samples. These are observations, not guarantees or one-way video latency measurements.

A temporary 640×480 WebRTC camera test delivered approximately 15 FPS against a 24 FPS target, with adaptive sizing at 50% and scene-dependent bitrate around 0.02–0.03 Mbps. The camera was stopped after verification, its selected resolution restored, and no rover movement was commanded. This was not a before/after video benchmark. End-to-end motion and radio-under-load testing remains pending.

The network-health route requires a Node-capable SvelteKit server with access to the rover LAN. The current project uses adapter-auto without a configured production target; use its existing development/preview workflow locally or configure an appropriate server adapter before production deployment. Static/cloud hosting cannot probe this private LAN from the operator device. No deployment was performed.

## Remaining issues

Both micro-ROS agents report missing `/dev/chassis-teensy` and `/dev/ttyACM1`; Arduino reports no connection on `/dev/ttyACM0`. Reconnect and verify controllers before motion testing. The Android phone is also absent. Software retry fixes cannot restore disconnected hardware.

The missing user `startup.sh`, Intel Wi-Fi firmware errors, unresolved rover gateway .10, old radio firmware and radio clocks need separate investigation. Wired local communication worked. Their intended configuration or downtime requirements were not established, so routing, firmware and startup behavior were left unchanged. The unused Joystick component's keyboard safety gaps remain recorded in the component audit.

## Repository handoff

UI repository: TeamOdysseyHQ/rover_ui, local base branch redesign at `2e024121bb35782a110930d0fb0516088e3eb90c`. Publication uses the requested Csral AI plugin with a signed bot commit and draft pull request when its repository grant is available. Publication status is recorded separately in [PUBLICATION.md](PUBLICATION.md).

Receiver repository: TeamOdysseyHQ/Receiver-Mobile-app. Its faulty ADB loop was an earlier uncommitted deployment change absent from Git HEAD. Publishing the repaired deployed file wholesale would also introduce those earlier changes. The exact repair is preserved in [receiver-mobile-retry.patch](receiver-mobile-retry.patch); private comparison snapshots are excluded from the UI repository. This deployment-only patch has not been published to the receiver repository.
