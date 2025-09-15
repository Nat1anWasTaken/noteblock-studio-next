<script lang="ts">
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import type { Instrument, NoteSection } from '$lib/types';
    import { onMount } from 'svelte';

    interface Props {
        section: NoteSection;
        channelIndex: number; // 0-based
        sectionIndex: number; // 0-based within channel
        rowHeight?: number; // px
        instrument: Instrument;
    }

    let { section, channelIndex, sectionIndex, rowHeight = 72, instrument }: Props = $props();

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

    // Merge hover detection: this component may be the primary (hover target)
    // or the secondary (the next section to be merged).
    const mergeHoverPrimary = $derived(
        editorMouse.mergeHover &&
            editorState.pointerMode === PointerMode.Merge &&
            editorMouse.mergeHover.channelIndex === channelIndex &&
            editorMouse.mergeHover.sectionIndex === sectionIndex
            ? true
            : false
    );
    const mergeHoverSecondary = $derived(
        editorMouse.mergeHover &&
            editorState.pointerMode === PointerMode.Merge &&
            editorMouse.mergeHover.channelIndex === channelIndex &&
            editorMouse.mergeHover.sectionIndex === sectionIndex - 1
            ? true
            : false
    );

    const borderClass = $derived(
        mergeHoverPrimary || mergeHoverSecondary
            ? 'border-amber-500 border-3'
            : selected
              ? 'border-foreground border-3'
              : 'border-emerald-700/60'
    );

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

    let root: HTMLDivElement | null = null;

    function onPointerDown(ev: PointerEvent) {
        // Dispatch based on current pointer mode
        if (editorState.pointerMode === PointerMode.Shears) {
            editorMouse.handleSectionShearsPointerDown(channelIndex, sectionIndex, null, ev);
        } else if (editorState.pointerMode === PointerMode.Merge) {
            editorMouse.handleSectionMergePointerDown(channelIndex, sectionIndex, null, ev);
        } else {
            // Default behavior (normal mode) handled by centralized controller
            editorMouse.handleSectionPointerDown(channelIndex, sectionIndex, section, null, ev);
        }
    }

    // DOM-based highlight handling (no Svelte stores)
    // Behavior:
    //  - On "noteplayed": apply an immediate class that shows the active color instantly.
    //  - On "noteended": remove the immediate class, then add a fade class which
    //    transitions the color back to the normal state. Remove the fade class after
    //    the transition finishes to keep DOM clean.
    function handleNotePlayed(e: CustomEvent) {
        const id = e.detail?.id;
        if (!id || !root) return;
        const nodes = root.querySelectorAll<HTMLElement>(`[data-note-id="${id}"]`);
        nodes.forEach((n) => {
            // Ensure any pending fade is cleared
            n.classList.remove('note-playing-fade');
            // Apply immediate visual (no transition)
            n.classList.add('note-playing-immediate');
        });
    }

    function handleNoteEnded(e: CustomEvent) {
        const id = e.detail?.id;
        if (!id || !root) return;
        const nodes = root.querySelectorAll<HTMLElement>(`[data-note-id="${id}"]`);
        nodes.forEach((n) => {
            // Remove immediate state first so the element currently shows the "played" color.
            n.classList.remove('note-playing-immediate');
            // Force a reflow so the browser registers the style change before we add the fade class
            // which will transition from the current (played) color to the default.
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            n.offsetHeight;
            // Add fade class which transitions properties back to normal
            n.classList.add('note-playing-fade');
            // Cleanup: remove the fade class after transition duration (match CSS below)
            const CLEANUP_MS = 260;
            const idKey = (n as any).__fadeCleanupId;
            if (idKey) clearTimeout(idKey);
            (n as any).__fadeCleanupId = setTimeout(() => {
                n.classList.remove('note-playing-fade');
                try {
                    delete (n as any).__fadeCleanupId;
                } catch {}
            }, CLEANUP_MS);
        });
    }

    onMount(() => {
        if (typeof document === 'undefined') return;
        document.addEventListener('noteplayed', handleNotePlayed as EventListener);
        document.addEventListener('noteended', handleNoteEnded as EventListener);
        return () => {
            document.removeEventListener('noteplayed', handleNotePlayed as EventListener);
            document.removeEventListener('noteended', handleNoteEnded as EventListener);
        };
    });
</script>

<!-- Simple visual block for a note section; color tokens are placeholders -->
<div
    bind:this={root}
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
                    data-note-id={`${section.startingTick + n.tick}:${n.key}:${instrument}`}
                    class="note-rect absolute rounded-sm bg-white/90"
                    style={`left:${noteLeft}px; top:${noteTop}px; width:${noteWidth}px; height:4px;`}
                ></div>
            {/each}
        {/if}
    </div>
</div>

<style>
    /* Fade-on-end highlight behavior:
     - `.note-playing-immediate`: applied immediately when note starts (no transition, strong color).
     - `.note-playing-fade`: applied after note ends; transitions back to normal smoothly.
     - Base `.note-rect` contains the normal appearance. */

    .note-rect {
        transition:
            background-color 240ms ease,
            box-shadow 240ms ease,
            transform 160ms ease,
            opacity 240ms ease;
        will-change: background-color, box-shadow, transform, opacity;
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.9);
        box-shadow: none;
        transform: none;
    }

    /* Immediate visual when note starts. No transition so it changes instantly. */
    .note-rect.note-playing-immediate {
        transition: none !important;
        background-color: rgba(0, 160, 255, 0.95);
        box-shadow: 0 10px 28px rgba(0, 160, 255, 0.28);
        transform: scaleY(1.2);
        z-index: 40;
        opacity: 1;
    }

    /* Fade class: when applied, element will transition from the current (played) look
     back to the base appearance defined on .note-rect because .note-playing-fade sets
     the target (normal) values and .note-rect defines the transition. */
    .note-rect.note-playing-fade {
        /* Target values (normal) so the transitions animate towards these */
        background-color: rgba(255, 255, 255, 0.9);
        box-shadow: none;
        transform: none;
        z-index: 20;
        opacity: 1;
    }
</style>
