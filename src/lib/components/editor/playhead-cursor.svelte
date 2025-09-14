<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';

    interface Props {
        gutterWidth?: number; // px to offset from the left (to skip gutters)
        class?: string;
    }

    let { gutterWidth = 0, class: className = '' }: Props = $props();

    // Compute position in viewport space: contentX - scrollLeft
    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
    const contentX = $derived(player.currentTick * pxPerTick);
    const viewportX = $derived(contentX - editorState.scrollLeft);
    const cursorTransitionMs = $derived(Math.max(0, Math.round(1000 / player.tempo)));
</script>

<!-- Absolute overlay that spans the parent relative container -->
<div
    class={`pointer-events-none absolute inset-y-0 right-0 z-30 ${className}`}
    style={`left:${gutterWidth}px`}
>
    <div
        class="absolute top-0 bottom-0"
        style={`transform:translateX(${viewportX}px); transition: transform ${cursorTransitionMs}ms linear;`}
    >
        <div class="h-full w-[2px] bg-primary shadow-[0_0_0_1px_hsl(var(--background))]"></div>
    </div>
    <!-- Optional: add a slight glow to improve contrast on busy grids -->
</div>
