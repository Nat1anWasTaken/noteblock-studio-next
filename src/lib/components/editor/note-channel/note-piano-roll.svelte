<script lang="ts">
    import * as Sheet from '$lib/components/ui/sheet';
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { pianoRollMouse } from '$lib/piano-roll-mouse.svelte';
    import { pianoRollState } from '$lib/piano-roll-state.svelte';
    import { player } from '$lib/playback.svelte';
    import PlayheadCursor from '../playhead-cursor.svelte';
    import RulerShell from '../ruler-shell.svelte';
    import TimelineGrid from '../timeline-grid.svelte';
    import PianoRollHeader from './piano-roll-header.svelte';
    import PianoRollMouseWindowEvents from './piano-roll-mouse-window-events.svelte';

    $effect(() => {
        pianoRollState.sheetOpen = pianoRollState.pianoRollTarget !== null;
    });

    $effect(() => {
        if (!pianoRollState.sheetOpen && pianoRollState.pianoRollTarget) {
            editorState.closePianoRoll();
        }
    });

    $effect(() => {
        if (pianoRollState.pianoRollTarget && !pianoRollState.sectionData) {
            editorState.closePianoRoll();
            pianoRollState.sheetOpen = false;
        }
    });

    $effect(() => {
        const grid = pianoRollState.gridScroller;
        if (!grid) return;
        if (Math.abs(grid.scrollLeft - pianoRollState.gridScrollLeft) > 1) {
            grid.scrollLeft = pianoRollState.gridScrollLeft;
        }
    });

    $effect(() => {
        pianoRollMouse.setGridContent(pianoRollState.gridContent);
    });

    $effect(() => {
        pianoRollMouse.setSection(pianoRollState.sectionData?.section ?? null);
    });

    $effect(() => {
        pianoRollMouse.updateGeometry({
            pxPerTick: pianoRollState.pxPerTick > 0 ? pianoRollState.pxPerTick : 1,
            keyRange: pianoRollState.keyRange,
            keyHeight: pianoRollState.keyHeight
        });
    });

    $effect(() => {
        pianoRollMouse.setActive(pianoRollState.sheetOpen);
    });

    $effect(() => {
        pianoRollMouse.setPointerMode(pianoRollState.pointerMode);
    });

    $effect(() => {
        if (!pianoRollState.sheetOpen) {
            pianoRollState.pointerMode = PointerMode.Normal;
        }
    });

    // Auto-follow playhead in piano roll
    const playheadContentX = $derived.by(() => {
        if (!pianoRollState.sectionData) return 0;
        const relativeTick = player.currentTick - pianoRollState.sectionStartTick;
        return Math.max(0, relativeTick * pianoRollState.pxPerTick);
    });

    // Keep about one beat of space from the left edge when auto-scrolling
    const leftPadding = $derived(
        Math.min(240, Math.max(48, Math.round(editorState.pxPerBeat * 1)))
    );

    $effect(() => {
        // Re-run when playhead moves or viewport changes
        const scroller = pianoRollState.gridScroller;
        if (!scroller || !pianoRollState.sheetOpen) return;
        const viewportWidth = scroller.clientWidth;
        if (viewportWidth <= 0) return;

        const left = pianoRollState.gridScrollLeft;
        const right = left + viewportWidth;
        const x = playheadContentX;

        // Only auto-scroll while playing and enabled to avoid fighting manual seeks
        if (!player.isPlaying || !editorState.autoScrollEnabled) return;

        // Only auto-scroll if playhead is within this section
        if (!pianoRollState.cursorVisible) return;

        const isOutOfView = x < left + 4 || x > right - 4; // small margin
        if (!isOutOfView) return;

        // Place playhead near the left edge (with padding), clamped to content bounds
        const desired = Math.round(x - leftPadding);
        const maxScroll = Math.max(0, pianoRollState.contentWidth - viewportWidth);
        const clamped = Math.min(maxScroll, Math.max(0, desired));
        if (Math.abs(clamped - left) > 1) {
            pianoRollState.gridScrollLeft = clamped;
        }
    });
</script>

