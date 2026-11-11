<script lang="ts">
    import { onMount, onDestroy, untrack } from 'svelte';
    import { apiStatus, roverApiUrl } from '$lib/stores/apiStore';
    import { isRosConnected, commandedVelocity } from '$lib/stores/rosStore';
    import { ProfiledDriveController } from '$lib/services/profiledDriveController.js';
    import { PhoneControl } from '$lib/services/phoneControl.js';

    type Velocity = { linear: number; angular: number };
    let { onEmergencyStop = (_message: string, _kind: string) => {}, onShowAutoModal = () => {} } = $props();
    async function post(url: string, path: string, signal: AbortSignal, body?: object) {
        const response = await fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: body ? JSON.stringify(body) : undefined });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error(result.detail ?? result.message ?? `Command failed: HTTP ${response.status}`);
    }
    const controller = new ProfiledDriveController({
        send: ({ linear, angular, url, signal }: Velocity & { url: string; signal: AbortSignal }) => post(url, '/api/nav/ros/cmd_vel', signal, { linear_x: linear, linear_y: 0, linear_z: 0, angular_x: 0, angular_y: 0, angular_z: angular }),
        stop: ({ url, signal }: { url: string; signal: AbortSignal }) => post(url, '/api/nav/ros/cmd_vel/stop', signal),
        onChange: () => refresh()
    });
    let drive = $state(controller.snapshot());
    let phoneActive = $state(false);
    let phoneControl: PhoneControl | null = null;
    let keys = $state<string[]>([]);
    const blocked = new Set<string>();
    const repeaters = new Map<string, ReturnType<typeof setInterval>>();
    let ticker: ReturnType<typeof setInterval>;
    type Sample = { time: number; target: Velocity; output: Velocity };
    let history = $state<Sample[]>([]);
    let lastSample = -Infinity;
    function refresh() {
        drive = controller.snapshot();
        commandedVelocity.set(drive.preview ? { linear: 0, angular: 0 } : drive.output);
        const now = performance.now();
        if (now - lastSample >= 100) {
            lastSample = now;
            history = [...history.filter(sample => now - sample.time <= 12000), { time: now, target: drive.target, output: drive.output }];
        }
    }
    function trace(axis: 'linear' | 'angular', field: 'target' | 'output') {
        const end = history.at(-1)?.time ?? 0;
        return history.map(sample => `${300 - (end - sample.time) / 40},${48 - sample[field][axis] * 38}`).join(' ');
    }
    const fmt = (value: number) => `${value < -0.0005 ? '' : '+'}${Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3)}`;
    const usable = $derived(!drive.latched && !drive.stopping && (drive.preview || ($apiStatus === 'connected' && $isRosConnected)));

    function clearInputs() {
        for (const key of keys) blocked.add(key);
        for (const timer of repeaters.values()) clearInterval(timer);
        repeaters.clear(); keys = [];
    }
    function request(target: Velocity) { if (usable) controller.request(target); }
    function normalStop() { phoneControl?.suspend(); clearInputs(); controller.request({ linear: 0, angular: 0 }); }
    function toggleProfile() { clearInputs(); controller.setEnabled(!drive.enabled); }
    function togglePreview() { if (controller.setPreview(!controller.snapshot().preview)) { clearInputs(); history = []; lastSample = -Infinity; } }
    function rearm() { clearInputs(); controller.rearm(); }
    function toggleEmergency() {
        if (controller.snapshot().latched) rearm();
        else void emergencyStop();
    }
    function setLimit(key: keyof typeof drive.settings, value: number) { controller.configure({ ...drive.settings, [key]: value }); }
    function step(key: string) {
        const target = { ...controller.snapshot().target };
        if (key === 'w') target.linear += .05;
        if (key === 's') target.linear -= .05;
        if (key === 'a') target.angular += .05;
        if (key === 'd') target.angular -= .05;
        request(target);
    }
    function startKey(key: string) {
        if (repeaters.has(key) || blocked.has(key) || phoneActive || !usable) return;
        step(key);
        repeaters.set(key, setInterval(() => step(key), 150));
        keys = [...keys, key];
    }
    function releaseKey(key: string) {
        blocked.delete(key); const timer = repeaters.get(key); if (timer) clearInterval(timer); repeaters.delete(key); keys = keys.filter(k => k !== key);
    }
    function typing(target: EventTarget | null) { return target instanceof Element && !!target.closest('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], [role="textbox"]'); }
    function handleKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (key === 'o' && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            if (!event.repeat) togglePreview();
            return;
        }
        if (typing(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        if ('wasd'.includes(key) && key.length === 1) { event.preventDefault(); startKey(key); }
        else if (key === ' ') { event.preventDefault(); toggleEmergency(); }
        else if (key === 'tab' && !controller.snapshot().atRest) { event.preventDefault(); normalStop(); }
    }
    function handleKeyUp(event: KeyboardEvent) { releaseKey(event.key.toLowerCase()); }
    function safetyStop() {
        phoneControl?.suspend();
        clearInputs();
        if (!controller.snapshot().atRest) void controller.halt('Control focus or connection lost.');
    }
    function visibilityChanged() { if (document.hidden) safetyStop(); }
    function focusChanged(event: FocusEvent) { if (typing(event.target) && !(event.target instanceof Element && event.target.closest('[data-drive-control]'))) safetyStop(); }
    async function emergencyStop() {
        phoneControl?.suspend();
        clearInputs();
        const live = drive.connected && !drive.preview;
        await controller.halt();
        const error = controller.snapshot().error;
        onEmergencyStop(error.startsWith('Stop unconfirmed') ? error : live ? 'Emergency stop command issued' : 'Controls stopped locally. No rover command sent.', error.startsWith('Stop unconfirmed') ? 'error' : live ? 'success' : 'info');
    }
    $effect(() => {
        const url = $roverApiUrl;
        const connected = $apiStatus === 'connected' && $isRosConnected;
        untrack(() => {
            if (controller.connected !== connected || controller.url !== url) {
                phoneControl?.suspend(); clearInputs();
                if (connected && controller.preview) { history = []; lastSample = -Infinity; }
            }
            controller.setConnection(connected, url);
        });
    });
    onMount(() => {
        phoneControl = new PhoneControl({
            request: target => controller.request(target),
            halt: reason => { clearInputs(); void controller.halt(reason); },
            resetInputs: clearInputs,
            snapshot: () => controller.snapshot(),
            onActive: active => phoneActive = active
        });
        phoneControl.start();
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', safetyStop); window.addEventListener('pagehide', safetyStop);
        document.addEventListener('visibilitychange', visibilityChanged); document.addEventListener('focusin', focusChanged);
        ticker = setInterval(() => controller.tick(performance.now()), 25);
    });
    onDestroy(() => {
        if (typeof window === 'undefined') return;
        safetyStop(); clearInterval(ticker);
        phoneControl?.close();
        window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', safetyStop); window.removeEventListener('pagehide', safetyStop);
        document.removeEventListener('visibilitychange', visibilityChanged); document.removeEventListener('focusin', focusChanged);
    });
</script>

<section class="drive-panel rounded-xl border border-border bg-card text-card-foreground shadow-lg" aria-label="Driving controls" data-driving-controls data-drive-control>
    <header><h2>Driving controls</h2><button type="button" onclick={() => { safetyStop(); onShowAutoModal(); }}>Auto</button></header>
    <div class="switches">
        <label><input type="checkbox" role="switch" aria-label="Enable motion profile" checked={drive.enabled} disabled={!drive.atRest || drive.stopping} onchange={toggleProfile} /> Motion profile</label>
        <label title="Offline preview (Ctrl+O)"><input type="checkbox" role="switch" aria-label="Offline preview" aria-keyshortcuts="Control+O" checked={drive.preview} disabled={!drive.atRest || drive.stopping} onchange={togglePreview} /> Offline preview</label>
    </div>
    <div class="readouts" aria-label="Velocity comparison">
        <div></div><span>Requested<br />target</span><span>{drive.enabled ? 'Profile' : 'Direct'}<br />output</span><span>Last<br />sent</span>
        {#each [{ axis: 'linear' as const, label: 'Linear', unit: 'm/s' }, { axis: 'angular' as const, label: 'Angular', unit: 'rad/s' }] as row}
            <div class="row-label">{row.label}<small>{row.unit}</small></div>
            <output class="target-value" data-testid={`target-${row.axis}`}>{fmt(drive.target[row.axis])}</output>
            <output class="profile-value" data-testid={`output-${row.axis}`}>{fmt(drive.output[row.axis])}</output>
            <output data-testid={`sent-${row.axis}`}>{drive.lastSent ? fmt(drive.lastSent[row.axis]) : '—'}</output>
        {/each}
    </div>
    <div class="input-layout">
        <div class="keyboard"><span class="mini-label">KEYBOARD TARGET</span><div class="keys">
            {#each [{ key: 'w', arrow: '↑' }, { key: 'a', arrow: '←' }, { key: 's', arrow: '↓' }, { key: 'd', arrow: '→' }] as key}
                <button type="button" class:w={key.key === 'w'} class:pressed={keys.includes(key.key)} disabled={!usable || phoneActive} aria-label={`Drive ${key.key.toUpperCase()}`} onpointerdown={event => { event.currentTarget.setPointerCapture(event.pointerId); startKey(key.key); }} onpointerup={() => releaseKey(key.key)} onpointercancel={() => releaseKey(key.key)} onlostpointercapture={() => releaseKey(key.key)}>{key.key.toUpperCase()} <span>{key.arrow}</span></button>
            {/each}
        </div>
        <div class="drive-actions">
            <button type="button" onclick={normalStop} disabled={!usable} aria-keyshortcuts="Tab">Stop normally <kbd>Tab</kbd></button>
            <button type="button" class="emergency" class:resume={drive.latched} onclick={toggleEmergency} disabled={drive.stopping} aria-keyshortcuts="Space">{drive.latched ? 'Resume controls' : 'Emergency stop'} <kbd>Space</kbd></button>
        </div>
        {#if drive.latched && drive.error !== 'Emergency stop'}<p class="stop-error" role="alert">{drive.error}</p>{/if}
        </div>
    </div>
    <details class="limits"><summary>Profile limits <span>{drive.settings.linearAcceleration.toFixed(2)} m/s² · {drive.settings.linearJerk.toFixed(2)} m/s³</span></summary>
        <div class="settings-grid">
            {#each [
                { key: 'linearAcceleration' as const, label: 'Linear acceleration / braking', unit: 'm/s²', min: .05, max: .33, step: .01 },
                { key: 'linearJerk' as const, label: 'Linear jerk', unit: 'm/s³', min: .1, max: 2, step: .05 },
                { key: 'angularAcceleration' as const, label: 'Angular acceleration / braking', unit: 'rad/s²', min: .1, max: 1, step: .05 },
                { key: 'angularJerk' as const, label: 'Angular jerk', unit: 'rad/s³', min: .1, max: 3, step: .1 }
            ] as setting}
                <label>{setting.label}<div><input type="number" aria-label={setting.label} min={setting.min} max={setting.max} step={setting.step} value={drive.settings[setting.key]} disabled={!drive.atRest || drive.stopping} onchange={event => { if (event.currentTarget.validity.valid) setLimit(setting.key, event.currentTarget.valueAsNumber); else event.currentTarget.value = String(drive.settings[setting.key]); }} /><span>{setting.unit}</span></div></label>
            {/each}
        </div>
    </details>
    <div class="plots" aria-label="Live velocity profile plots"><div class="legend"><span class="dashed"></span> Requested <span class="solid"></span> Output <span>Last 12 seconds</span></div>
        {#each [{ axis: 'linear' as const, label: 'Linear', unit: 'm/s' }, { axis: 'angular' as const, label: 'Angular', unit: 'rad/s' }] as plot}
            <div class="plot-label"><span>{plot.label} · {plot.unit}</span><span>Acceleration {fmt(drive.acceleration[plot.axis])} {plot.unit}²</span></div>
            <svg viewBox="0 0 300 96" role="img" aria-label={`${plot.label} target and profile output over time`}><path class="plot-grid" d="M0 10H300M0 48H300M0 86H300" stroke-width=".6" /><polyline class="target-trace" points={trace(plot.axis, 'target')} fill="none" stroke-dasharray="4 3" stroke-width="1.2" /><polyline class="output-trace" points={trace(plot.axis, 'output')} fill="none" stroke-width="1.6" /></svg>
        {/each}
    </div>

</section>

<style>
    .drive-panel { padding:24px; }
    header,.switches,.plot-label,.legend { display:flex; align-items:center; gap:10px; }
    header { justify-content:space-between; flex-wrap:wrap; margin:-24px -24px 0; padding:16px 24px; border-bottom:1px solid hsl(var(--border)); }
    h2 { font-size:18px; font-weight:600; margin:0; letter-spacing:-.025em; }
    button { border:1px solid hsl(var(--input)); border-radius:6px; padding:8px 12px; background:hsl(var(--secondary)); color:hsl(var(--secondary-foreground)); font-size:12px; font-weight:500; transition:background .15s,border-color .15s; }
    button:hover:not(:disabled) { background:hsl(var(--secondary) / .8); border-color:hsl(var(--primary) / .5); }
    button:focus-visible,input:focus-visible,summary:focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:3px; }
    button:disabled,input:disabled { opacity:.5; cursor:not-allowed; }
    .switches { justify-content:space-between; flex-wrap:wrap; padding:20px 0 12px; }
    .switches label { display:flex; gap:8px; align-items:center; font-size:13px; }
    input[type=checkbox] { accent-color:hsl(var(--primary)); width:16px; height:16px; }
    .readouts { display:grid; grid-template-columns:.8fr 1fr 1fr 1fr; gap:12px 5px; align-items:center; padding:16px 0; border-top:1px solid hsl(var(--border)); border-bottom:1px solid hsl(var(--border)); margin-top:12px; }
    .readouts>span { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:hsl(var(--muted-foreground)); text-align:right; line-height:1.5; }
    .readouts output { text-align:right; font:500 clamp(13px,1.4vw,20px) ui-monospace,monospace; }
    .readouts .target-value { color:hsl(var(--muted-foreground)); }
    .readouts .profile-value { color:hsl(var(--primary)); }
    .row-label { font-size:12px; } .row-label small { display:block; font-size:10px; color:hsl(var(--muted-foreground)); }
    .input-layout { display:flex; justify-content:center; margin:24px 0; }
    .keyboard { width:100%; max-width:320px; text-align:center; }
    .mini-label { font-size:10px; color:hsl(var(--muted-foreground)); letter-spacing:.1em; }
    .keys { display:grid; grid-template-columns:repeat(3,42px); justify-content:center; gap:5px; margin:12px 0; }
    .keys .w { grid-column:2; } .keys button:nth-child(2) { grid-column:1; }
    .keys button { font-family:monospace; padding:9px 0; touch-action:none; }
    .keys button span { display:block; font-size:10px; color:hsl(var(--muted-foreground)); }
    .keys button.pressed { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); }
    .keys button.pressed span { color:inherit; }
    .drive-actions { display:flex; gap:8px; }
    .drive-actions button { flex:1; display:flex; justify-content:center; align-items:center; gap:7px; padding:8px; font-size:11px; }
    .drive-actions kbd { font-size:9px; opacity:.8; }
    .emergency { background:hsl(var(--destructive)); color:hsl(var(--destructive-foreground)); border-color:transparent; }
    .emergency:hover:not(:disabled) { background:hsl(var(--destructive) / .9); border-color:transparent; }
    .emergency.resume { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
    .emergency.resume:hover:not(:disabled) { background:hsl(var(--primary) / .9); }
    .stop-error { margin-top:10px; font-size:12px; color:hsl(var(--destructive)); }
    .limits { border-top:1px solid hsl(var(--border)); border-bottom:1px solid hsl(var(--border)); padding:14px 0; }
    summary { font-size:13px; cursor:pointer; }
    summary span { display:block; font:11px ui-monospace,monospace; color:hsl(var(--muted-foreground)); margin:6px 0 0 14px; }
    .settings-grid { margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .settings-grid label { font-size:11px; color:hsl(var(--muted-foreground)); }
    .settings-grid label div { display:flex; align-items:center; gap:7px; margin-top:6px; }
    input[type=number] { width:76px; padding:6px; border:1px solid hsl(var(--input)); border-radius:6px; background:hsl(var(--secondary)); color:hsl(var(--foreground)); font-family:monospace; }
    .plots { margin-top:20px; }
    .legend { font-size:10px; color:hsl(var(--muted-foreground)); gap:6px; flex-wrap:wrap; }
    .legend>span:last-child { margin-left:auto; }
    .dashed,.solid { display:block; width:14px; border-top:1px dashed hsl(var(--muted-foreground)); }
    .solid { border-top:2px solid hsl(var(--primary)); margin-left:8px; }
    .plot-label { justify-content:space-between; font-size:11px; color:hsl(var(--muted-foreground)); margin:16px 0 6px; }
    svg { width:100%; height:90px; background:hsl(var(--muted)); border-radius:6px; }
    .plot-grid { stroke:hsl(var(--border)); } .target-trace { stroke:hsl(var(--muted-foreground)); } .output-trace { stroke:hsl(var(--primary)); }
</style>
