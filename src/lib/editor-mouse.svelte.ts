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
                const newStart = Math.max(0, Math.round(absTick - item.offsetTick));

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
        this._contentEl = null;
        this._moved = false;
        this._startTick = 0;
        this._startX = 0;
        this._startY = 0;
        this._dragSectionRef = null;
    }
}

export const editorMouse = new EditorMouseController();
