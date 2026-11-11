<script lang="ts">
    import { Ellipsis, FlaskConical, Terminal, X } from '@lucide/svelte';

    let { onOpenScience, onOpenLog, microscopeActive = false }: {
        onOpenScience: () => void;
        onOpenLog: () => void;
        microscopeActive?: boolean;
    } = $props();
    let expanded = $state(false);
    let container: HTMLElement;
    let trigger: HTMLButtonElement;

    function dismissOutside(event: PointerEvent) {
        if (expanded && event.target instanceof Node && !container.contains(event.target)) expanded = false;
    }
    function keydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && expanded) {
            expanded = false;
            trigger.focus();
        }
    }
</script>

<svelte:window onpointerdown={dismissOutside} onkeydown={keydown} />

<nav bind:this={container} class="dashboard-tools" aria-label="Dashboard tools">
    {#if expanded}
        <div id="dashboard-tool-actions" class="actions" role="group" aria-label="Available tools">
            <button type="button" class="tool" aria-label="Open API Activity Log" onclick={() => { expanded = false; onOpenLog(); }}>
                <span class="bubble"><Terminal size={22} /></span><span class="label">API log</span>
            </button>
            <button type="button" class="tool" aria-label="Open Science Center" onclick={() => { expanded = false; onOpenScience(); }}>
                <span class="bubble"><FlaskConical size={22} />{#if microscopeActive}<span class="status"></span>{/if}</span><span class="label">Science</span>
            </button>
        </div>
    {/if}
    <button bind:this={trigger} type="button" class="trigger" aria-label={expanded ? 'Close tools menu' : 'Open tools menu'} aria-expanded={expanded} aria-controls="dashboard-tool-actions" onclick={() => expanded = !expanded}>
        {#if expanded}<X size={24} />{:else}<Ellipsis size={26} />{/if}
        {#if microscopeActive}<span class="status"></span>{/if}
    </button>
</nav>

<style>
    .dashboard-tools { position:fixed; bottom:2rem; right:2rem; height:64px; display:flex; align-items:flex-start; gap:12px; z-index:40; }
    .actions { display:flex; gap:12px; animation:expand-left .16s ease-out; }
    .tool { display:flex; flex-direction:column; align-items:center; gap:6px; width:64px; color:var(--slate-300); background:transparent; border:0; padding:0; cursor:pointer; }
    .bubble,.trigger { position:relative; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--slate-900); border:1px solid var(--slate-700); color:var(--sky-blue); box-shadow:0 4px 12px #0005; }
    .bubble { width:56px; height:56px; margin-top:4px; }
    .trigger { width:64px; height:64px; cursor:pointer; }
    .label { font-size:11px; line-height:16px; white-space:nowrap; padding:1px 6px; border-radius:5px; background:var(--slate-900); }
    .trigger:hover,.tool:hover .bubble { background:var(--slate-800); border-color:var(--sky-blue); }
    button:focus-visible { outline:2px solid var(--sky-blue); outline-offset:4px; border-radius:32px; }
    .status { position:absolute; right:5px; top:5px; width:10px; height:10px; border-radius:50%; background:#22c55e; }
    @keyframes expand-left { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
    @media (max-width:768px) { .dashboard-tools { bottom:1.5rem; right:1.5rem; height:56px; gap:8px; } .trigger { width:56px; height:56px; } .bubble { margin-top:0; } }
    @media (prefers-reduced-motion:reduce) { .actions { animation:none; } }
</style>
