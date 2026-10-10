# UI transport and diagnostics audit

Recorded 9 October 2026 before repairs. Scope: rover_ui. RoverAPI_Endpoint is excluded.

| Issue | Evidence | Planned repair |
| --- | --- | --- |
| Connected badge survives a dead API | apiStore checks /api/status only while connecting | Check health while connected; invalidate after repeated failures and cancel superseded attempts |
| Duplicate RPM traffic in fullscreen | MotorRpmPanel and FullscreenCameraView each poll every 200 ms | Share one subscription and polling session across consumers |
| Missing RPM values appear as zero on chart | MotorRpmPanel pushData uses data[key] ?? 0 | Preserve missing values as gaps and reject non-finite samples |
| ROS requests continue after disconnect | RosStatusPanel polls unconditionally | Gate polling by API connection and clear stale ROS status |
| No network fault isolation | ConnectionPanel reports one connection badge | Add bounded read-only TCP probes from the UI server, browser health, API health, and ROS evidence; describe unresolved boundaries explicitly |

Priority: latency, then response time, then bandwidth. Command/control rates are not reduced to save bandwidth. A TCP connection proves only that a listener answered; it cannot prove device health or assign radio roles. Browser failures alone cannot distinguish a stopped API from CORS, mixed content, firewall, or a broken network path.

Validation results and publication status will be added after repairs.

Review findings recorded before the follow-up edits:

- Cached RPM responses lack a producer timestamp. A successful GET must not imply fresh motor telemetry.
- A ROS reconnect clears subscriptions while the API remains connected; missing RPM reads need a backed-off re-subscribe.
- ROS status read errors must remain unverified, distinct from a successful response reporting connected=false.
- TCP refusal proves a responder replied; it must not be diagnosed as a broken network path.
- Numeric RPM readings should start independently of chart chunk loading.
- An API connection must validate its health JSON and clear evidence from the previous host.
- DashboardHeader hardcodes STATUS: NOMINAL even with missing hardware. Replace it with a scoped API connection indicator.
- Camera discovery, resolution reads and start/stop requests lack deadlines. A stuck request leaves the viewer waiting indefinitely. Use longer hardware-operation deadlines and bounded status reads; never retry camera mutations automatically.
- Live browser inspection found an unnamed camera Stop button and an RPM badge marked Live while no RPMs exist. Label the stop control and describe the reader as Polling.
- app.html blocks rendering on an external font stylesheet and references a missing favicon. The rover LAN must render without Internet access. Use the existing system font fallback and a small local SVG icon.
