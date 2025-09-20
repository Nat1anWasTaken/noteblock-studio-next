<script lang="ts">
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState } from '$lib/editor-state.svelte';
    import type { NoteChannel } from '$lib/types';
    import Plus from '~icons/lucide/plus';
    import NoteSection from './note-section.svelte';

    interface Props {
        channel: NoteChannel;
        index: number; // 0-based
        rowHeight?: number; // px
    }

    let { channel, index, rowHeight = 72 }: Props = $props();

    const hover = $derived(editorMouse.newSectionHover);
    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
</script>

{#if hover && hover.channelIndex === index}
    {@const left = hover.startingTick * pxPerTick}
    {@const width = Math.max(1, hover.length * pxPerTick)}
    {@const top = index * rowHeight}
    <div
        class="new-section-preview absolute"
        style={`left:${left}px; top:${top}px; width:${width}px; height:${rowHeight}px;`}
    >
        <Plus width={24} height={24} class="pointer-events-none" />
    </div>
{/if}

<!-- Renders all sections belonging to a single note channel on its row -->
{#each channel.sections as section, sIdx}
    <NoteSection
        {section}
        instrument={channel.instrument}
        channelIndex={index}
        sectionIndex={sIdx}
        {rowHeight}
    />
{/each}

<style>
    .new-section-preview {
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        border: 2px dashed rgba(16, 185, 129, 0.75);
        background: rgba(16, 185, 129, 0.18);
        color: rgba(16, 185, 129, 0.9);
        font-weight: 600;
        z-index: 5;
        transition: opacity 120ms ease;
    }
</style>
