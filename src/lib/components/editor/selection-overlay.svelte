<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';
    import SelectionRectangleOverlay from './selection-rectangle-overlay.svelte';

    interface Props {
        class?: string;
        gutterWidth?: number;
    }

    let { class: className = '', gutterWidth = 0 }: Props = $props();

    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );

    const hasSelection = $derived(
        player.selectionStart !== null &&
            player.selectionEnd !== null &&
            player.selectionEnd > (player.selectionStart as number)
    );

    const contentLeft = $derived(hasSelection ? (player.selectionStart as number) * pxPerTick : 0);
    const width = $derived(
        hasSelection
            ? Math.max(
                  1,
                  ((player.selectionEnd as number) - (player.selectionStart as number)) * pxPerTick
              )
            : 0
    );
    const rect = $derived(
        hasSelection
            ? {
                  left: contentLeft,
                  top: 0,
                  width,
                  height: 1
              }
            : null
    );
</script>

<SelectionRectangleOverlay
    {rect}
    {gutterWidth}
    scrollLeft={editorState.scrollLeft}
    class={className}
    stretchY
    overlayClass="rounded-sm bg-primary/20 outline outline-1 outline-primary/50"
/>
