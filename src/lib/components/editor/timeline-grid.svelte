<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';

    interface Props {
        showLabels?: boolean;
        class?: string;
        gutterWidth?: number;
    }

    let { showLabels = false, class: className = '', gutterWidth = 0 }: Props = $props();

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<!-- Single overlay: offset by gutter; subtract scrollLeft via transform -->
<div class={`pointer-events-none absolute top-0 bottom-0 right-0 ${className}`} style={`left:${gutterWidth}px;`}>
    <div class="relative h-full" style={`width:${editorState.contentWidth}px; transform:translateX(${-editorState.scrollLeft}px);`}>
        {#each range(editorState.totalBars) as barIdx}
            <div
                class="absolute inset-y-0 border-r border-border"
                style={`left:${barIdx * editorState.barWidth}px; width:${editorState.barWidth}px; ${barIdx % 2 === 1 ? 'background-color:hsl(var(--secondary)/0.25)' : ''}`}
            >
                {#if showLabels}
                    <div class="absolute top-1 left-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-none text-secondary-foreground">
                        {barIdx + 1}
                    </div>
                {/if}
                {#each range(editorState.beatsPerBar) as beatIdx}
                    {#if beatIdx > 0}
                        <div class="absolute inset-y-0 border-l border-border/80" style={`left:${beatIdx * editorState.pxPerBeat}px`}></div>
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
</div>
