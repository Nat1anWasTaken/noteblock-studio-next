<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';

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
    const innerLeft = $derived(contentLeft - editorState.scrollLeft);
</script>

{#if hasSelection}
    <div
        class={`pointer-events-none absolute z-20 ${className}`}
        style={`top:0; bottom:0; left:${gutterWidth}px; right:0;`}
    >
        <div
            class="absolute inset-y-0 rounded-sm bg-primary/20 outline-1 outline-primary/50"
            style={`left:${innerLeft}px; width:${width}px;`}
        ></div>
    </div>
{/if}
