<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';

    interface Props {
        gutterWidth?: number;
        class?: string;
        scrollLeft?: number;
        pxPerTick?: number;
        currentTick?: number;
        tickOffset?: number;
        visible?: boolean;
    }

    let {
        gutterWidth = 0,
        class: className = '',
        scrollLeft: scrollLeftProp,
        pxPerTick: pxPerTickProp,
        currentTick: currentTickProp,
        tickOffset: tickOffsetProp = 0,
        visible: visibleProp
    }: Props = $props();

    const defaultPxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
    const pxPerTick = $derived(Math.max(0, pxPerTickProp ?? defaultPxPerTick));
    const scrollLeft = $derived(scrollLeftProp ?? editorState.scrollLeft);
    const currentTick = $derived(currentTickProp ?? player.currentTick);
    const tickOffset = $derived(tickOffsetProp ?? 0);
    const visible = $derived(visibleProp ?? true);

    const contentX = $derived(Math.max(0, (currentTick - tickOffset) * pxPerTick));
    const viewportX = $derived(contentX - scrollLeft);
    const cursorTransitionMs = $derived(Math.max(0, Math.round(1000 / player.tempo)));
</script>

<!-- Absolute overlay that spans the parent relative container -->
<div
    class={`pointer-events-none absolute inset-y-0 right-0 z-30 ${className}`}
    style={`left:${gutterWidth}px`}
>
    {#if visible}
        <div
            class="absolute top-0 bottom-0"
            style={`transform:translateX(${viewportX}px); transition: transform ${cursorTransitionMs}ms linear;`}
        >
            <div class="h-full w-[2px] bg-primary shadow-[0_0_0_1px_hsl(var(--background))]"></div>
        </div>
    {/if}
</div>
