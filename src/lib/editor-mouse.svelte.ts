import { editorState, PointerMode } from './editor-state.svelte';
import { player } from './playback.svelte';

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

    // Context captured on pointerdown
    private _contentEl: HTMLElement | null = null;
    private _startTick = 0;
    private _startX = 0;
    private _startY = 0;
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
        this._moved = false;

        // Clear current section selection to start fresh
        editorState.clearSelectedSections();
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

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        this.isDraggingSection = true;
        this._contentEl = content;
        this._startX = ev.clientX;
        this._startY = ev.clientY;
        this._moved = false;

        const absTick = this.tickFromClientX(content, ev.clientX);

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
            // Single selection (clicked)
            items.push({
                section,
                originalChannelIndex: channelIndex,
                originalSectionIndex: sectionIndex,
                offsetTick: absTick - (section.startingTick ?? 0)
            });
            editorState.setSelectedSections([{ channelIndex, sectionIndex }]);
        }

        this._dragSectionRef = {
            items,
            primaryOriginalChannel: channelIndex,
            primaryOriginalSectionIndex: sectionIndex
        };
    };

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

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        this.isResizingSection = true;
        this._contentEl = content;
        this._startX = ev.clientX;
        this._moved = false;

        const startTick = section?.startingTick ?? 0;
        this._resizeContext = {
            section,
            channelIndex,
            sectionIndex,
            startTick
        };

        const alreadySelected = editorState.selectedSections.some(
            (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
        );
        if (!alreadySelected) {
            editorState.setSelectedSections([{ channelIndex, sectionIndex }]);
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
                return;
            }
            this.shearsHover = { channelIndex, sectionIndex, tick: absTick };
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

        const content =
            contentEl ?? (document.querySelector('[data-editor-content]') as HTMLElement);
        if (!content) return;

        const absTick = this.tickFromClientX(content, ev.clientX);
        this.splitSectionAt(channelIndex, sectionIndex, absTick);
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
            startingTick: player.snapTickToBarStart(start + localSplit),
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

            editorState.setSelectedSections(selections);
            this._moved ||=
                Math.abs(e.clientX - this._startX) > 3 || Math.abs(e.clientY - this._startY) > 3;
        } else if (this.isResizingSection && this._resizeContext) {
            const absTick = this.tickFromClientX(this._contentEl, e.clientX);
            const ctx = this._resizeContext;

            const startTick = ctx.startTick;
            const startBar = player.getBarAtTick(startTick);
            const pointerTick = Math.max(0, absTick);
            const pointerBar = player.getBarAtTick(pointerTick);

            // Always keep at least one full bar. Allow shrinking by moving pointer into earlier bars.
            const targetBar = Math.max(startBar + 1, pointerBar + 1);
            let snappedEnd = player.getBarStartTick(targetBar);

            if (snappedEnd <= startTick) {
                const fallback = player.getBarStartTick(startBar + 1);
                snappedEnd = Math.max(fallback, startTick + 1);
            }

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
                const newStart = player.snapTickToBarStart(
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
                // Click without drag => clear section selection
                editorState.clearSelectedSections();
            }
            // Otherwise keep the selection as-is (already set during move)
        } else if (this.isDraggingSection) {
            // Finalize drag: if it was a click (no move), select the clicked section
            if (!this._moved && this._dragSectionRef) {
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
        this._dragSectionRef = null;
        this._resizeContext = null;
    }
}

export const editorMouse = new EditorMouseController();
