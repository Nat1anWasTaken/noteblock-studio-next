<script lang="ts">
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import type { NoteSection } from '$lib/types';

    interface Props {
        section: NoteSection;
        channelIndex: number; // 0-based
        sectionIndex: number; // 0-based within channel
        rowHeight?: number; // px
    }

    let { section, channelIndex, sectionIndex, rowHeight = 72 }: Props = $props();

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

    const selected = $derived(
        Boolean(
            editorState.selectedSections.find(
                (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
            )
        )
    );

    const borderClass = $derived(selected ? 'border-foreground border-3' : 'border-emerald-700/60');

    // Shears hover tick for this section (absolute tick -> local px)
    const shearsHoverTick = $derived(
        editorMouse.shearsHover &&
            editorState.pointerMode === PointerMode.Shears &&
            editorMouse.shearsHover.channelIndex === channelIndex &&
            editorMouse.shearsHover.sectionIndex === sectionIndex
            ? editorMouse.shearsHover.tick
            : null
    );

    const _ppt = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );

    const shearsHoverLeft = $derived(
        shearsHoverTick !== null
            ? Math.round((shearsHoverTick - (section.startingTick ?? 0)) * _ppt)
            : null
    );

    function onPointerDown(ev: PointerEvent) {
        // Dispatch based on current pointer mode
        if (editorState.pointerMode === PointerMode.Shears) {
            editorMouse.handleSectionShearsPointerDown(
                channelIndex,
                sectionIndex,
                section,
                null,
                ev
            );
        } else {
            // Default behavior (normal mode) handled by centralized controller
            editorMouse.handleSectionPointerDown(channelIndex, sectionIndex, section, null, ev);
        }
    }
</script>

<!-- Simple visual block for a note section; color tokens are placeholders -->
<div
    class="absolute z-10 overflow-hidden rounded-md border {borderClass} bg-emerald-600/90 text-xs shadow-sm select-none"
    style={`left:${left}px; top:${top}px; width:${width}px; height:${height}px;`}
    onpointerdown={onPointerDown}
    onpointermove={(ev) =>
        editorMouse.handleSectionPointerMove(channelIndex, sectionIndex, section, null, ev)}
    onpointerleave={() => editorMouse.handleSectionPointerLeave(channelIndex, sectionIndex)}
>
    <!-- Header strip with section name -->
    <div class="w-full truncate bg-emerald-200/80 px-2 py-1 font-medium text-emerald-900">
        {section.name}
    </div>

    {#if shearsHoverLeft !== null}
        <div
            class="pointer-events-none absolute top-0 h-full w-px bg-white/90"
            style={`left:${shearsHoverLeft}px;`}
        ></div>
    {/if}

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
