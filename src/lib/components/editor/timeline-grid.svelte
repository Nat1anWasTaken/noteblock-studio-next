<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';

    interface Props {
        showLabels?: boolean;
        class?: string;
    }

    let { showLabels = false, class: className = '' }: Props = $props();

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<!-- Fills the parent relative container -->
<div class={`pointer-events-none absolute inset-0 ${className}`}>
    {#each range(editorState.totalBars) as barIdx}
        <div
            class="absolute inset-y-0 border-r border-border"
            style={`left:${barIdx * editorState.barWidth}px; width:${editorState.barWidth}px; ${barIdx % 2 === 1 ? 'background-color:hsl(var(--secondary)/0.25)' : ''}`}
        >
            {#if showLabels}
                <div
                    class="absolute top-1 left-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-none text-secondary-foreground"
                >
                    {barIdx + 1}
                </div>
            {/if}
            {#each range(editorState.beatsPerBar) as beatIdx}
                {#if beatIdx > 0}
                    <div
                        class="absolute inset-y-0 border-l border-border/80"
                        style={`left:${beatIdx * editorState.pxPerBeat}px`}
                    ></div>
                {/if}
            {/each}
        </div>
    {/each}

    <!-- Cursor removed; see PlayheadCursor component overlay -->
</div>
