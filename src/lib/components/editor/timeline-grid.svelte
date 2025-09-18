<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';

    interface Props {
        showLabels?: boolean;
        class?: string;
        gutterWidth?: number;
        contentWidth?: number;
        scrollLeft?: number;
        barWidth?: number;
        totalBars?: number;
        beatsPerBar?: number;
        pxPerBeat?: number;
        startBar?: number;
    }

    let {
        showLabels = false,
        class: className = '',
        gutterWidth = 0,
        contentWidth: contentWidthProp,
        scrollLeft: scrollLeftProp,
        barWidth: barWidthProp,
        totalBars: totalBarsProp,
        beatsPerBar: beatsPerBarProp,
        pxPerBeat: pxPerBeatProp,
        startBar = 0
    }: Props = $props();

    const contentWidth = $derived(contentWidthProp ?? editorState.contentWidth);
    const scrollLeft = $derived(scrollLeftProp ?? editorState.scrollLeft);
    const barWidth = $derived(Math.max(1, barWidthProp ?? editorState.barWidth));
    const totalBars = $derived(Math.max(1, Math.round(totalBarsProp ?? editorState.totalBars)));
    const beatsPerBar = $derived(Math.max(1, beatsPerBarProp ?? editorState.beatsPerBar));
    const pxPerBeat = $derived(Math.max(1, pxPerBeatProp ?? editorState.pxPerBeat));

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<!-- Single overlay: offset by gutter; subtract scrollLeft via transform -->
<div
    class={`pointer-events-none absolute top-0 right-0 bottom-0 ${className}`}
    style={`left:${gutterWidth}px;`}
>
    <div
        class="relative h-full"
        style={`width:${contentWidth}px; transform:translateX(${-scrollLeft}px);`}
    >
        {#each range(totalBars) as barIdx}
            <div
                class="absolute inset-y-0 border-r border-border"
                style={`left:${barIdx * barWidth}px; width:${barWidth}px; ${barIdx % 2 === 1 ? 'background-color:hsl(var(--secondary)/0.25)' : ''}`}
            >
                {#if showLabels}
                    <div
                        class="absolute top-1 left-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-none text-secondary-foreground"
                    >
                        {barIdx + startBar + 1}
                    </div>
                {/if}
                {#each range(beatsPerBar) as beatIdx}
                    {#if beatIdx > 0}
                        <div
                            class="absolute inset-y-0 border-l border-border/80"
                            style={`left:${beatIdx * pxPerBeat}px`}
                        ></div>
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
</div>
