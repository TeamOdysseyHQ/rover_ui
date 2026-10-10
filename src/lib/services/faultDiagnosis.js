export function diagnoseStack({ online, apiStatus, apiHealth, rosStatus, arduino, network, now = Date.now(), defaultTarget = true }) {
    if (!online) return { level: 'error', title: 'Local device reports offline', detail: 'Check the dashboard device’s Ethernet or Wi-Fi connection. The browser cannot identify which adapter failed.' };
    const freshHealth = apiHealth?.lastChecked && now - apiHealth.lastChecked < 7000 && !apiHealth.error;
    if (apiStatus === 'connected' && freshHealth) {
        const rosFresh = rosStatus?.lastChecked && now - rosStatus.lastChecked < 12000;
        if (rosFresh && rosStatus.status === 'disconnected') return { level: 'error', title: 'On-board ROS bridge unavailable', detail: 'The rover API answers, but reports the ROS bridge disconnected. Inspect rosbridge and ROS service logs on the rover.' };
        if (arduino?.lastChecked && now - arduino.lastChecked < 12000 && arduino.connected === false) return { level: 'error', title: 'On-board Arduino serial connection unavailable', detail: `The API reports no Arduino connection${arduino.port ? ` on ${arduino.port}` : ''}. Check USB cabling, device presence, serial permissions, and controller power. ROS motor controllers may use a separate connection.` };
        const rosConnected = rosFresh && rosStatus.status === 'connected';
        return { level: rosConnected ? 'ok' : 'unknown', title: rosConnected ? 'API and ROS bridge responding' : 'API responding; ROS not verified', detail: 'This does not verify motor controllers, sensors, camera capture, or command delivery. Check their telemetry and service logs.' };
    }
    if (apiStatus === 'disconnected' || apiStatus === 'connecting') return { level: 'unknown', title: apiStatus === 'connecting' ? 'Checking rover API' : 'API connection is disabled', detail: 'Connect to the rover to collect API and ROS health evidence.' };
    if (!defaultTarget) return { level: 'unknown', title: 'Configured API is not responding', detail: 'Network probes below target the rover network at 192.168.1.3. They cannot isolate faults for a different API address.' };
    if (!network || now - network.checkedAt > 12000) return { level: 'unknown', title: 'API check failed; network evidence unavailable', detail: 'A browser error can mean network loss, blocked requests, or an API failure. UI-server probes are unavailable or stale.' };
    const probes = Object.fromEntries(network.probes.map(probe => [probe.id, probe]));
    if (probes.api?.reachable) return { level: 'error', title: 'API listener reachable; browser health check failed', detail: 'Inspect API HTTP errors and browser CORS or mixed-content errors. A reachable TCP port does not prove a healthy API.' };
    if (probes.rover?.reachable) return { level: 'error', title: 'On-board API listener unavailable', detail: 'The rover SSH port responds from the UI server, but API port 6767 does not. Check uv.service, the API bind address, and firewall rules.' };
    if (probes.radio20?.reachable || probes.radio21?.reachable) return { level: 'error', title: 'Rover host or its network path is unreachable', detail: 'At least one radio management port answers, but rover SSH and API do not. Check rover power, on-board Ethernet, and the radio link. These probes cannot distinguish those failures.' };
    if (network.probes.some(probe => probe.error === 'ECONNREFUSED')) return { level: 'error', title: 'Network listener connections refused', detail: 'A device or firewall replied with TCP refusal. Inspect service listeners and firewall rules; refusal alone does not prove network loss or failed hardware.' };
    return { level: 'error', title: 'Rover network path unavailable', detail: 'Neither radio management port nor the rover answers from the UI server. Check its local network route, then base-station power and cabling. Management-port failures alone do not prove a radio is down.' };
}
