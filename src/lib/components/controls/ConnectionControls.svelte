<script lang="ts">
    import { onDestroy } from 'svelte';
    import { ChevronDown, LoaderCircle, Power, Wifi } from '@lucide/svelte';
    import { apiStatus, roverApiUrl, testConnection, disconnectFromRover, monitorConnection } from '$lib/stores/apiStore';
    import { rosStatus, isRosConnected, checkRosStatus, connectToRos, disconnectFromRos } from '$lib/stores/rosStore';
    import { DEFAULT_API_URL } from '$lib/services/roverApi';
    import { connectRover } from '$lib/services/connectionActions.js';
    import { pollEvery } from '$lib/services/polling.js';
    import { wakeRover } from '$lib/services/wakeRover.js';

    let apiUrl = $state(DEFAULT_API_URL);
    let expanded = $state(false);
    let busy = $state(false);
    let waking = $state(false);
    let message = $state('');
    let failed = $state(false);
    let container: HTMLElement;
    let trigger: HTMLElement;
    let wakeController: AbortController | undefined;
    let connected = $derived($apiStatus === 'connected' && $isRosConnected);
    let locked = $derived(busy || waking || $apiStatus === 'connecting');

    onDestroy(() => wakeController?.abort());
    $effect(() => {
        if (connected && !locked) { message = ''; failed = false; }
    });
    $effect(() => {
        if ($apiStatus === 'connected') return monitorConnection();
    });
    $effect(() => {
        if ($apiStatus !== 'connected') {
            rosStatus.set({ status: 'disconnected', url: null, subscribedTopics: [], publishedTopics: [], lastChecked: null });
            return;
        }
        if (!busy && !waking) return pollEvery(signal => checkRosStatus(signal), 5000);
    });

    function dismissOutside(event: PointerEvent) {
        if (expanded && event.target instanceof Node && !container.contains(event.target)) expanded = false;
    }
    function keydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && expanded) {
            expanded = false;
            trigger.focus();
        }
    }
    async function connectAll(target = apiUrl) {
        if (locked) return;
        busy = true;
        message = '';
        failed = false;
        try {
            const ready = await connectRover(target);
            failed = !ready;
            if (!ready) message = $apiStatus === 'connected' ? 'API connected. ROS bridge did not connect. Open connection options to retry.' : 'Could not connect to the rover API. Check the address and network.';
        } finally { busy = false; }
    }
    async function toggleApi() {
        if (locked) return;
        message = '';
        failed = false;
        if ($apiStatus === 'connected') { disconnectFromRover(); return; }
        busy = true;
        try {
            failed = !await testConnection(apiUrl);
            if (failed) message = 'Could not connect to the rover API.';
        } finally { busy = false; }
    }
    async function toggleRos() {
        if (locked || $apiStatus !== 'connected') return;
        busy = true;
        message = '';
        failed = false;
        try {
            if ($isRosConnected) await disconnectFromRos();
            else if (!(await connectToRos()).success) { failed = true; message = 'Could not connect to the ROS bridge.'; }
            await checkRosStatus();
        } finally { busy = false; }
    }
    async function powerOn() {
        if (locked) return;
        const controller = new AbortController();
        wakeController = controller;
        waking = true;
        failed = false;
        message = 'Sending wake signal...';
        try {
            const target = await wakeRover({ signal: controller.signal, onSent: () => { message = 'Wake signal sent. Waiting for the onboard computer...'; } });
            if (controller.signal.aborted) return;
            apiUrl = target;
            const ready = await connectRover(target);
            if (controller.signal.aborted) return;
            failed = !ready;
            message = ready ? 'Onboard computer connected.' : 'Onboard API is online. Open connection options to check ROS.';
        } catch (error: unknown) {
            if (controller.signal.aborted) return;
            failed = true;
            message = error instanceof Error ? error.message : 'Could not power on the onboard computer.';
        } finally { if (!controller.signal.aborted) waking = false; }
    }
</script>

<svelte:window onpointerdown={dismissOutside} onkeydown={keydown} />

