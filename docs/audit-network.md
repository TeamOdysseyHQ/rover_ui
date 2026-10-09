# Rover network audit

Audit started on 9 October 2026. Findings are recorded before repairs.

## Initial evidence

The operator supplied these addresses: rover computer `192.168.1.3`, antennas `192.168.1.20` and `192.168.1.21`. The antenna roles remain unverified.

The local Windows computer has Ethernet address `192.168.1.54/24` and gateway `192.168.1.100`. Its Wi-Fi address is `172.29.29.139`. Both default routes have metric 35; the direct `192.168.1.0/24` route selects Ethernet for the rover addresses.

Restricted execution prevented ICMP and ARP inspection: ping reported `Unable to contact IP driver. General failure.` This is a tool-environment limitation, not evidence that the rover or radio link is down. Device probes require execution outside that restriction.

No device configuration, service, motion command, firmware, or network setting has been changed. Credentials are not stored in this report.

## Open checks

- Identify each antenna using its device configuration and link status, rather than assigning a role from its IP address.
- Measure the local link and remote reachability, then inspect the rover's services and host resources.
- Record confirmed issues before making any repair.

## Confirmed findings before repairs

The rover responded to four ICMP probes with no loss and a 1 ms average round trip. SSH identified `rover-avvb`, Ubuntu 22.04.5, kernel `6.8.0-90-generic`. It had 14 GiB available RAM, no swap use, 8% root filesystem use, and low CPU load. The main Ethernet interface was up.

The API on port 6767 and ROS bridge on port 9090 were listening. `uv.service`, `adb-app.service`, kinematics, and both micro-ROS agent services were running. A running service does not prove that its hardware is present.

| Issue | Evidence | Status |
| --- | --- | --- |
| Serial controllers absent | USB listed only a Logitech C270 camera, Bluetooth, and root hubs. No serial by-id directory or ACM devices were reported. `/api/nav/arduino/status` returned `connected:false` for `/dev/ttyACM0`. | Inspect agent logs; physical connections may need repair. |
| Motor telemetry unavailable | `/api/nav/ros/motor_rpms` returned `success:false` and `data:null`. No motor data had been received. | API and ROS were connected; do not display zero RPM as a measured value. |
| User startup service points to missing file | Boot journal recorded repeated `startup.service` failures: `/home/administratror/startup.sh: No such file or directory`. | Inspect intended purpose before changing startup behavior. |
| Phone sensor receiver restarts repeatedly | `adb-app.service` recorded 239 restarts in about 33 minutes. Its receiver retries `adb forward` ten times without a pause, then exits. Logs report `no devices/emulators found`. | Repair the retry delay and subprocess timeout; the phone still needs connecting. |
| On-board Wi-Fi firmware errors | Boot journal contains an Intel `iwlwifi` firmware error dump; `wlan0` has no carrier. | Wired rover communications worked. Driver or firmware repair may require downtime. |
| Rover default gateway unresolved | Default route points to `192.168.1.10`; neighbour state was `FAILED`. Local Windows gateway is `.100`. | Direct rover LAN communications work. Verify gateway ownership before altering routing. |
| Antennas run old firmware and incorrect clocks | Both advertise `XW.ar934x.v6.2.0.33033.190703.1117` and HTTPS Date headers from July 2019. | Record only; firmware or clock changes could interrupt the link. |

The API health endpoint returned `status:ok` and `ros_bridge:connected`; ROS status reported a connected bridge. Camera status reported an empty camera map. The camera exists in USB, but no stream was started during this audit.

Both control-agent journals repeatedly report missing serial ports, specifically `/dev/chassis-teensy` and `/dev/ttyACM1`. This confirms the hardware path is unavailable even though the agent processes run. The Ethernet link negotiated 100 Mbps full duplex.

## Antenna discovery

A single unicast UDP discovery request to port 10001 on each antenna returned this inventory:

| Address | MAC from local ARP | Product | SSID | Raw wireless mode |
| --- | --- | --- | --- | --- |
| `192.168.1.20` | `74:ac:b9:7a:c2:2b` | Rocket M5 / R5N | `ubnt2` | 3: access point |
| `192.168.1.21` | `74:ac:b9:7a:c2:68` | Rocket M5 / R5N | `ubnt2` | 2: station |

