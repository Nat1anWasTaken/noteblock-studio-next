import { editorState, PointerMode } from './editor-state.svelte';
import { player } from './playback.svelte';
import type { NoteChannel } from './types';

// Centralized mouse/gesture controller for the editor
export class EditorMouseController {
    // Interaction flags
    isSelecting = $state(false); // timeline tick selection (existing)
    isScrubbing = $state(false);

    // Section-specific flags
    isSelectingSections = $state(false); // 2D section selection (normal mode drag)
    isDraggingSection = $state(false); // dragging a single section to move it
    isResizingSection = $state(false); // resizing a section's duration via right handle

    // Shears-mode hover state: { channelIndex, sectionIndex, tick } when hovering a section
    shearsHover = $state<{ channelIndex: number; sectionIndex: number; tick: number } | null>(null);
    // Merge-mode hover state: { channelIndex, sectionIndex } when hovering a section (to merge with its next)
    mergeHover = $state<{ channelIndex: number; sectionIndex: number } | null>(null);
    // Blank-area hover state for creating a new section
    newSectionHover = $state<{ channelIndex: number; startingTick: number; length: number } | null>(
        null
    );

    // Context captured on pointerdown
    private _contentEl: HTMLElement | null = null;
    private _startTick = 0;
    private _startX = 0;
    private _startY = 0;
    private _startChannelIndex: number | null = null;
    private _startShiftKey = false;
    private _moved = false;

    // Dragging section context (supports multi-section drags)
    private _dragSectionRef: {
        items: Array<{
            section: any;
            originalChannelIndex: number;
            originalSectionIndex: number;
            offsetTick: number;
        }>;
        primaryOriginalChannel: number;
        primaryOriginalSectionIndex: number;
    } | null = null;

    private _resizeContext: {
        section: any;
        channelIndex: number;
        sectionIndex: number;
        startTick: number;
    } | null = null;

    // Helpers
    get pxPerTick(): number {
        return editorState.ticksPerBeat > 0
            ? editorState.pxPerBeat / editorState.ticksPerBeat
            : 0.000001; // avoid div-by-zero
    }

    // Convert a pointer event positioned over a content element into a tick position
    tickFromClientX(contentEl: HTMLElement, clientX: number): number {
        const rect = contentEl.getBoundingClientRect();
        // contentEl is the scrolled content itself; its rect.left already includes -scrollLeft.
        // Therefore, (clientX - rect.left) yields the absolute X in content space.
        const contentX = clientX - rect.left;
        const tick = Math.round(contentX / this.pxPerTick);
        return Math.max(0, tick);
    }

    // --- Ruler selection: click sets time, drag creates/updates selection ---
    handleRulerPointerDown = (contentEl: HTMLElement, ev: PointerEvent) => {
        if (ev.button !== 0) return; // left only
        ev.preventDefault();
        const startTick = this.tickFromClientX(contentEl, ev.clientX);
        this.isSelecting = true;

        this._startX = ev.clientX;
        this._startTick = startTick;
        this._contentEl = contentEl;
        this._moved = false;

        // Initialize selection to a zero-length at start
        player.setSelectionStart(startTick);
        player.setSelectionEnd(startTick);
    };

    // --- Timeline blank dragging: scrub playhead without selection ---
    handleTimelineBlankPointerDown = (contentEl: HTMLElement, ev: PointerEvent) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        this.isScrubbing = true;

