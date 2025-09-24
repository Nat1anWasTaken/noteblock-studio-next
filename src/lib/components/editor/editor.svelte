<script lang="ts">
    import { clipboard } from '$lib/clipboard.svelte';
    import { commandManager } from '$lib/command-manager';
    import * as Resizable from '$lib/components/ui/resizable';
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { historyManager } from '$lib/history';
    import { player } from '$lib/playback.svelte';
    import type { NoteSection } from '$lib/types';
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import CommandPalette from './command-palette.svelte';
    import EditorHeader from './editor-header.svelte';
    import MouseWindowEvents from './mouse-window-events.svelte';
    import NoteChannelInfo from './note-channel/note-channel-info.svelte';
    import NoteChannel from './note-channel/note-channel.svelte';
    import NotePianoRoll from './note-channel/note-piano-roll.svelte';
    import PlayheadCursor from './playhead-cursor.svelte';
    import RulerRow from './ruler-row.svelte';
    import SelectionOverlay from './selection-overlay.svelte';
    import TempoChannelInfo from './tempo-channel/tempo-channel-info.svelte';
    import TempoChannel from './tempo-channel/tempo-channel.svelte';
    import TimelineGrid from './timeline-grid.svelte';

    const gutterWidth = 240;

    let channelScroller = $state<HTMLDivElement | null>(null);
    let channelInfosContainer = $state<HTMLDivElement | null>(null);
    let timelineContentEl = $state<HTMLDivElement | null>(null);

    // Throttled scroll handlers to prevent excessive state updates during resize
    let channelsScrollThrottled = false;
    let infosScrollThrottled = false;

    const onChannelsScroll = () => {
        if (channelsScrollThrottled) return;
        channelsScrollThrottled = true;

        requestAnimationFrame(() => {
            editorState.setScrollLeft(channelScroller?.scrollLeft ?? 0);
            editorState.setScrollTop(channelScroller?.scrollTop ?? 0);
            channelsScrollThrottled = false;
        });
    };

    const onChannelInfosScroll = () => {
        if (infosScrollThrottled) return;
        infosScrollThrottled = true;

        requestAnimationFrame(() => {
            editorState.setScrollTop(channelInfosContainer?.scrollTop ?? 0);
            infosScrollThrottled = false;
        });
    };

    // Use $effect.pre to prevent cascading reactive updates during scroll sync
    $effect.pre(() => {
        if (!channelScroller) return;

        // Batch DOM writes to prevent layout thrashing
        const scrollLeftDiff = Math.abs(channelScroller.scrollLeft - editorState.scrollLeft);
        const scrollTopDiff = Math.abs(channelScroller.scrollTop - editorState.scrollTop);

        if (scrollLeftDiff > 1 || scrollTopDiff > 1) {
            // Batch scroll updates in a single operation
            if (scrollLeftDiff > 1) channelScroller.scrollLeft = editorState.scrollLeft;
            if (scrollTopDiff > 1) channelScroller.scrollTop = editorState.scrollTop;
        }
    });

    $effect.pre(() => {
        if (!channelInfosContainer) return;
        if (Math.abs(channelInfosContainer.scrollTop - editorState.scrollTop) > 1) {
            channelInfosContainer.scrollTop = editorState.scrollTop;
        }
    });

    // Auto-follow playhead: when the cursor goes out of view, center it
    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
    const playheadContentX = $derived(player.currentTick * pxPerTick);
    // Keep about one beat of space from the left edge when auto-scrolling
    const leftPadding = $derived(
        Math.min(240, Math.max(48, Math.round(editorState.pxPerBeat * 1)))
    );

    // Cache viewport width to avoid repeated DOM reads during resize
    let cachedViewportWidth = $state(0);
    let viewportUpdateScheduled = $state(false);

    // Throttled viewport width update to reduce DOM reads during resize
    function updateViewportWidth() {
        if (viewportUpdateScheduled) return;
        viewportUpdateScheduled = true;
        requestAnimationFrame(() => {
            const scroller = channelScroller;
            if (scroller) {
                cachedViewportWidth = scroller.clientWidth;
            }
            viewportUpdateScheduled = false;
        });
    }

    // Update cached viewport width when scroller changes
    $effect(() => {
        if (channelScroller) {
            updateViewportWidth();
        }
    });

    $effect(() => {
        // Auto-scroll when playing and auto-scroll enabled, OR when zoom triggers follow cursor
        const shouldAutoScroll = (player.isPlaying && editorState.autoScrollEnabled) || editorState._shouldFollowAfterZoom;
        if (!shouldAutoScroll) return;

        const scroller = channelScroller;
        if (!scroller) return;

        // Use cached viewport width, fallback to DOM read only if cache is stale
        const viewportWidth = cachedViewportWidth || scroller.clientWidth;
        if (viewportWidth <= 0) return;

        const left = editorState.scrollLeft;
        const right = left + viewportWidth;
        const x = playheadContentX;

        const isOutOfView = x < left + 4 || x > right - 4; // small margin
        if (!isOutOfView && !editorState._shouldFollowAfterZoom) return;

        // Place playhead near the left edge (with padding), clamped to content bounds
        const desired = Math.round(x - leftPadding);
        const maxScroll = Math.max(0, editorState.contentWidth - viewportWidth);
        const clamped = Math.min(maxScroll, Math.max(0, desired));
        if (Math.abs(clamped - left) > 1) {
            editorState.setScrollLeft(clamped);
        }

        // Clear the zoom follow flag after applying
        if (editorState._shouldFollowAfterZoom) {
            editorState._shouldFollowAfterZoom = false;
        }
    });

    // Update cached viewport width on window resize
    function handleResize() {
        updateViewportWidth();
    }

    const channels = $derived(player.song?.channels ?? []);

    function computeCursorClass(): string {
        if (editorMouse.isResizingSection) return 'cursor-ew-resize';
        if (editorMouse.isScrubbing) return 'cursor-ew-resize';
        if (editorState.pointerMode === PointerMode.Shears) return 'cursor-crosshair';
        if (editorState.pointerMode === PointerMode.Merge) return 'cursor-ew-resize';
        return 'cursor-default';
    }
    const cursorClass = $derived(computeCursorClass());

    function deleteSelectedSections() {
        if (editorState.selectedSections.length === 0) return;

        const selectionsToDelete = [...editorState.selectedSections];
        player.removeSections(selectionsToDelete);
        editorState.clearSelectedSections();
    }

    function copySelectedSections() {
        if (editorState.selectedSections.length === 0) return;

        const sectionsData = editorState.selectedSections
            .map((selection) => {
                const channel = channels[selection.channelIndex];
                if (channel?.kind === 'note') {
                    const section = channel.sections[selection.sectionIndex];
                    if (section) {
                        return {
                            section,
                            channelIndex: selection.channelIndex,
                            sectionIndex: selection.sectionIndex
                        };
                    }
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (sectionsData.length > 0) {
            clipboard.copySections(sectionsData);
            toast.success(
                `Copied ${sectionsData.length} section${sectionsData.length === 1 ? '' : 's'}`
            );
        }
    }

    function cutSelectedSections() {
        if (editorState.selectedSections.length === 0) return;

        const sectionsData = editorState.selectedSections
            .map((selection) => {
                const channel = channels[selection.channelIndex];
                if (channel?.kind === 'note') {
                    const section = channel.sections[selection.sectionIndex];
                    if (section) {
                        return {
                            section,
                            channelIndex: selection.channelIndex,
                            sectionIndex: selection.sectionIndex
                        };
                    }
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (sectionsData.length > 0) {
            clipboard.cutSections(sectionsData);
            // Remove the sections after cutting
            const selectionsToDelete = [...editorState.selectedSections];
            player.removeSections(selectionsToDelete);
            editorState.clearSelectedSections();
            toast.success(
                `Cut ${sectionsData.length} section${sectionsData.length === 1 ? '' : 's'}`
            );
        }
    }

    function pasteSections() {
        const clipboardSections = clipboard.getSections();
        if (!clipboardSections || clipboardSections.length === 0) return;

        // Get current playhead position for smart pasting
        const currentTick = player.currentTick;

        // Find the earliest start tick among clipboard sections to calculate offset
        const earliestStartTick = Math.min(
            ...clipboardSections.map((item) => item.section.startingTick)
        );
        const offsetTick = currentTick - earliestStartTick;

        // Try to paste to the first available note channel, or the channel where sections were copied from
        let targetChannelIndex = 0;
        const firstNoteChannelIndex = channels.findIndex((ch) => ch.kind === 'note');
        if (firstNoteChannelIndex >= 0) {
            targetChannelIndex = firstNoteChannelIndex;
        }

        // If we have a selection, try to paste to the selected channel (but ensure it's a note channel)
        if (editorState.selectedSections.length > 0) {
            const selIdx = editorState.selectedSections[0].channelIndex;
            if (channels[selIdx] && channels[selIdx].kind === 'note') {
                targetChannelIndex = selIdx;
            } else {
                // find nearest note channel to the selected index
                const noteIndices = channels
                    .map((c, i) => (c.kind === 'note' ? i : -1))
                    .filter((i) => i >= 0);
                if (noteIndices.length > 0) {
                    let nearest = noteIndices[0];
                    let bestDist = Math.abs(nearest - selIdx);
                    for (const ni of noteIndices) {
                        const d = Math.abs(ni - selIdx);
                        if (d < bestDist) {
                            bestDist = d;
                            nearest = ni;
                        }
                    }
                    targetChannelIndex = nearest;
                }
            }
        }

        // Build a list of available note channel global indices for fallback mapping
        const noteChannelIndices = channels
            .map((c, i) => (c.kind === 'note' ? i : -1))
            .filter((i) => i >= 0);

        if (noteChannelIndices.length === 0) return; // nothing to paste into

        // Use the earliest original channel as the base so we preserve relative channel offsets
        const baseOriginalChannelIndex = Math.min(
            ...clipboardSections.map((s) => s.originalChannelIndex)
        );

        // Prepare sections for batch addition, preserving relative channel offsets
        const sectionsToAdd = clipboardSections.map((item) => {
            const relativeChannelOffset = item.originalChannelIndex - baseOriginalChannelIndex;
            let desiredIndex = targetChannelIndex + relativeChannelOffset;

            // clamp desiredIndex to valid range
            desiredIndex = Math.max(0, Math.min(desiredIndex, channels.length - 1));

            // If the desired channel is not a note channel, map to the nearest note channel
            if (!channels[desiredIndex] || channels[desiredIndex].kind !== 'note') {
                // find nearest note channel by global index
                let nearest = noteChannelIndices[0];
                let bestDist = Math.abs(nearest - desiredIndex);
                for (const ni of noteChannelIndices) {
                    const d = Math.abs(ni - desiredIndex);
                    if (d < bestDist) {
                        bestDist = d;
                        nearest = ni;
                    }
                }
                desiredIndex = nearest;
            }

            return {
                channelIndex: desiredIndex,
                section: {
                    ...item.section,
                    startingTick: Math.max(0, item.section.startingTick + offsetTick),
                    name: `${item.section.name} (Copy)`
                } as NoteSection
            };
        });

        // Use the batch addSections method for optimal performance and single history entry
        const success = player.addSections(sectionsToAdd);

        if (success) {
            toast.success(
                `Pasted ${clipboardSections.length} section${clipboardSections.length === 1 ? '' : 's'}`
            );
        } else {
            toast.error('Failed to paste sections');
        }
    }

    function selectAllSections() {
        const allSections: { channelIndex: number; sectionIndex: number }[] = [];

        channels.forEach((channel, channelIndex) => {
            if (channel.kind === 'note') {
                channel.sections.forEach((_, sectionIndex) => {
                    allSections.push({ channelIndex, sectionIndex });
                });
            }
        });

        editorState.setSelectedSections(allSections);

        if (allSections.length > 0) {
            toast.success(
                `Selected ${allSections.length} section${allSections.length === 1 ? '' : 's'}`
            );
        }
    }

    onMount(() => {
        commandManager.registerCommands([
            {
                id: 'delete-selected-sections',
                title: 'Delete Selected Sections',
                callback: deleteSelectedSections,
                shortcut: 'DELETE'
            },
            {
                id: 'delete-selected-sections-backspace',
                title: 'Delete Selected Sections (Backspace)',
                callback: deleteSelectedSections,
                shortcut: 'BACKSPACE'
            },
            {
                id: 'copy-selected-sections',
                title: 'Copy Selected Sections',
                callback: copySelectedSections,
                shortcut: 'MOD+C'
            },
            {
                id: 'cut-selected-sections',
                title: 'Cut Selected Sections',
                callback: cutSelectedSections,
                shortcut: 'MOD+X'
            },
            {
                id: 'paste-sections',
                title: 'Paste Sections',
                callback: pasteSections,
                shortcut: 'MOD+V'
            },
            {
                id: 'zoom-in',
                title: 'Zoom In',
                callback: () => editorState.zoomIn(),
                shortcut: 'MOD+='
            },
            {
                id: 'zoom-in-numpad',
                title: 'Zoom In (Numpad)',
                callback: () => editorState.zoomIn(),
                shortcut: 'MOD+ADD'
            },
            {
                id: 'zoom-out',
                title: 'Zoom Out',
                callback: () => editorState.zoomOut(),
                shortcut: 'MOD+-'
            },
            {
                id: 'zoom-out-numpad',
                title: 'Zoom Out (Numpad)',
                callback: () => editorState.zoomOut(),
                shortcut: 'MOD+SUBTRACT'
            },
            {
                id: 'select-all-sections',
                title: 'Select All Sections',
                callback: selectAllSections,
                shortcut: 'MOD+A'
            },
            {
                id: 'deselect-all-sections',
                title: 'Deselect All Sections',
                callback: () => editorState.clearSelectedSections(),
                shortcut: 'ESCAPE'
            }
        ]);

        historyManager.setContext({ player, editorState });

        return () => {
            commandManager.unregisterCommands([
                'delete-selected-sections',
                'delete-selected-sections-backspace',
                'copy-selected-sections',
                'cut-selected-sections',
                'paste-sections',
                'zoom-in',
                'zoom-in-numpad',
                'zoom-out',
                'zoom-out-numpad',
                'select-all-sections',
                'deselect-all-sections'
            ]);
        };
    });
</script>

<svelte:window onresize={handleResize} />

<div class="flex h-screen flex-col">
    <EditorHeader />

    <Resizable.PaneGroup direction="horizontal">
        <Resizable.Pane>
            <div class="relative flex h-full w-full flex-col">
                <!-- Global mouse event bridge using svelte:window -->
                <MouseWindowEvents />
                <!-- Ruler / Controls Row -->
                <RulerRow {gutterWidth} />

                <!-- Channels area with ruler-matched background -->
                <div class="flex min-h-0 flex-1 select-none">
                    <!-- Left gutter: channel infos -->
                    <div
                        bind:this={channelInfosContainer}
                        class="scrollbar-hidden relative flex shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-secondary/40"
                        style={`width:${gutterWidth}px`}
                        onscroll={onChannelInfosScroll}
                    >
                        {#if channels.length === 0}
                            <div class="px-3 py-2 text-sm text-muted-foreground">No channels</div>
                        {:else}
                            {#each channels as ch, i}
                                {#if editorMouse.dragTargetIndex === i}
                                    <!-- Container with border for drag target -->
                                    <div
                                        class="rounded border-2 border-primary"
                                        style={`height:${editorState.rowHeight}px`}
                                    >
                                        {#if ch.kind === 'note'}
                                            <NoteChannelInfo
                                                channel={ch}
                                                index={i}
                                                height={editorState.rowHeight}
                                            />
                                        {:else}
                                            <TempoChannelInfo
                                                channel={ch}
                                                index={i}
                                                height={editorState.rowHeight}
                                            />
                                        {/if}
                                    </div>
                                {:else if ch.kind === 'note'}
                                    <NoteChannelInfo
                                        channel={ch}
                                        index={i}
                                        height={editorState.rowHeight}
                                    />
                                {:else}
                                    <TempoChannelInfo
                                        channel={ch}
                                        index={i}
                                        height={editorState.rowHeight}
                                    />
                                {/if}
                            {/each}
                        {/if}
                    </div>

                    <!-- Scrollable timeline region -->
                    <div
                        bind:this={channelScroller}
                        class="flex-1 overflow-auto bg-background"
                        onscroll={onChannelsScroll}
                    >
                        <div
                            bind:this={timelineContentEl}
                            data-editor-content
                            class="relative"
                            style={`width:${editorState.contentWidth}px; min-height:${Math.max(1, channels.length) * editorState.rowHeight}px;`}
                        >
                            <!-- Blank interaction layer (under sections): click/drag to scrub time -->
                            <div
                                class={`absolute inset-0 z-0 ${cursorClass}`}
                                onpointerdown={(e) => {
                                    const contentEl = timelineContentEl as HTMLElement;
                                    if (!contentEl) return;
                                    if (editorState.pointerMode === PointerMode.Normal) {
                                        editorMouse.handleContentPointerDown(contentEl, e);
                                    } else {
                                        editorMouse.handleTimelineBlankPointerDown(contentEl, e);
                                    }
                                }}
                                onpointermove={(e) => {
                                    const contentEl = timelineContentEl as HTMLElement;
                                    if (!contentEl) return;
                                    editorMouse.handleTimelineBlankPointerMove(contentEl, e);
                                }}
                                onpointerleave={() => editorMouse.handleTimelineBlankPointerLeave()}
                                onpointercancel={() =>
                                    editorMouse.handleTimelineBlankPointerLeave()}
                                onwheel={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        e.preventDefault();
                                        if (e.deltaY < 0) {
                                            editorState.zoomIn();
                                        } else if (e.deltaY > 0) {
                                            editorState.zoomOut();
                                        }
                                    }
                                }}
                            ></div>

                            <!-- Channel row separators -->
                            {#each channels as _, i}
                                <div
                                    class="pointer-events-none absolute right-0 left-0 border-b border-border"
                                    style={`top:${(i + 1) * editorState.rowHeight}px; height:0`}
                                ></div>
                            {/each}

                            <!-- Render channel contents: note sections or tempo markers -->
                            {#each channels as ch, chIdx}
                                {#if ch.kind === 'note'}
                                    <NoteChannel
                                        channel={ch}
                                        index={chIdx}
                                        rowHeight={editorState.rowHeight}
                                    />
                                {:else}
                                    <TempoChannel
                                        channel={ch}
                                        index={chIdx}
                                        rowHeight={editorState.rowHeight}
                                    />
                                {/if}
                            {/each}

                            <!-- Selection overlay moved to top-level for single render -->
                        </div>
                    </div>
                </div>
                <!-- Single playhead overlay spanning ruler and timeline -->
                <!-- Single grid overlay spanning ruler and timeline -->
                <TimelineGrid {gutterWidth} showLabels />
                <!-- Single selection overlay spanning ruler and timeline, under cursor -->
                <SelectionOverlay {gutterWidth} />
                <PlayheadCursor {gutterWidth} />
                {#if editorMouse.dragGhost}
                    {#if channelInfosContainer}
                        <!-- Use the real channel info component as the ghost (reduced opacity) -->
                        <div
                            class="pointer-events-none absolute z-40 w-[240px] opacity-80"
                            style={`left:0px; top:${
                                editorMouse.dragGhostClientY
                                    ? editorMouse.dragGhostClientY -
                                      channelInfosContainer.getBoundingClientRect().top +
                                      'px'
                                    : '-9999px'
                            };`}
                        >
                            {#if editorMouse.dragGhostChannel && editorMouse.dragGhost.kind === 'note'}
                                <NoteChannelInfo
                                    channel={editorMouse.dragGhostChannel as any}
                                    index={-1}
                                    height={editorState.rowHeight}
                                />
                            {:else if editorMouse.dragGhostChannel}
                                <TempoChannelInfo
                                    channel={editorMouse.dragGhostChannel as any}
                                    index={-1}
                                    height={editorState.rowHeight}
                                />
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>
        </Resizable.Pane>
    </Resizable.PaneGroup>
</div>

<NotePianoRoll />

<CommandPalette />

<style>
    .scrollbar-hidden::-webkit-scrollbar {
        width: 0px;
    }
    .scrollbar-hidden::-webkit-scrollbar-thumb {
        background: transparent;
    }
    .scrollbar-hidden::-webkit-scrollbar-track {
        background: transparent;
    }
</style>
