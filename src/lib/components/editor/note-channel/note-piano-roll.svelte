<script lang="ts">
    import { commandManager } from '$lib/command-manager';
    import * as Sheet from '$lib/components/ui/sheet';
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { pianoRollMouse } from '$lib/piano-roll-mouse.svelte';
    import { pianoRollState } from '$lib/piano-roll-state.svelte';
    import { player } from '$lib/playback.svelte';
    import { onDestroy, onMount } from 'svelte';
    import PlayheadCursor from '../playhead-cursor.svelte';
    import RulerShell from '../ruler-shell.svelte';
    import SelectionRectangleOverlay from '../selection-rectangle-overlay.svelte';
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

    // Mouse controller is now stateless - all state managed by pianoRollState
    $effect(() => {
        pianoRollMouse.setPianoRollState(pianoRollState);
    });

    $effect(() => {
        pianoRollState.isMouseActive = pianoRollState.sheetOpen;
    });

    $effect(() => {
        if (!pianoRollState.sheetOpen) {
            pianoRollState.pointerMode = PointerMode.Normal;
        }
    });

    // DOM-based highlight handling
    function handleNotePlayed(e: CustomEvent) {
        const id = e.detail?.id;
        if (!id) return;
        const nodes = document.querySelectorAll<HTMLElement>(`[data-note-id="${id}"]`);
        nodes.forEach((n) => {
            n.classList.remove('note-playing-fade');
            n.classList.add('note-playing-immediate');
        });
    }

    function handleNoteEnded(e: CustomEvent) {
        const id = e.detail?.id;
        if (!id) return;
        const nodes = document.querySelectorAll<HTMLElement>(`[data-note-id="${id}"]`);
        nodes.forEach((n) => {
            n.classList.remove('note-playing-immediate');
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            n.offsetHeight;
            n.classList.add('note-playing-fade');
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

    let releasePianoRollScope: (() => void) | null = null;

    $effect(() => {
        if (pianoRollState.sheetOpen) {
            if (!releasePianoRollScope) {
                releasePianoRollScope = commandManager.enterScope('piano-roll');
            }
        } else if (releasePianoRollScope) {
            releasePianoRollScope();
            releasePianoRollScope = null;
        }
    });

    onDestroy(() => {
        if (releasePianoRollScope) {
            releasePianoRollScope();
            releasePianoRollScope = null;
        }
    });

    onMount(() => {
        if (typeof document === 'undefined') return;

        // Register piano roll commands
        commandManager.registerCommands([
            {
                id: 'piano-roll-delete-selected-notes',
                title: 'Delete Selected Notes',
                shortcut: 'DELETE',
                callback: () => pianoRollMouse.deleteSelectedNotes(),
                scope: 'piano-roll'
            },
            {
                id: 'piano-roll-backspace-selected-notes',
                title: 'Delete Selected Notes',
                shortcut: 'BACKSPACE',
                callback: () => pianoRollMouse.deleteSelectedNotes(),
                scope: 'piano-roll'
            }
        ]);

        document.addEventListener('noteplayed', handleNotePlayed as EventListener);
        document.addEventListener('noteended', handleNoteEnded as EventListener);

        return () => {
            // Clean up commands
            commandManager.unregisterCommands([
                'piano-roll-delete-selected-notes',
                'piano-roll-backspace-selected-notes'
            ]);

            document.removeEventListener('noteplayed', handleNotePlayed as EventListener);
            document.removeEventListener('noteended', handleNoteEnded as EventListener);
        };
    });

    const playheadContentX = $derived.by(() => {
        if (!pianoRollState.sectionData) return 0;
        const relativeTick = player.currentTick - pianoRollState.sectionStartTick;
        return Math.max(0, relativeTick * pianoRollState.pxPerTick);
    });

    const leftPadding = $derived(
        Math.min(240, Math.max(48, Math.round(editorState.pxPerBeat * 1)))
    );

    $effect(() => {
        const scroller = pianoRollState.gridScroller;
        if (!scroller || !pianoRollState.sheetOpen) return;
        const viewportWidth = scroller.clientWidth;
        if (viewportWidth <= 0) return;

        const left = pianoRollState.gridScrollLeft;
        const right = left + viewportWidth;
        const x = playheadContentX;

        if (!player.isPlaying || !editorState.autoScrollEnabled) return;

        if (!pianoRollState.cursorVisible) return;

        const isOutOfView = x < left + 4 || x > right - 4;
        if (!isOutOfView) return;

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

                <div class="relative flex flex-1 flex-col overflow-hidden">
                    <RulerShell
                        class="items-center border-b-4 border-border bg-secondary/20 text-sm"
                        gutterWidth={96}
                        contentWidth={Math.ceil(
                            pianoRollState.sectionBeatLength / pianoRollState.beatsPerBar
                        ) * pianoRollState.barWidth}
                        scrollLeft={pianoRollState.gridScrollLeft}
                        pointerDownHandler={(container, event) => {
                            const relativeTick = editorMouse.tickFromClientX(
                                container,
                                event.clientX
                            );
                            const absoluteTick = pianoRollState.sectionStartTick + relativeTick;
                            player.setCurrentTick(absoluteTick);
                        }}
                        gutter={pianoRollRulerGutter}
                        on:scrollLeftChange={(event) =>
                            pianoRollState.handleRulerScrollLeft(event.detail)}
                    >
                        <TimelineGrid
                            class="z-0"
                            gutterWidth={0}
                            contentWidth={Math.ceil(
                                pianoRollState.sectionBeatLength / pianoRollState.beatsPerBar
                            ) * pianoRollState.barWidth}
                            scrollLeft={0}
                            barWidth={pianoRollState.barWidth}
                            totalBars={Math.ceil(
                                pianoRollState.sectionBeatLength / pianoRollState.beatsPerBar
                            )}
                            beatsPerBar={pianoRollState.beatsPerBar}
                            pxPerBeat={editorState.pxPerBeat}
                            startBar={pianoRollState.sectionStartBar}
                            ticksPerBeat={pianoRollState.ticksPerBeat}
                            pxPerTick={pianoRollState.pxPerTick}
                            showTickLines={true}
                            showLabels
                        />
                    </RulerShell>

                    <div class="flex flex-1 overflow-hidden">
                        <div class="flex w-24 flex-col border-r border-border/50 bg-muted/40">
                            <div
                                class="scrollbar-hidden flex-1 overflow-auto"
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
                                            class={`flex items-center justify-end pr-3 text-xs ${row.isBlack ? 'bg-muted/70 text-muted-foreground' : 'bg-background'} ${!row.isMinecraftRange ? 'opacity-40' : ''} ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'} ${row.isOctaveBoundary ? 'border-b-2 border-b-primary/20' : ''}`}
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
                                    style={`width:${Math.ceil(pianoRollState.sectionBeatLength / pianoRollState.beatsPerBar) * pianoRollState.barWidth}px; height:${pianoRollState.gridHeight}px;`}
                                    onpointerdown={pianoRollMouse.handleBackgroundPointerDown}
                                    onpointermove={pianoRollMouse.handleGridPointerMove}
                                    onpointerup={pianoRollMouse.handleGridPointerUp}
                                    onpointercancel={pianoRollMouse.handleGridPointerCancel}
                                >
                                    <TimelineGrid
                                        gutterWidth={0}
                                        class="z-10"
                                        contentWidth={Math.ceil(
                                            pianoRollState.sectionBeatLength /
                                                pianoRollState.beatsPerBar
                                        ) * pianoRollState.barWidth}
                                        scrollLeft={0}
                                        barWidth={pianoRollState.barWidth}
                                        totalBars={Math.ceil(
                                            pianoRollState.sectionBeatLength /
                                                pianoRollState.beatsPerBar
                                        )}
                                        beatsPerBar={pianoRollState.beatsPerBar}
                                        pxPerBeat={editorState.pxPerBeat}
                                        startBar={pianoRollState.sectionStartBar}
                                        ticksPerBeat={pianoRollState.ticksPerBeat}
                                        pxPerTick={pianoRollState.pxPerTick}
                                        showTickLines={true}
                                    />

                                    {#each pianoRollState.keyRows as row, index}
                                        <div
                                            class={`${row.isBlack ? 'bg-muted/60' : 'bg-background'} ${!row.isMinecraftRange ? 'opacity-40' : ''} absolute right-0 left-0 ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'} ${row.isOctaveBoundary ? 'border-b-2 border-b-primary/20' : ''}`}
                                            style={`top:${index * pianoRollState.keyHeight}px; height:${pianoRollState.keyHeight}px;`}
                                        ></div>
                                    {/each}

                                    {#each pianoRollState.notesToRender as note}
                                        <div
                                            data-note-id={`${pianoRollState.sectionStartTick + note.note.tick}:${note.note.key}:${pianoRollState.sectionData?.channel.instrument ?? 'note'}`}
                                            class={`note-rect absolute z-30 rounded-sm border ${
                                                note.selected
                                                    ? 'scale-105 transform border-yellow-400 bg-yellow-500 text-primary-foreground shadow-2xl ring-4 ring-yellow-400/60 ring-offset-2 ring-offset-background'
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
                                </div>
                            </div>
                            {#if pianoRollState.pointerMode === PointerMode.Normal}
                                <SelectionRectangleOverlay
                                    rect={pianoRollState.selectionOverlayRect}
                                    scrollLeft={pianoRollState.gridScrollLeft}
                                    scrollTop={pianoRollState.gridScrollTop}
                                />
                            {/if}
                        </div>
                    </div>
                    <!-- Playhead cursor that spans both ruler and grid areas -->
                    <PlayheadCursor
                        gutterWidth={96}
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

    .scrollbar-hidden::-webkit-scrollbar {
        display: none;
    }

    .scrollbar-hidden {
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    /* Fade-on-end highlight behavior:
     - `.note-playing-immediate`: applied immediately when note starts (no transition, strong color).
     - `.note-playing-fade`: applied after note ends; transitions back to normal smoothly.
     - Base `.note-rect` contains the normal appearance. */

    .note-rect {
        will-change: background-color, border-color;
    }

    /* Immediate visual when note starts. No transition so it changes instantly. */
    .note-rect.note-playing-immediate {
        transition: none !important;
        background-color: rgba(0, 160, 255, 0.95) !important;
        border-color: rgba(0, 160, 255, 0.7) !important;
    }

    /* Fade class: transitions from played color back to normal */
    .note-rect.note-playing-fade {
        transition:
            background-color 240ms ease,
            border-color 240ms ease;
        /* Let the transition happen naturally to the element's original styles */
    }
</style>