{#snippet pianoRollRulerGutter()}
    <span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Keys</span>
{/snippet}

<PianoRollMouseWindowEvents />

<Sheet.Root bind:open={pianoRollState.sheetOpen}>
    <Sheet.Content
        side="bottom"
        class="h-[70vh] w-full max-w-none border-t border-border bg-background"
    >
        {#if pianoRollState.sectionData}
            <div class="flex h-full flex-col">
                <PianoRollHeader
                    sectionData={pianoRollState.sectionData}
                    sectionBeatLength={pianoRollState.sectionBeatLength}
                />

                <div class="flex flex-1 flex-col overflow-hidden">
                    <RulerShell
                        class="items-center border-b border-border bg-secondary/40 text-sm"
                        gutterWidth={96}
                        contentWidth={pianoRollState.contentWidth}
                        scrollLeft={pianoRollState.gridScrollLeft}
                        pointerDownHandler={(container, event) =>
                            editorMouse.handleRulerPointerDown(container, event)}
                        gutter={pianoRollRulerGutter}
                        on:scrollLeftChange={(event) =>
                            pianoRollState.handleRulerScrollLeft(event.detail)}
                    >
                        <TimelineGrid
                            class="z-0"
                            gutterWidth={0}
                            contentWidth={pianoRollState.contentWidth}
                            scrollLeft={0}
                            barWidth={pianoRollState.barWidth}
                            totalBars={pianoRollState.totalBars}
                            beatsPerBar={pianoRollState.beatsPerBar}
                            pxPerBeat={editorState.pxPerBeat}
                            showLabels
                        />
                    </RulerShell>

                    <div class="flex flex-1 overflow-hidden">
                        <div class="flex w-24 flex-col border-r border-border/50 bg-muted/40">
                            <div
                                class="scrollbar-fade flex-1 overflow-auto"
                                bind:this={pianoRollState.keysScroller}
                                onwheel={(event) => {
                                    const grid = pianoRollState.gridScroller;
                                    if (!grid) return;
                                    grid.scrollBy({ left: event.deltaX, top: event.deltaY });
                                    event.preventDefault();
                                }}
                            >
                                <div
                                    class="flex flex-col"
                                    style={`height:${pianoRollState.gridHeight}px;`}
                                >
                                    {#each pianoRollState.keyRows as row, index}
                                        <div
                                            class={`flex items-center justify-end pr-3 text-xs ${row.isBlack ? 'bg-muted/70 text-muted-foreground' : 'bg-background'} ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                            style={`height:${pianoRollState.keyHeight}px;`}
                                        >
                                            {row.label}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        </div>

                        <div class="relative flex-1 overflow-hidden bg-muted/20">
                            <div
                                class="relative h-full w-full overflow-auto"
                                bind:this={pianoRollState.gridScroller}
                                onscroll={pianoRollState.handleGridScroll}
                            >
                                <div
                                    bind:this={pianoRollState.gridContent}
                                    class="relative"
                                    style={`width:${pianoRollState.contentWidth}px; height:${pianoRollState.gridHeight}px;`}
                                    onpointerdown={pianoRollMouse.handleBackgroundPointerDown}
                                >
                                    <TimelineGrid
                                        gutterWidth={0}
                                        class="z-10"
                                        contentWidth={pianoRollState.contentWidth}
                                        scrollLeft={0}
                                        barWidth={pianoRollState.barWidth}
                                        totalBars={pianoRollState.totalBars}
                                        beatsPerBar={pianoRollState.beatsPerBar}
                                        pxPerBeat={editorState.pxPerBeat}
                                    />

                                    {#each pianoRollState.keyRows as row, index}
                                        <div
                                            class={`${row.isBlack ? 'bg-muted/60' : 'bg-background'} absolute right-0 left-0 ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                            style={`top:${index * pianoRollState.keyHeight}px; height:${pianoRollState.keyHeight}px;`}
                                        ></div>
                                    {/each}

                                    {#each pianoRollState.notesToRender as note}
                                        <div
                                            data-note-id={`${pianoRollState.sectionStartTick + note.note.tick}:${note.note.key}:${pianoRollState.sectionData?.channel.instrument ?? 'note'}`}
                                            class={`absolute z-30 rounded-sm border ${
                                                note.selected
                                                    ? 'border-white/70 bg-primary text-primary-foreground shadow-lg'
                                                    : 'border-primary/30 bg-primary/80 shadow-sm'
                                            }`}
                                            style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${note.height}px;`}
                                            onpointerdown={(event) =>
                                                pianoRollMouse.handleNotePointerDown(
                                                    note.note,
                                                    event
                                                )}
                                        ></div>
                                    {/each}

                                    {#if pianoRollMouse.selectionBox}
                                        {@const box = pianoRollMouse.selectionBox}
                                        {@const px =
                                            pianoRollState.pxPerTick > 0
                                                ? pianoRollState.pxPerTick
                                                : 1}
                                        {@const tickStart = Math.min(
                                            box.startTick,
                                            box.currentTick
                                        )}
                                        {@const tickEnd =
                                            Math.max(box.startTick, box.currentTick) + 1}
                                        {@const keyTop = Math.max(box.startKey, box.currentKey)}
                                        {@const keyBottom = Math.min(box.startKey, box.currentKey)}
                                        {@const left = Math.round(tickStart * px)}
                                        {@const right = Math.round(tickEnd * px)}
                                        {@const top =
                                            (pianoRollState.keyRange.max - keyTop) *
                                            pianoRollState.keyHeight}
                                        {@const bottom =
                                            (pianoRollState.keyRange.max - keyBottom + 1) *
                                            pianoRollState.keyHeight}
                                        <div
                                            class="pointer-events-none absolute z-20 border-2 border-indigo-400/70 bg-indigo-500/10"
                                            style={`left:${Math.min(left, right)}px; top:${Math.min(top, bottom)}px; width:${Math.max(1, Math.abs(right - left))}px; height:${Math.max(1, Math.abs(bottom - top))}px;`}
                                        ></div>
                                    {/if}
                                </div>
                            </div>
                            <PlayheadCursor
                                gutterWidth={0}
                                class="z-40"
                                scrollLeft={pianoRollState.gridScrollLeft}
                                pxPerTick={pianoRollState.pxPerTick > 0
                                    ? pianoRollState.pxPerTick
                                    : 1}
                                currentTick={pianoRollState.cursorTick}
                                tickOffset={pianoRollState.sectionStartTick}
                                visible={pianoRollState.cursorVisible}
                            />
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>

<style>
    .scrollbar-fade::-webkit-scrollbar {
        width: 6px;
    }

    .scrollbar-fade::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollbar-fade::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.35);
        border-radius: 9999px;
    }

    .scrollbar-fade {
        scrollbar-width: thin;
    }
</style>
