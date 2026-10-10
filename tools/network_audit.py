"""Read-only rover SSH inspection. Passwords stay in memory and are not logged.

Requires paramiko. Run with --host, --user and --fingerprint; enter the password
at the prompt. For a first inventory, --observe-host-key explicitly permits an
unverified host key and prints it without saving it.
"""

import argparse
import base64
import getpass
import hashlib
import json
import socket
import struct
import sys


CHECKS = {
    "identity": "hostname; uname -a; cat /etc/os-release; id; uptime",
    "resources": "free -h; df -h /; ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -15",
    "network": "ip -brief address; ip route; ip -s link; ss -lntup; ip neigh",
    "services": "systemctl --failed --no-pager; systemctl list-units --type=service --state=running --no-pager",
    "hardware": "lsusb; ls -l /dev/serial/by-id/ /dev/ttyACM* /dev/ttyUSB* /dev/video* 2>/dev/null; cat /proc/sys/kernel/tainted",
    "service-detail": "systemctl show ros-node1.service ros-node2.service ros-launch-bridge.service uv.service adb-app.service -p Id -p ExecStart -p NRestarts -p WorkingDirectory -p User; systemctl --user status startup.service --no-pager; systemctl --user cat startup.service; journalctl -b -u ros-node1 -u ros-node2 --no-pager -n 45; find /home/administratror -maxdepth 3 -name 'startup*' -type f 2>/dev/null",
    "recent-errors": "journalctl -b -p err --no-pager -n 70",
    "mobile-sensors": "journalctl -b -u adb-app --no-pager -n 45; systemctl show adb-app -p ActiveState -p SubState -p NRestarts; sed -n '1,240p' /home/administratror/Projects/Receiver-Mobile-app/receive_sensors.py; ls -l /dev/chassis-teensy /dev/ttyACM* /dev/ttyUSB* 2>/dev/null; cat /sys/class/net/enp2s0/speed; cat /sys/class/net/enp2s0/duplex",
    "radio": r"uname -a; cat /etc/version 2>/dev/null; cat /etc/board.info 2>/dev/null; ip addr 2>/dev/null; brctl showmacs br0 2>/dev/null; grep -E '^(wireless\.1\.(mode|ssid)|radio\.1\.(mode|channel)|netconf\.[0-9]+\.(ip|devname)|resolv\.host\.1\.name|httpd\.https\.status)=' /tmp/system.cfg 2>/dev/null; mca-status 2>/dev/null",
}


def discover_radio(host):
    """One unicast inventory probe; does not configure or restart the radio.

    Format: nmap/nmap scripts/ubiquiti-discovery.nse.
    Mode values: digineo/ubnt-tools discovery/packet.go.
    """
    fields = {3: "firmware", 11: "hostname", 12: "product", 13: "ssid", 20: "model"}
    result = {"address": host}
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
        connection.settimeout(3)
        connection.connect((host, 10001))
        connection.send(bytes((1, 0, 0, 0)))
        payload = connection.recv(8192)
    if len(payload) < 4 or payload[:2] != bytes((1, 0)):
        raise ValueError("Unexpected discovery header")
    if struct.unpack_from(">H", payload, 2)[0] != len(payload) - 4:
        raise ValueError("Invalid discovery length")
    position = 4
    while position < len(payload):
        if len(payload) - position < 3:
            raise ValueError("Truncated discovery field")
        kind, size = struct.unpack_from(">BH", payload, position)
        position += 3
        if position + size > len(payload):
            raise ValueError("Truncated discovery value")
        value = payload[position:position + size]
        position += size
        if kind in fields:
            result[fields[kind]] = value.decode(errors="replace")
        elif kind == 14 and size == 1:
            result["wireless_mode"] = {2: "station", 3: "access-point"}.get(value[0], "unknown")
        elif kind == 10 and size == 4:
            result["uptime_seconds"] = int.from_bytes(value, "big")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host")
    parser.add_argument("--user")
    parser.add_argument("--discover", action="store_true", help="Read antenna inventory without SSH or credentials")
    trust = parser.add_mutually_exclusive_group()
    trust.add_argument("--fingerprint", help="Expected SHA256 host key fingerprint")
    trust.add_argument("--observe-host-key", action="store_true", help="Explicitly accept an unverified key for this run")
    parser.add_argument("--checks", nargs="+", choices=CHECKS, default=["identity", "resources", "network", "services", "hardware", "recent-errors"])
    args = parser.parse_args()
    if args.discover:
        failed = False
        for host in [args.host] if args.host else ["192.168.1.20", "192.168.1.21"]:
            try:
                print(json.dumps(discover_radio(host)))
            except (OSError, ValueError) as error:
                failed = True
                print(json.dumps({"address": host, "error": str(error)}))
        return int(failed)
    if not args.host or not args.user or not (args.fingerprint or args.observe_host_key):
        parser.error("SSH requires --host, --user and either --fingerprint or --observe-host-key")
    try:
        import paramiko
    except ImportError:
        parser.error("SSH inspection requires paramiko; antenna discovery has no third-party dependencies")

    class FingerprintPolicy(paramiko.MissingHostKeyPolicy):
        def missing_host_key(self, client, hostname, key):
            digest = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
            fingerprint = f"SHA256:{digest}"
            if args.fingerprint and args.fingerprint != fingerprint:
                raise paramiko.SSHException("Host key fingerprint mismatch")
            print(f"Observed {hostname} {key.get_name()} host key {fingerprint}")

    password = getpass.getpass("Device password: ")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(FingerprintPolicy())
    try:
        client.connect(args.host, username=args.user, password=password,
                       timeout=8, auth_timeout=8, banner_timeout=8,
                       look_for_keys=False, allow_agent=False)
        password = None
        for name in args.checks:
            print(f"\n[{name}]")
            _, stdout, stderr = client.exec_command(CHECKS[name], timeout=15)
            print(stdout.read().decode(errors="replace"))
            error = stderr.read().decode(errors="replace")
            if error:
                print(error, file=sys.stderr)
    except (paramiko.SSHException, OSError) as error:
        print(f"Audit stopped: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