        this._contentEl = contentEl;
        this._startX = ev.clientX;
        const tick = this.tickFromClientX(contentEl, ev.clientX);
        player.setCurrentTick(tick);
        this.clearNewSectionHover();
    };

    // --- Content background pointerdown to start section selection (Normal mode) ---
    handleContentPointerDown = (contentEl: HTMLElement, ev: PointerEvent) => {
        if (ev.button !== 0) return;
        if (editorState.pointerMode !== PointerMode.Normal) return;
        ev.preventDefault();

        this.isSelectingSections = true;
        this._contentEl = contentEl;
        this._startX = ev.clientX;
        this._startY = ev.clientY;
        this._startTick = this.tickFromClientX(contentEl, ev.clientX);
        this._startShiftKey = ev.shiftKey;
        this._moved = false;
        this.clearNewSectionHover();

        const rect = contentEl.getBoundingClientRect();
        const relY = ev.clientY - rect.top;
        const potentialIndex = Math.floor(relY / editorState.rowHeight);
        const channels = player.song?.channels ?? [];
        if (
            Number.isFinite(potentialIndex) &&
            potentialIndex >= 0 &&
            potentialIndex < channels.length &&
            channels[potentialIndex]?.kind === 'note'
        ) {
            this._startChannelIndex = potentialIndex;
        } else {
            this._startChannelIndex = null;
        }

        // Only clear current section selection if shift is not held
        if (!ev.shiftKey) {
            editorState.clearSelectedSections();
        }
    };

    // --- Section pointerdown: click (or click+drag) on a specific section to move it ---
    handleSectionPointerDown = (
        channelIndex: number,
        sectionIndex: number,
        section: any,
        contentEl: HTMLElement | null,
        ev: PointerEvent
    ) => {
        if (ev.button !== 0) return;
        if (editorState.pointerMode !== PointerMode.Normal) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.clearNewSectionHover();

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        this.isDraggingSection = true;
        this._contentEl = content;
        this._startX = ev.clientX;
        this._startY = ev.clientY;
        this._startShiftKey = ev.shiftKey;
        this._moved = false;

        const absTick = this.tickFromClientX(content, ev.clientX);

        // Handle shift+select logic
        if (ev.shiftKey) {
            // Shift+click: toggle selection of this section
            const wasSelected = editorState.selectedSections.some(
                (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
            );

            if (wasSelected) {
                // If this was the only selected section, don't deselect it
                if (editorState.selectedSections.length > 1) {
                    editorState.toggleSectionSelected(channelIndex, sectionIndex);
                }
            } else {
                // Add to selection
                editorState.toggleSectionSelected(channelIndex, sectionIndex);
            }

            // For shift+click, we don't want to drag unless the clicked section is still selected
            const stillSelected = editorState.selectedSections.some(
                (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
            );

            if (!stillSelected) {
                // Section was deselected, don't prepare for dragging
                this.isDraggingSection = false;
                return;
            }
        }

        // If the clicked section is already part of the current multi-selection,
        // prepare to drag the entire selection. Otherwise single-select the clicked section.
        const sel = editorState.selectedSections;
        let items: Array<{
            section: any;
            originalChannelIndex: number;
            originalSectionIndex: number;
            offsetTick: number;
        }> = [];

        const songChannels = player.song?.channels ?? [];

        const clickedInSelection = Boolean(
            sel.find((s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex)
        );

        if (clickedInSelection) {
            // Build items list from selection (preserve order)
            for (const s of sel) {
                const ch = songChannels[s.channelIndex];
                if (!ch || ch.kind !== 'note') continue;
                const sec = ch.sections[s.sectionIndex];
                if (!sec) continue;
                items.push({
                    section: sec,
                    originalChannelIndex: s.channelIndex,
                    originalSectionIndex: s.sectionIndex,
                    offsetTick: absTick - (sec.startingTick ?? 0)
                });
            }
        } else {
            // Single selection (clicked) - only if not shift+click
            if (!ev.shiftKey) {
                items.push({
                    section,
                    originalChannelIndex: channelIndex,
                    originalSectionIndex: sectionIndex,
                    offsetTick: absTick - (section.startingTick ?? 0)
                });
                editorState.setSelectedSections([{ channelIndex, sectionIndex }]);
            }
        }

        this._dragSectionRef = {
            items,
            primaryOriginalChannel: channelIndex,
            primaryOriginalSectionIndex: sectionIndex
        };
    };

    handleTimelineBlankPointerMove = (contentEl: HTMLElement, ev: PointerEvent) => {
        if (editorState.pointerMode !== PointerMode.Normal) {
            this.clearNewSectionHover();
            return;
        }
        if (
            this.isSelecting ||
            this.isScrubbing ||
            this.isSelectingSections ||
            this.isDraggingSection ||
            this.isResizingSection
        ) {
            this.clearNewSectionHover();
            return;
        }

        const channels = player.song?.channels ?? [];
        if (!contentEl || channels.length === 0) {
            this.clearNewSectionHover();
            return;
        }

        const rect = contentEl.getBoundingClientRect();
        const relY = ev.clientY - rect.top;
        if (relY < 0) {
            this.clearNewSectionHover();
            return;
        }
        const channelIndex = Math.floor(relY / editorState.rowHeight);
        const channel = channels[channelIndex] as NoteChannel | undefined;
        if (!channel || channel.kind !== 'note') {
            this.clearNewSectionHover();
            return;
        }

        const tick = this.tickFromClientX(contentEl, ev.clientX);
        const ticksPerBeat = editorState.ticksPerBeat > 0 ? editorState.ticksPerBeat : 1;
        const beatsPerBar = editorState.beatsPerBar > 0 ? editorState.beatsPerBar : 4;
        const ticksPerBar = Math.max(1, Math.round(ticksPerBeat * beatsPerBar));
        const startingTick = Math.max(0, Math.floor(tick / ticksPerBar) * ticksPerBar);
        const length = ticksPerBar;

        const overlap = channel.sections.some((section) => {
            const sStart = section.startingTick ?? 0;
            const sEnd = sStart + (section.length ?? 0);
            const previewEnd = startingTick + length;
            return previewEnd > sStart && startingTick < sEnd;
        });
        if (overlap) {
            this.clearNewSectionHover();
            return;
        }

        this.newSectionHover = { channelIndex, startingTick, length };
    };

    handleTimelineBlankPointerLeave = () => {
        this.clearNewSectionHover();
    };

    clearNewSectionHover() {
        if (this.newSectionHover) {
            this.newSectionHover = null;
        }
    }

    // --- Section resize: pointer down on the resize handle to change section length ---
    handleSectionResizePointerDown = (
        channelIndex: number,
        sectionIndex: number,
        section: any,
        contentEl: HTMLElement | null,
        ev: PointerEvent
    ) => {
        if (ev.button !== 0) return;
        if (editorState.pointerMode !== PointerMode.Normal) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.clearNewSectionHover();

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        this.isResizingSection = true;
        this._contentEl = content;
        this._startX = ev.clientX;
        this._startShiftKey = ev.shiftKey;
        this._moved = false;

        const startTick = section?.startingTick ?? 0;
        this._resizeContext = {
            section,
            channelIndex,
            sectionIndex,
            startTick
        };

        // Handle shift+select for resize: if shift is held and section is not selected, add it
        const alreadySelected = editorState.selectedSections.some(
            (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
        );
        if (!alreadySelected) {
            if (ev.shiftKey) {
                // Add to selection
                editorState.toggleSectionSelected(channelIndex, sectionIndex);
            } else {
                // Replace selection
                editorState.setSelectedSections([{ channelIndex, sectionIndex }]);
            }
        }
    };

    // --- Shears mode: pointer move over a section to update hover tick ---
    handleSectionPointerMove = (
        channelIndex: number,
        sectionIndex: number,
        section: any,
        contentEl: HTMLElement | null,
        ev: PointerEvent
    ) => {
        this.clearNewSectionHover();
        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) {
            this.shearsHover = null;
            this.mergeHover = null;
            return;
        }

        // --- Shears hover: show a tick within the hovered section ---
        if (editorState.pointerMode === PointerMode.Shears) {
            const absTick = this.tickFromClientX(content, ev.clientX);
            // Only show hover when inside the section bounds
            const secStart = section.startingTick ?? 0;
            const secEnd = secStart + (section.length ?? 0);
            if (absTick < secStart || absTick > secEnd) {
                this.shearsHover = null;
            } else {
                // Snap the hover tick to the nearest bar
                const snappedTick = player.snapTickToNearestBarStart(absTick);
                this.shearsHover = { channelIndex, sectionIndex, tick: snappedTick };
            }
            // clear merge hover when in shears mode
            this.mergeHover = null;
            return;
        }

        // --- Merge hover: highlight this section and the next section (if present) ---
        if (editorState.pointerMode === PointerMode.Merge) {
            const ch = player.song?.channels?.[channelIndex] as any;
            if (!ch || ch.kind !== 'note') {
                this.mergeHover = null;
                return;
            }
            const next = ch.sections?.[sectionIndex + 1];
            if (!next) {
                this.mergeHover = null;
                return;
            }

            const absTick = this.tickFromClientX(content, ev.clientX);
            const secStart = section.startingTick ?? 0;
            const secEnd = secStart + (section.length ?? 0);
            // Only show when hovering within the primary section bounds
            if (absTick < secStart || absTick > secEnd) {
                this.mergeHover = null;
                return;
            }

            this.mergeHover = { channelIndex, sectionIndex };
            // clear shears hover when in merge mode
            this.shearsHover = null;
            return;
        }

        // Clear any section-mode hovers if not in a specialized mode
        this.shearsHover = null;
        this.mergeHover = null;
    };

    // --- Shears mode: pointer leave clears hover ---
    handleSectionPointerLeave = (channelIndex: number, sectionIndex: number) => {
        this.clearNewSectionHover();
        const sh = this.shearsHover;
        if (sh && sh.channelIndex === channelIndex && sh.sectionIndex === sectionIndex) {
            this.shearsHover = null;
        }
        const mh = this.mergeHover;
        if (mh && mh.channelIndex === channelIndex && mh.sectionIndex === sectionIndex) {
            this.mergeHover = null;
        }
    };

    // --- Shears mode: pointer down on a section splits it at the clicked tick ---
    handleSectionShearsPointerDown = (
        channelIndex: number,
        sectionIndex: number,
        contentEl: HTMLElement | null,
        ev: PointerEvent
    ) => {
        if (ev.button !== 0) return;
        if (editorState.pointerMode !== PointerMode.Shears) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.clearNewSectionHover();

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        const absTick = this.tickFromClientX(content, ev.clientX);
        // Snap the cut tick to the nearest bar
        const snappedTick = player.snapTickToNearestBarStart(absTick);
        this.splitSectionAt(channelIndex, sectionIndex, snappedTick);
        // Clear hover after splitting
        this.shearsHover = null;
    };

    // --- Merge mode: pointer down on a section merges it with the next section ---
    handleSectionMergePointerDown = (
        channelIndex: number,
        sectionIndex: number,
        contentEl: HTMLElement | null,
        ev: PointerEvent
    ) => {
        if (ev.button !== 0) return;
        if (editorState.pointerMode !== PointerMode.Merge) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.clearNewSectionHover();

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        const song = player.song;
        if (!song) return;
        const ch = song.channels[channelIndex] as any;
        if (!ch || ch.kind !== 'note') return;

        const sec = ch.sections[sectionIndex];
        const nextSec = ch.sections[sectionIndex + 1];
        if (!sec || !nextSec) return;

        const secStart = sec.startingTick ?? 0;
        const nextStart = nextSec.startingTick ?? 0;

        // Build merged notes: left notes unchanged (relative to secStart), right notes adjusted to secStart
        const mergedNotes: any[] = [];
        for (const n of sec.notes ?? []) {
            mergedNotes.push({ ...n });
        }
        for (const n of nextSec.notes ?? []) {
            const absTick = nextStart + (n.tick ?? 0);
            const relTick = Math.max(0, Math.round(absTick - secStart));
            mergedNotes.push({ ...n, tick: relTick });
        }

        // New length covers the furthest end of both sections
        const mergedEnd = Math.max(secStart + (sec.length ?? 0), nextStart + (nextSec.length ?? 0));
        sec.length = Math.max(0, mergedEnd - secStart);
        sec.notes = mergedNotes;
        sec.name = sec.name || nextSec.name || 'Merged';

        // Remove the next section from the channel
        ch.sections.splice(sectionIndex + 1, 1);

        // Refresh indexes and select the merged section
        player.refreshIndexes();
        editorState.setSelectedSections([{ channelIndex, sectionIndex }]);

        // Clear merge hover
        this.mergeHover = null;
    };

    // Split a section at an absolute tick (mutates player.song in-place)
    private splitSectionAt(channelIndex: number, sectionIndex: number, absTick: number) {
        const song = player.song;
        if (!song) return;
        const ch = song.channels[channelIndex] as any;
        if (!ch || ch.kind !== 'note') return;

        const sec = ch.sections[sectionIndex];
        if (!sec) return;

        const start = sec.startingTick ?? 0;
        const length = sec.length ?? 0;
        const localSplit = Math.round(absTick - start);

        // Ignore invalid splits on boundaries
        if (localSplit <= 0 || localSplit >= length) return;

        // Partition notes
        const leftNotes: any[] = [];
        const rightNotes: any[] = [];
        for (const n of sec.notes ?? []) {
            if ((n.tick ?? 0) < localSplit) leftNotes.push(n);
            else rightNotes.push({ ...n, tick: (n.tick ?? 0) - localSplit });
        }

        // Mutate original section to be the left part
        sec.length = localSplit;
        sec.notes = leftNotes;

        // New right section
        const newSection: any = {
            startingTick: player.snapTickToNearestBarStart(start + localSplit),
            length: length - localSplit,
            notes: rightNotes,
            name: sec.name ? `${sec.name} (part)` : 'Part'
        };

        // Insert the new section immediately after original
        ch.sections.splice(sectionIndex + 1, 0, newSection);

        // Refresh indexes and select both new sections
        player.refreshIndexes();
        editorState.setSelectedSections([
            { channelIndex, sectionIndex },
            { channelIndex, sectionIndex: sectionIndex + 1 }
        ]);
    }

    // Window-scoped handlers (wired via <svelte:window> in a component)
    handleWindowPointerMove = (e: PointerEvent) => {
        if (!this._contentEl) return;
        if (this.isSelecting) {
            const curTick = this.tickFromClientX(this._contentEl, e.clientX);
            this._moved ||= Math.abs(e.clientX - this._startX) > 3;
            if (curTick >= this._startTick) {
                player.setSelectionStart(this._startTick);
                player.setSelectionEnd(curTick);
            } else {
                player.setSelectionStart(curTick);
                player.setSelectionEnd(this._startTick);
            }
        } else if (this.isScrubbing) {
            const tick = this.tickFromClientX(this._contentEl, e.clientX);
            player.setCurrentTick(tick);
        } else if (this.isSelectingSections) {
            // 2D selection over sections (tick range + channel index range)
            const curTick = this.tickFromClientX(this._contentEl, e.clientX);

            const contentRect = this._contentEl.getBoundingClientRect();
            const startChannel = Math.floor(
                (this._startY - contentRect.top) / editorState.rowHeight
            );
            const curChannel = Math.floor((e.clientY - contentRect.top) / editorState.rowHeight);

            const minChan = Math.max(0, Math.min(startChannel, curChannel));
            const maxChan = Math.max(0, Math.max(startChannel, curChannel));

            const minTick = Math.min(this._startTick, curTick);
            const maxTick = Math.max(this._startTick, curTick);

            const selections: Array<{ channelIndex: number; sectionIndex: number }> = [];

            const channels = player.song?.channels ?? [];
            for (let ci = minChan; ci <= maxChan && ci < channels.length; ci++) {
                const ch = channels[ci];
                if (!ch || ch.kind !== 'note') continue;
                for (let si = 0; si < ch.sections.length; si++) {
                    const s = ch.sections[si];
                    const sStart = s.startingTick;
                    const sEnd = s.startingTick + s.length;
                    // Overlap test
                    if (sEnd > minTick && sStart < maxTick) {
                        selections.push({ channelIndex: ci, sectionIndex: si });
                    }
                }
            }

            // Handle shift+select for marquee selection
            if (this._startShiftKey) {
                // Add to existing selection
                const currentSelection = new Set(
                    editorState.selectedSections.map((s) => `${s.channelIndex}-${s.sectionIndex}`)
                );
                const newSelections = selections.filter(
                    (s) => !currentSelection.has(`${s.channelIndex}-${s.sectionIndex}`)
                );
                if (newSelections.length > 0) {
                    editorState.setSelectedSections([
                        ...editorState.selectedSections,
                        ...newSelections
                    ]);
                }
            } else {
                // Replace selection
                editorState.setSelectedSections(selections);
            }

            this._moved ||=
                Math.abs(e.clientX - this._startX) > 3 || Math.abs(e.clientY - this._startY) > 3;
        } else if (this.isResizingSection && this._resizeContext) {
            const absTick = this.tickFromClientX(this._contentEl, e.clientX);
            const ctx = this._resizeContext;

            const startTick = ctx.startTick;
            const pointerTick = Math.max(0, absTick);

            // Snap the pointer tick to the nearest bar start
            const snappedEnd = player.snapTickToNearestBarStart(pointerTick);

            // Ensure the snapped end is at least one tick after the start
            const newLength = Math.max(1, Math.round(snappedEnd - startTick));
            if (ctx.section.length !== newLength) {
                ctx.section.length = newLength;
                this._moved = true;
            }
        } else if (this.isDraggingSection && this._dragSectionRef) {
            const absTick = this.tickFromClientX(this._contentEl, e.clientX);

            // Vertical move: determine row delta relative to pointerdown start.
            // Use a row-threshold (round) to avoid immediate channel jumps from small pointer jitter.
            const channels = player.song?.channels ?? [];
            const deltaRows = Math.round((e.clientY - this._startY) / editorState.rowHeight);

            // Update each selected item: compute moves first, then apply mutations.
            // This two-phase approach avoids source-index shifts that cause immediate jumps.
            const moves: Array<{
                item: any;
                srcIndex: number;
                dstIndex: number;
                newStart: number;
            }> = [];

            for (const item of this._dragSectionRef.items) {
                const newStart = player.snapTickToNearestBarStart(
                    Math.max(0, Math.round(absTick - item.offsetTick))
                );

                // Find the current channel that contains this section (robust identity lookup)
                const currentSrcIndex = channels.findIndex(
                    (c) =>
                        c &&
                        c.kind === 'note' &&
                        Array.isArray(c.sections) &&
                        c.sections.indexOf(item.section) >= 0
                );
                const srcIndex = currentSrcIndex >= 0 ? currentSrcIndex : item.originalChannelIndex;

                // Compute destination channel preserving each item's original offset relative to the start drag row
                const dstIndex = Math.min(
                    Math.max(0, item.originalChannelIndex + deltaRows),
                    Math.max(0, channels.length - 1)
                );

                moves.push({ item, srcIndex, dstIndex, newStart });
            }

            // Apply all moves after computing destinations to avoid interfering lookups
            for (const m of moves) {
                m.item.section.startingTick = m.newStart;

                if (
                    player.song &&
                    channels[m.srcIndex]?.kind === 'note' &&
                    channels[m.dstIndex]?.kind === 'note' &&
                    m.dstIndex !== m.srcIndex
                ) {
                    const srcCh = channels[m.srcIndex] as any;
                    const dstCh = channels[m.dstIndex] as any;

                    const idx = srcCh.sections.indexOf(m.item.section);
                    if (idx >= 0) {
                        srcCh.sections.splice(idx, 1);
                        dstCh.sections.push(m.item.section);
                    }
                }
            }

            // Notify player indexes updated (live)
            player.refreshIndexes();
            this._moved = true;
        }
    };

    handleWindowPointerUp = (e: PointerEvent) => {
        if (!this._contentEl) return this.reset();
        if (this.isSelecting) {
            const endTick = this.tickFromClientX(this._contentEl, e.clientX);
            if (!this._moved) {
                player.clearSelection();
                player.setCurrentTick(endTick);
            } else if (player.selectionStart === player.selectionEnd) {
                player.setSelectionEnd((player.selectionEnd ?? endTick) + 1);
            }
        } else if (this.isSelectingSections) {
            if (!this._moved) {
                // Store shift key state from the original pointer down event
                const wasShiftHeld = this._startShiftKey ?? false;
                if (
                    editorState.pointerMode === PointerMode.Normal &&
                    this._startChannelIndex !== null &&
                    !wasShiftHeld // Only create new section if shift was not held
                ) {
                    this.createSectionAt(
                        this._startChannelIndex,
                        this._contentEl,
                        this._startTick,
                        this._startX,
                        this._startY
                    );
                } else if (!wasShiftHeld) {
                    // Only clear selection if shift was not held
                    editorState.clearSelectedSections();
                }
            }
            // Otherwise keep the selection as-is (already set during move)
        } else if (this.isDraggingSection) {
            // Finalize drag: if it was a click (no move), select the clicked section
            // (only if shift was not held, as shift+click selection is handled in pointerdown)
            if (!this._moved && this._dragSectionRef && !this._startShiftKey) {
                editorState.setSelectedSections([
                    {
                        channelIndex: this._dragSectionRef.primaryOriginalChannel,
                        sectionIndex: this._dragSectionRef.primaryOriginalSectionIndex
                    }
                ]);
            }
            // Rebuild player indexes after edits
            player.refreshIndexes();
        } else if (this.isResizingSection) {
            if (this._resizeContext && !this._moved) {
                editorState.setSelectedSections([
                    {
                        channelIndex: this._resizeContext.channelIndex,
                        sectionIndex: this._resizeContext.sectionIndex
                    }
                ]);
            }
            player.refreshIndexes();
        }
        this.reset();
    };

    cancel() {
        this.reset();
    }

    private reset() {
        this.isSelecting = false;
        this.isScrubbing = false;
        this.isSelectingSections = false;
        this.isDraggingSection = false;
        this.isResizingSection = false;
        this._contentEl = null;
        this._moved = false;
        this._startTick = 0;
        this._startX = 0;
        this._startY = 0;
        this._startChannelIndex = null;
        this._startShiftKey = false;
        this._dragSectionRef = null;
        this._resizeContext = null;
        this.clearNewSectionHover();
    }

    private createSectionAt(
        channelIndex: number,
        contentEl: HTMLElement,
        rawTick: number,
        clientX: number,
        clientY: number
    ) {
        const song = player.song;
        if (!song) return;
        const channel = song.channels[channelIndex] as NoteChannel | undefined;
        if (!channel || channel.kind !== 'note') return;

        const rect = contentEl.getBoundingClientRect();
        const relY = clientY - rect.top;
        if (relY < 0 || relY >= song.channels.length * editorState.rowHeight) return;

        const ticksPerBeat = editorState.ticksPerBeat > 0 ? editorState.ticksPerBeat : 1;
        const beatsPerBar = editorState.beatsPerBar > 0 ? editorState.beatsPerBar : 4;
        const ticksPerBar = Math.max(1, Math.round(ticksPerBeat * beatsPerBar));

        const tickFromEvent = this.tickFromClientX(contentEl, clientX);
        const baseTick = Number.isFinite(rawTick) ? rawTick : tickFromEvent;
        const startingTick = Math.max(0, Math.floor(baseTick / ticksPerBar) * ticksPerBar);
        const length = ticksPerBar;
        const newEnd = startingTick + length;

        const overlaps = channel.sections.some((section) => {
            const sStart = section.startingTick ?? 0;
            const sEnd = sStart + (section.length ?? 0);
            return newEnd > sStart && startingTick < sEnd;
        });
        if (overlaps) return;

        const newSection = {
            startingTick,
            length,
            notes: [],
            name: this.generateSectionName(channel)
        };

        const insertIndex = channel.sections.findIndex((s) => s.startingTick > startingTick);
        if (insertIndex >= 0) channel.sections.splice(insertIndex, 0, newSection);
        else channel.sections.push(newSection);

        song.length = Math.max(song.length ?? 0, newEnd);
        player.refreshIndexes();

        const finalIndex = channel.sections.indexOf(newSection);
        if (finalIndex >= 0) {
            editorState.setSelectedSections([{ channelIndex, sectionIndex: finalIndex }]);
        }
    }

    private generateSectionName(channel: NoteChannel): string {
        const base = 'Section';
        let counter = 1;
        const existing = new Set(channel.sections.map((s) => s.name?.trim().toLowerCase()));
        while (existing.has(`${base} ${counter}`.toLowerCase())) {
            counter++;
        }
        return `${base} ${counter}`;
    }
}

export const editorMouse = new EditorMouseController();
