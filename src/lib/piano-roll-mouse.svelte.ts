import { commandManager } from '$lib/command-manager';
import { PointerMode } from '$lib/editor-state.svelte';
import { player } from '$lib/playback.svelte';
import type { Note, NoteSection } from '$lib/types';

export type PianoRollPointerMode = PointerMode.Normal | 'pen';

// Forward declaration to avoid circular import
interface PianoRollState {
    pointerMode: PianoRollPointerMode;
    selectedNotes: Note[];
    selectionBox: {
        startTick: number;
        startKey: number;
        currentTick: number;
        currentKey: number;
    } | null;
    selectionOverlayRect: { left: number; top: number; width: number; height: number } | null;
    gridContent: HTMLDivElement | null;
    keyRange: { min: number; max: number };
    keyHeight: number;
    pxPerTick: number;
    sectionData: { section: NoteSection } | null;
    isMouseActive: boolean;
    selectNotes: (notes: Note[]) => void;
    clearSelection: () => void;
    updateSelectionOverlayRect: () => void;
}
export type KeyRange = { min: number; max: number };

type DragContext = {
    notes: Note[];
    original: Map<Note, { tick: number; key: number }>;
    minTick: number;
    maxTick: number;
    minKey: number;
    maxKey: number;
    startTick: number;
    startKey: number;
    pointerId: number;
    moved: boolean;
};

type SelectionContext = { pointerId: number; startTick: number; startKey: number } | null;

const POINTER_MOVE_HANDLED = Symbol('pianoRollPointerMoveHandled');
const POINTER_UP_HANDLED = Symbol('pianoRollPointerUpHandled');

const NOTE_SPAN = 1;
const DEFAULT_NOTE_VELOCITY = 100;
const DEFAULT_NOTE_PITCH = 0;
export class PianoRollMouseController {
    private pianoRollState: PianoRollState | null = null;

    private dragContext: DragContext | null = null;
    private selectionContext: SelectionContext = null;

    setPianoRollState(state: PianoRollState) {
        this.pianoRollState = state;
    }

    deleteSelectedNotes() {
        if (!this.pianoRollState) return;
        if (!this.pianoRollState.isMouseActive) return;

        const section = this.pianoRollState.sectionData?.section;
        if (!section) return;
        const notes = section.notes;
        if (!notes?.length || !this.pianoRollState.selectedNotes.length) return;

        const toRemove = new Set(this.pianoRollState.selectedNotes);
        let removed = false;
        for (let index = notes.length - 1; index >= 0; index--) {
            if (toRemove.has(notes[index]!)) {
                notes.splice(index, 1);
                removed = true;
            }
        }

        if (!removed) return;

        this.pianoRollState.clearSelection();
        this.sortSectionNotes(section);
        this.refreshPlayer();
    }

    // Mouse controllers should be stateless - all state managed by pianoRollState

    handleBackgroundPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        if (!this.pianoRollState) return;
        event.preventDefault();

        const tick = this.clampTickToSection(this.tickFromPointer(event));
        const key = this.keyFromPointer(event);