The [discovery decoder's source](https://github.com/digineo/ubnt-tools/blob/master/discovery/packet.go) maps mode 2 to Station and mode 3 to AccessPoint. These radio roles are confirmed. AP/station mode does not itself identify physical base/on-board placement.

The evidence suggests `.21` is beside the local/base computer and `.20` is on the rover side. Eight fresh pings to `.21` all took less than 1 ms; `.20` took 1-2 ms, and the rover took 1 ms. The operator independently measured `.20` at 1 ms and `.21` below 1 ms on Ethernet, and reported an antenna beside the monitor, likely `.21`. The rover's neighbour entry for the local operator `.54` maps to the `.21` radio MAC, while the operator's ARP table contains the rover's actual Ethernet MAC. This is consistent with a station bridge doing MAC translation on the operator side. Physical placement remains an inference: radio configuration access or cable tracing would confirm it. Radio login was unavailable, so do not treat inferred placement as a verified inventory setting.

The supplied rover credential failed on `.21`. No password guessing followed. Its SSH server uses a legacy RSA host key. The observed rover host key fingerprint was `SHA256:7vMUodNFpdX0AhdVEE8OpWWPDfr3hYopAVkUyxVTppg`. This fingerprint was observed during this session, not verified against a separate trusted inventory. Credentials are not stored here.

Discovery format reference: [Nmap's Ubiquiti discovery implementation](https://github.com/nmap/nmap/blob/master/scripts/ubiquiti-discovery.nse).

## Repair completed: phone sensor retry loop

Changed `/home/administratror/Projects/Receiver-Mobile-app/receive_sensors.py`. The existing ten attempts are preserved. Each ADB subprocess now has a five-second timeout; failures wait 1, 2, 4, then at most 5 seconds between attempts. The receiver logs a clear unavailable-device message. These pauses reduce process and journal churn while the phone is disconnected.

The source was compiled before replacement, backed up, then replaced atomically. Mock checks covered success after three failures, all ten timeout failures, and the exact backoff schedule. A second syntax check ran with the rover's Python interpreter. Remote `git diff --check` passed. The service's own restart policy loaded the revised file; no manual service restart was issued. Live journal timestamps show the expected 1, 2, 4, 5-second waits and a restart about every 45 seconds, compared with roughly 8 seconds before the repair.

The phone is still absent. Retry behavior is repaired; sensor input cannot be restored until an Android device is connected and authorized. No motion, camera start, robot-control, network reconfiguration, reboot, or firmware operation was performed. `RoverAPI_Endpoint` was not changed.

Original backup: `/home/administratror/rover-audit-backups/receive_sensors.py.20261009T093147Z`. Its SHA256 is `4870b177b882f96f7ec56679348b4f551912baf8e699890455e45e14af2ef905`; repaired source SHA256 is `5efd2ef867a5b412b4f296a86d5c89acee32a7b2cdbbaf2ac122014470e68af1`. The backup sits outside the repository. The empty backup from the first write-mode preflight failure was removed after checking it was empty; that failed attempt did not alter source.

Repository: `git@github.com:TeamOdysseyHQ/Receiver-Mobile-app.git`, inspected base commit `ebca41eb7369cc77acbf633e4cccddc53cb4d518`. The only tracked modification is `receive_sensors.py`. A portable diff is saved as [receiver-mobile-retry.patch](receiver-mobile-retry.patch). Publication is coordinated through the requested Csral AI GitHub plugin; the audit does not push directly from the rover.

Publication preflight found that the deployed receiver already contained uncommitted edits: an added `subprocess` import and the faulty mandatory ADB retry loop. Git HEAD has neither. The repair changed only that deployed loop and preserved the rest of the on-board source. Applying the deployed file wholesale to GitHub HEAD would also publish those earlier edits and introduce a mandatory ADB step to its tethering flow. The exact deployed repair is therefore documented as a patch instead of publishing unrelated source changes. Private preflight snapshots in `docs/publication/` preserve Git HEAD, the original deployed file, and the repaired deployed file; they are excluded from the rover UI publication. Git HEAD source SHA256 is `311e3ff732aa899c80ed09b16fb6caec438413e59945f620a9fb63354544ffdd`.

To restore the receiver source, copy the original backup over `receive_sensors.py`. Its current process retains the loaded code until the next normal restart.

## Repeating the read-only inspection

`python tools/network_audit.py --discover` inventories the two antennas without credentials or third-party packages. SSH mode requires Paramiko, a username, and either a trusted `--fingerprint` or the explicit `--observe-host-key` option for first observation. Passwords are entered at the hidden prompt and kept in memory. The audit tool does not save host keys or change devices.

