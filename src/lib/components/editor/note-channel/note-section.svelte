<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import type { NoteSection } from '$lib/types';

    interface Props {
        section: NoteSection;
        channelIndex: number; // 0-based
        rowHeight?: number; // px
        selected?: boolean; // highlight style (not implemented)
    }

    let { section, channelIndex, rowHeight = 72, selected = false }: Props = $props();

    const left = $derived(
        section.startingTick *
            (editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0)
    );
    const width = $derived(
        Math.max(
            1,
            section.length *
                (editorState.ticksPerBeat > 0
                    ? editorState.pxPerBeat / editorState.ticksPerBeat
                    : 0)
        )
    );
    const top = $derived(channelIndex * rowHeight);
    const height = $derived(Math.max(0, rowHeight));

    // Notes placement
    const headerHeight = 24; // keep in sync with header padding
    const bodyHeight = $derived(Math.max(0, rowHeight - headerHeight));
    const minKey = $derived(
        section.notes?.length ? Math.min(...section.notes.map((n) => n.key)) : 0
    );
    const maxKey = $derived(
        section.notes?.length ? Math.max(...section.notes.map((n) => n.key)) : 0
    );
    const keySpan = $derived(Math.max(1, Number(maxKey) - Number(minKey)));

    const borderClass = $derived(selected ? 'border-foreground border-3' : 'border-emerald-700/60');
</script>

<!-- Simple visual block for a note section; color tokens are placeholders -->
<div
    class="absolute z-10 overflow-hidden rounded-md border {borderClass} bg-emerald-600/90 text-xs shadow-sm select-none"
    style={`left:${left}px; top:${top}px; width:${width}px; height:${height}px;`}
>
    <!-- Header strip with section name -->
    <div class="w-full truncate bg-emerald-200/80 px-2 py-1 font-medium text-emerald-900">
        {section.name}
    </div>

    <!-- Notes area -->
    <div class="relative h-[calc(100%-1.5rem)] w-full">
        {#if section.notes?.length}
            {#each section.notes as n}
                {@const yNorm = keySpan === 0 ? 0.5 : (maxKey - n.key) / keySpan}
                {@const noteTop = Math.max(0, Math.round(yNorm * Math.max(0, bodyHeight - 4)))}
                {@const _ppt =
                    editorState.ticksPerBeat > 0
                        ? editorState.pxPerBeat / editorState.ticksPerBeat
                        : 0}
                {@const noteLeft = Math.max(0, n.tick * _ppt)}
                {@const noteWidth = Math.max(3, Math.round(_ppt * 2))}
                <div
                    class="absolute rounded-sm bg-white/90"
                    style={`left:${noteLeft}px; top:${noteTop}px; width:${noteWidth}px; height:4px;`}
                ></div>
            {/each}
        {/if}
    </div>
</div>