        if (this.pianoRollState.pointerMode === PointerMode.Normal) {
            this.selectionContext = { pointerId: event.pointerId, startTick: tick, startKey: key };
            this.pianoRollState.selectionBox = {
                startTick: tick,
                startKey: key,
                currentTick: tick,
                currentKey: key
            };
            this.updateSelectionOverlayRect();
            this.pianoRollState.clearSelection();
            this.pianoRollState.gridContent?.setPointerCapture(event.pointerId);
        } else if (this.pianoRollState.pointerMode === 'pen') {
            // Clear any existing selection state when in pen mode
            this.selectionContext = null;
            this.pianoRollState.selectionBox = null;
            this.pianoRollState.selectionOverlayRect = null;
            this.dragContext = null;

            const section = this.pianoRollState.sectionData?.section;
            if (!section) return;
            const existing = this.findNoteAt(tick, key);
            if (existing) {
                this.pianoRollState.selectNotes([existing]);
            } else {
                const newNote: Note = {
                    tick,
                    key,
                    velocity: DEFAULT_NOTE_VELOCITY,
                    pitch: DEFAULT_NOTE_PITCH
                };
                section.notes.push(newNote);
                this.sortSectionNotes(section);
                this.pianoRollState.selectNotes([newNote]);
                this.refreshPlayer();
            }
            // Don't capture pointer in pen mode to avoid interfering with note creation
        }
    };

    handleNotePointerDown = (note: Note, event: PointerEvent) => {
        if (event.button !== 0) return;
        if (!this.pianoRollState) return;
        event.preventDefault();
        event.stopPropagation();

        const section = this.pianoRollState.sectionData?.section;
        if (!section) return;

        if (this.pianoRollState.pointerMode === PointerMode.Normal) {
            if (!this.pianoRollState.selectedNotes.includes(note)) {
                this.pianoRollState.selectNotes([note]);
            }

            const notes = [...this.pianoRollState.selectedNotes];
            const original = new Map<Note, { tick: number; key: number }>();
            let minTick = Number.POSITIVE_INFINITY;
            let maxTick = Number.NEGATIVE_INFINITY;
            let minKey = Number.POSITIVE_INFINITY;
            let maxKey = Number.NEGATIVE_INFINITY;

            for (const n of notes) {
                this.ensureNoteTick(n);
                original.set(n, {
                    tick: n.tick,
                    key: n.key
                });
                if (n.tick < minTick) minTick = n.tick;
                if (n.tick > maxTick) maxTick = n.tick;
                if (n.key < minKey) minKey = n.key;
                if (n.key > maxKey) maxKey = n.key;
            }

            this.dragContext = {
                notes,
                original,
                minTick: Number.isFinite(minTick) ? minTick : 0,
                maxTick: Number.isFinite(maxTick) ? maxTick : 0,
                minKey: Number.isFinite(minKey) ? minKey : 0,
                maxKey: Number.isFinite(maxKey) ? maxKey : 0,
                startTick: this.tickFromPointer(event),
                startKey: this.keyFromPointer(event),
                pointerId: event.pointerId,
                moved: false
            };

            this.pianoRollState.gridContent?.setPointerCapture(event.pointerId);
        } else if (this.pianoRollState.pointerMode === 'pen') {
            // In pen mode, just select the note and clear any selection state
            this.selectionContext = null;
            this.pianoRollState.selectionBox = null;
            this.pianoRollState.selectionOverlayRect = null;
            this.dragContext = null;
            this.pianoRollState.selectNotes([note]);
        }
    };

    handleWindowPointerMove = (event: PointerEvent) => {
        if ((event as any)[POINTER_MOVE_HANDLED]) return;
        (event as any)[POINTER_MOVE_HANDLED] = true;
        this.processPointerMove(event);
    };

    handleGridPointerMove = (event: PointerEvent) => {
        (event as any)[POINTER_MOVE_HANDLED] = true;
        this.processPointerMove(event);
    };

    handleWindowPointerUp = (event: PointerEvent) => {
        if ((event as any)[POINTER_UP_HANDLED]) return;
        (event as any)[POINTER_UP_HANDLED] = true;
        this.finishPointerInteraction(event);
    };

    handleGridPointerUp = (event: PointerEvent) => {
        (event as any)[POINTER_UP_HANDLED] = true;
        this.finishPointerInteraction(event);
    };

    handleWindowPointerCancel = (event: PointerEvent) => {
        if ((event as any)[POINTER_UP_HANDLED]) return;
        (event as any)[POINTER_UP_HANDLED] = true;
        this.finishPointerInteraction(event);
    };

    handleGridPointerCancel = (event: PointerEvent) => {
        (event as any)[POINTER_UP_HANDLED] = true;
        this.finishPointerInteraction(event);
    };

    private processPointerMove(event: PointerEvent) {
        if (!this.pianoRollState) return;
        const section = this.pianoRollState.sectionData?.section;
        if (!section) return;

        // Early exit if in pen mode - no selection or drag behavior
        if (this.pianoRollState.pointerMode === 'pen') {
            return;
        }

        // Only process drag and selection in Normal mode
        if (this.pianoRollState.pointerMode !== PointerMode.Normal) {
            return;
        }

        if (this.dragContext && this.dragContext.pointerId === event.pointerId) {
            const tick = this.tickFromPointer(event);
            const key = this.keyFromPointer(event);
            let tickDelta = tick - this.dragContext.startTick;
            let keyDelta = key - this.dragContext.startKey;

            const minTickDelta = -this.dragContext.minTick;
            const maxTickAllowed = Math.max(0, section.length - NOTE_SPAN);
            const maxTickDelta = maxTickAllowed - this.dragContext.maxTick;
            tickDelta = Math.min(Math.max(tickDelta, minTickDelta), maxTickDelta);

            const minKeyDelta = -this.dragContext.minKey;
            const maxKeyDelta = 87 - this.dragContext.maxKey;
            keyDelta = Math.min(Math.max(keyDelta, minKeyDelta), maxKeyDelta);

            for (const note of this.dragContext.notes) {
                const orig = this.dragContext.original.get(note);
                if (!orig) continue;
                const nextTick = this.clampTickToSection(orig.tick + tickDelta);
                note.tick = nextTick;
                note.key = Math.min(87, Math.max(0, orig.key + keyDelta));
            }

            this.dragContext.moved ||= tickDelta !== 0 || keyDelta !== 0;
        }

        if (this.selectionContext && this.selectionContext.pointerId === event.pointerId) {
            const tick = this.tickFromPointer(event);
            const key = this.keyFromPointer(event);
            this.pianoRollState.selectionBox = {
                startTick: this.selectionContext.startTick,
                startKey: this.selectionContext.startKey,
                currentTick: tick,
                currentKey: key
            };
            this.updateSelectionOverlayRect();

            const minTick = Math.min(this.selectionContext.startTick, tick);
            const maxTick = Math.max(this.selectionContext.startTick, tick) + NOTE_SPAN;
            const minKey = Math.min(this.selectionContext.startKey, key);
            const maxKey = Math.max(this.selectionContext.startKey, key);

            const notes: Note[] = [];
            for (const n of section.notes) {
                const start = n.tick;
                const end = start + NOTE_SPAN;
                const overlapsTick = end > minTick && start < maxTick;
                const withinKey = n.key >= minKey && n.key <= maxKey;
                if (overlapsTick && withinKey) notes.push(n);
            }
            this.pianoRollState.selectNotes(notes);
        }
    }

    private finishPointerInteraction(event: PointerEvent) {
        if (!this.pianoRollState) return;
        const section = this.pianoRollState.sectionData?.section;

        // In pen mode, just clean up any stale state and exit early
        if (this.pianoRollState.pointerMode === 'pen') {
            this.selectionContext = null;
            this.pianoRollState.selectionBox = null;
            this.pianoRollState.selectionOverlayRect = null;
            this.dragContext = null;
            return;
        }

        if (this.dragContext && this.dragContext.pointerId === event.pointerId) {
            if (this.dragContext.moved && section) {
                this.sortSectionNotes(section);
                this.refreshPlayer();
            }
            this.dragContext = null;
        }

        if (this.selectionContext && this.selectionContext.pointerId === event.pointerId) {
            const box = this.pianoRollState.selectionBox;
            if (
                box &&
                box.startTick === box.currentTick &&
                box.startKey === box.currentKey &&
                this.pianoRollState.pointerMode === PointerMode.Normal
            ) {
                this.pianoRollState.clearSelection();
            }
            this.selectionContext = null;
            this.pianoRollState.selectionBox = null;
            this.updateSelectionOverlayRect();
        }

        if (this.pianoRollState.gridContent) {
            try {
                if (this.pianoRollState.gridContent.hasPointerCapture(event.pointerId)) {
                    this.pianoRollState.gridContent.releasePointerCapture(event.pointerId);
                }
            } catch {
                // ignore
            }
        }
    }

    private snapTick(value: number): number {
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.round(value));
    }

    private ensureNoteTick(note: Note) {
        const snapped = this.snapTick(note.tick);
        if (note.tick !== snapped) {
            note.tick = snapped;
        }
    }

    private clampTickToSection(tick: number): number {
        if (!this.pianoRollState) return this.snapTick(tick);
        const section = this.pianoRollState.sectionData?.section;
        const snappedTick = this.snapTick(tick);
        if (!section) return snappedTick;
        const maxTick = Math.max(0, section.length - NOTE_SPAN);
        return Math.min(Math.max(0, snappedTick), maxTick);
    }

    private sortSectionNotes(section: NoteSection) {
        section.notes.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            return a.key - b.key;
        });
    }

    private tickFromPointer(event: PointerEvent): number {
        if (!this.pianoRollState) return 0;
        const content = this.pianoRollState.gridContent;
        if (!content) return 0;
        const rect = content.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const rawTick = x / this.pianoRollState.pxPerTick;
        return this.snapTick(rawTick);
    }

    private keyFromPointer(event: PointerEvent): number {
        if (!this.pianoRollState) return 87;
        const content = this.pianoRollState.gridContent;
        const keyRange = this.pianoRollState.keyRange;
        const keyHeight = this.pianoRollState.keyHeight;
        if (!content) return keyRange.max;
        const rect = content.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;
        const rawRow = Math.floor(relativeY / keyHeight);
        const keyCount = Math.max(1, keyRange.max - keyRange.min + 1);
        const clampedRow = Math.min(Math.max(rawRow, 0), Math.max(0, keyCount - 1));
        const key = keyRange.max - clampedRow;
        return Math.min(87, Math.max(0, key));
    }

    private findNoteAt(tick: number, key: number): Note | null {
        if (!this.pianoRollState) return null;
        const section = this.pianoRollState.sectionData?.section;
        if (!section) return null;
        for (const note of section.notes) {
            if (note.key !== key) continue;
            const start = note.tick;
            const end = start + NOTE_SPAN;
            if (tick >= start && tick < end) return note;
        }
        return null;
    }

    // Selection methods now handled by pianoRollState

    private refreshPlayer() {
        player.refreshIndexes();
    }

    private updateSelectionOverlayRect() {
        this.pianoRollState?.updateSelectionOverlayRect();
    }
}

export const pianoRollMouse = new PianoRollMouseController();