<div bind:this={container} class="connection-controls" aria-label="Rover connections">
    <div class="toolbar">
        <div class="connect-group">
            <button type="button" class="connect" class:connected disabled={locked} onclick={() => connected ? expanded = !expanded : connectAll()}>
                {#if busy || $apiStatus === 'connecting'}<LoaderCircle size={16} class="animate-spin" />{:else}<Wifi size={16} />{/if}
                {busy || $apiStatus === 'connecting' ? 'Connecting...' : connected ? 'Connected' : 'Connect'}
            </button>
            <button bind:this={trigger} type="button" class="options-trigger" aria-label="Connection options" aria-expanded={expanded} aria-controls="connection-options" onclick={() => expanded = !expanded}>
                <ChevronDown size={15} />
            </button>
        </div>
        <button type="button" class="power" disabled={locked} onclick={powerOn} title="Wake the onboard computer">
            {#if waking}<LoaderCircle size={16} class="animate-spin" />{:else}<Power size={16} />{/if}
            {waking ? 'Waking...' : 'Power on'}
        </button>
    </div>
    {#if message}<p role="status" aria-live="polite" class="feedback" class:failed>{message}</p>{/if}
    {#if expanded}
        <section id="connection-options" class="connection-options" aria-label="Individual connections">
            <label for="api-url">Rover API URL</label>
            <input id="api-url" type="url" bind:value={apiUrl} disabled={$apiStatus === 'connected' || locked} />
            <div class="connection-row">
                <div><span>Rover API</span><small>{$apiStatus}</small></div>
                <button type="button" disabled={locked} onclick={toggleApi}>{$apiStatus === 'connected' ? 'Disconnect API' : 'Connect API'}</button>
            </div>
            <div class="connection-row">
                <div><span>ROS bridge</span><small>{$rosStatus.status}</small></div>
                <button type="button" disabled={locked || $apiStatus !== 'connected'} onclick={toggleRos}>{$isRosConnected ? 'Disconnect ROS' : 'Connect ROS'}</button>
            </div>
            {#if $rosStatus.url}<p class="ros-detail">{$rosStatus.url}</p>{/if}
            {#if $isRosConnected}
                <p class="ros-detail">{$rosStatus.subscribedTopics.length} subscriptions · {$rosStatus.publishedTopics.length} publishers</p>
                {#if $rosStatus.subscribedTopics.length}
                    <details><summary>Subscribed topics</summary><ul>{#each $rosStatus.subscribedTopics as topic}<li>{topic}</li>{/each}</ul></details>
                {/if}
            {/if}
        </section>
    {/if}
</div>

<style>
    .connection-controls { position:relative; z-index:30; min-width:0; }
    .toolbar,.connect-group { display:flex; align-items:center; }
    .toolbar { gap:.65rem; justify-content:flex-end; }
    button { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; min-height:38px; padding:.5rem .85rem; border:1px solid var(--slate-700); border-radius:8px; background:var(--slate-900); color:var(--slate-200); font-size:.8rem; cursor:pointer; white-space:nowrap; }
    button:hover:not(:disabled) { border-color:var(--sky-blue); background:var(--slate-800); }
    button:disabled { opacity:.5; cursor:default; }
    button:focus-visible,input:focus-visible,summary:focus-visible { outline:2px solid var(--sky-blue); outline-offset:3px; }
    .connect { border-radius:8px 0 0 8px; border-right:0; }
    .connected { color:#4ade80; }
    .options-trigger { padding:.5rem; border-radius:0 8px 8px 0; }
    .power { color:var(--sky-blue); }
    .feedback { max-width:340px; margin:.5rem 0 0 auto; font-size:.75rem; color:var(--slate-300); text-align:right; }
    .failed { color:#f87171; }
    .connection-options { position:absolute; right:0; top:calc(100% + .6rem); width:340px; max-width:calc(100vw - 2rem); padding:1rem; border:1px solid var(--slate-700); border-radius:12px; background:var(--slate-900); box-shadow:0 12px 35px #0008; text-align:left; }
    label { display:block; margin-bottom:.4rem; font-size:.75rem; color:var(--slate-300); }
    input { width:100%; padding:.5rem; border:1px solid var(--slate-700); border-radius:6px; background:var(--slate-800); color:var(--slate-200); font-size:.8rem; }
    input:disabled { opacity:.65; }
    .connection-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:1rem; font-size:.8rem; }
    .connection-row small { display:block; margin-top:.2rem; color:var(--slate-400); }
    .connection-row button { min-height:32px; padding:.35rem .6rem; font-size:.75rem; }
    .ros-detail,details { margin-top:.75rem; color:var(--slate-400); font-size:.75rem; overflow-wrap:anywhere; }
    summary { cursor:pointer; } ul { padding-left:1rem; margin-top:.4rem; }
</style>
