<script lang="ts">
    import { onMount } from 'svelte';
    import { apiStatus, apiHealth, roverApiUrl } from '$lib/stores/apiStore';
    import { rosStatus } from '$lib/stores/rosStore';
    import { DEFAULT_API_URL, getArduinoStatus } from '$lib/services/roverApi';
    import { motorRpmSample } from '$lib/stores/motorRpmStore';
    import { pollEvery } from '$lib/services/polling.js';
    import { diagnoseStack } from '$lib/services/faultDiagnosis.js';
    import * as Card from '$lib/components/ui/card';

    let online = $state(true);
    let network = $state<any>(null);
    let probeError = $state<string | null>(null);
    let loopLag = $state(0);
    let arduino = $state<any>(null);
    let now = $state(Date.now());
    let diagnosis = $derived(diagnoseStack({ online, apiStatus: $apiStatus, apiHealth: $apiHealth, rosStatus: $rosStatus, arduino, network, now, defaultTarget: $roverApiUrl === DEFAULT_API_URL }));

    $effect(() => {
        if ($apiStatus !== 'connected') { arduino = null; return; }
        return pollEvery(async signal => {
            try {
                const response = await getArduinoStatus(signal);
                if (!signal.aborted) arduino = response.success ? { ...response, lastChecked: Date.now() } : null;
            } catch { if (!signal.aborted) arduino = null; }
        }, 5000);
    });

    onMount(() => {
        const updateOnline = () => { online = navigator.onLine; };
        updateOnline();
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        let expected = performance.now() + 1000;
        const clock = setInterval(() => {
            now = Date.now();
            loopLag = document.hidden ? 0 : Math.max(0, Math.round(performance.now() - expected));
            expected = performance.now() + 1000;
        }, 1000);
        const stop = pollEvery(async signal => {
            if (document.hidden || !online) return;
            try {
                const response = await fetch('/api/network-health', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]) });
                if (!response.ok) throw new Error(`Probe service HTTP ${response.status}`);
                const report = await response.json();
                if (signal.aborted) return;
                network = report;
                probeError = null;
            } catch (error: any) {
                if (!signal.aborted) probeError = error.message;
            }
        }, 5000);
        return () => { stop(); clearInterval(clock); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
    });
</script>

<Card.Root class="bg-card border-border">
    <Card.Header><Card.Title>Stack health</Card.Title></Card.Header>
    <Card.Content class="space-y-3 text-sm">
        <div role="status" aria-live="polite">
            <p class="font-semibold" class:text-red-400={diagnosis.level === 'error'} class:text-green-400={diagnosis.level === 'ok'}>{diagnosis.title}</p>
            <p class="text-xs text-muted-foreground mt-1">{diagnosis.detail}</p>
        </div>
        <div class="text-xs flex justify-between"><span>Dashboard device</span><span>{online ? 'Browser online' : 'Browser offline'}{loopLag > 250 ? ` · UI delayed ${loopLag} ms` : ''}</span></div>
        <div class="text-xs flex justify-between"><span>API round trip</span><span>{$apiHealth.latencyMs === null ? 'Unverified' : `${$apiHealth.latencyMs} ms`}</span></div>
        {#if $apiHealth.error}<p class="text-xs text-red-400 break-words">{$apiHealth.error}</p>{/if}
        <div class="text-xs flex justify-between"><span>Arduino serial bridge</span><span>{!arduino || now - arduino.lastChecked > 12000 ? 'Unverified' : arduino.connected ? 'Connected' : 'Disconnected'}</span></div>
        <div class="text-xs flex justify-between"><span>Motor RPM API read</span><span>{$motorRpmSample.fetchedAt && now - $motorRpmSample.fetchedAt < 2000 ? 'Returned data; source age unknown' : 'Unavailable'}</span></div>
        {#if $motorRpmSample.error && $apiStatus === 'connected'}<p class="text-xs text-muted-foreground">{$motorRpmSample.error}</p>{/if}
        {#if network}
            <div class="space-y-1 border-t border-border pt-2">
                {#each network.probes as probe}
                    <div class="text-xs flex justify-between gap-2"><span>{probe.label} ({probe.host})</span><span class:text-red-400={!probe.reachable}>{now - network.checkedAt > 12000 ? 'Stale' : probe.reachable ? `${probe.latencyMs} ms` : probe.error}</span></div>
                {/each}
            </div>
        {/if}
        {#if probeError}<p class="text-xs text-muted-foreground">Network probe unavailable: {probeError}</p>{/if}
        <p class="text-xs text-muted-foreground">Network checks run from the UI server, which may be a different device from this browser. TCP timings are connection times. Radio roles require topology evidence; device internals require on-board diagnostics.</p>
        <p class="text-xs text-muted-foreground">Likely placement from the network audit: .21 local/base side, .20 on-board side. Physical cabling is unverified.</p>
    </Card.Content>
</Card.Root>
