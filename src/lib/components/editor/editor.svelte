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

    let channelScroller: HTMLDivElement | null = null;
    let channelInfosContainer: HTMLDivElement | null = null;
    let timelineContentEl: HTMLDivElement | null = null;

    const onChannelsScroll = () => {
        editorState.setScrollLeft(channelScroller?.scrollLeft ?? 0);
        editorState.setScrollTop(channelScroller?.scrollTop ?? 0);
    };

    const onChannelInfosScroll = () => {
        editorState.setScrollTop(channelInfosContainer?.scrollTop ?? 0);
    };

    $effect(() => {
        if (!channelScroller) return;
        if (Math.abs(channelScroller.scrollLeft - editorState.scrollLeft) > 1) {
            channelScroller.scrollLeft = editorState.scrollLeft;
        }
        if (Math.abs(channelScroller.scrollTop - editorState.scrollTop) > 1) {
            channelScroller.scrollTop = editorState.scrollTop;
        }
    });

    $effect(() => {
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
    $effect(() => {
        // Re-run when playhead moves or viewport changes
        const scroller = channelScroller;
        if (!scroller) return;
        const viewportWidth = scroller.clientWidth;
        if (viewportWidth <= 0) return;

        const left = editorState.scrollLeft;
        const right = left + viewportWidth;
        const x = playheadContentX;

        // Only auto-scroll while playing and enabled to avoid fighting manual seeks
        if (!player.isPlaying || !editorState.autoScrollEnabled) return;

        const isOutOfView = x < left + 4 || x > right - 4; // small margin
        if (!isOutOfView) return;

        // Place playhead near the left edge (with padding), clamped to content bounds
        const desired = Math.round(x - leftPadding);
        const maxScroll = Math.max(0, editorState.contentWidth - viewportWidth);
        const clamped = Math.min(maxScroll, Math.max(0, desired));
        if (Math.abs(clamped - left) > 1) {
            editorState.setScrollLeft(clamped);
        }
    });

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

        // If we have a selection, try to paste to the selected channel
        if (editorState.selectedSections.length > 0) {
            targetChannelIndex = editorState.selectedSections[0].channelIndex;
        }

        const targetChannel = channels[targetChannelIndex];
        if (!targetChannel || targetChannel.kind !== 'note') return;

        // Prepare sections for batch addition
        const sectionsToAdd = clipboardSections.map((item) => ({
            channelIndex: targetChannelIndex,
            section: {
                ...item.section,
                startingTick: Math.max(0, item.section.startingTick + offsetTick),
                name: `${item.section.name} (Copy)`
            } as NoteSection
        }));

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
            }
        ]);

        historyManager.setContext({ player, editorState });

        return () => {
            commandManager.unregisterCommands([
                'delete-selected-sections',
                'delete-selected-sections-backspace',
                'copy-selected-sections',
                'cut-selected-sections',
                'paste-sections'
            ]);
        };
    });
</script>

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
                        class="scrollbar-hidden flex shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-secondary/40"
                        style={`width:${gutterWidth}px`}
                        onscroll={onChannelInfosScroll}
                    >
                        {#if channels.length === 0}
                            <div class="px-3 py-2 text-sm text-muted-foreground">No channels</div>
                        {:else}
                            {#each channels as ch, i}
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
                            {/each}
                        {/if}
                    </div>

                    <!-- Scrollable timeline region -->
                    <div
                        bind:this={channelScroller}
                        class="flex-1 overflow-auto bg-background"
                        onscroll={onChannelsScroll}
                        onpointerdown={(e) => {
                            // Forward background clicks to the same blank-timeline handler
                            if (e.button !== 0) return;
                            if (e.target !== e.currentTarget) return;
                            const contentEl = timelineContentEl;
                            if (contentEl) editorMouse.handleTimelineBlankPointerDown(contentEl, e);
                        }}
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
