import { PointerMode } from '$lib/editor-state.svelte';
import { player } from '$lib/playback.svelte';
import type { Note, NoteSection } from '$lib/types';

export type PianoRollPointerMode = PointerMode.Normal | 'pen';
export type KeyRange = { min: number; max: number };

type SelectionBox = {
    startTick: number;
    startKey: number;
    currentTick: number;
    currentKey: number;
};

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

type OverlayRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

const NOTE_SPAN = 1;
const DEFAULT_NOTE_VELOCITY = 100;
const DEFAULT_NOTE_PITCH = 0;

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export class PianoRollMouseController {
    // Public reactive state
    selectedNotes = $state<Note[]>([]);
    selectionBox = $state<SelectionBox | null>(null);
    selectionOverlayRect = $state<OverlayRect | null>(null);
    isActive = $state(false);

    gridContent = $state<HTMLDivElement | null>(null);

    private _pxPerTick = 1;
    private _keyRange: KeyRange = { min: 0, max: 87 };
    private _keyHeight = 20;

    private _section: NoteSection | null = null;
    private _pointerMode: PianoRollPointerMode = PointerMode.Normal;

    private dragContext: DragContext | null = null;
    private selectionContext: SelectionContext = null;
    private overlayPendingRect: OverlayRect | null = null;
    private overlayFrameId: number | null = null;

    setPointerMode = (mode: PianoRollPointerMode) => {
        // Early exit if mode hasn't changed to prevent unnecessary updates
        if (this._pointerMode === mode) return;

        this._pointerMode = mode;

        // Always clear selection state when changing modes to ensure clean state
        this.selectionBox = null;
        this.selectionOverlayRect = null;
        this.selectionContext = null;
        this.dragContext = null;
        this.overlayPendingRect = null;
        this.cancelOverlayFrame();

        // In pen mode, also clear any selected notes to start fresh
        if (mode === 'pen') {
            this.clearSelection();
        }
    };

    setActive = (active: boolean) => {
        this.isActive = active;
        if (!active) {
            this.clearSelection();
            this.selectionBox = null;
            this.selectionOverlayRect = null;
            this.dragContext = null;
            this.selectionContext = null;
            this.overlayPendingRect = null;
            this.cancelOverlayFrame();
        }
    };

    setGridContent = (element: HTMLDivElement | null) => {
        this.gridContent = element;
    };

    setSection = (section: NoteSection | null) => {
        this._section = section;
        this.syncSelectedNotes();
    };

    updateGeometry = ({
        pxPerTick,
        keyRange,
        keyHeight
    }: {
        pxPerTick: number;
        keyRange: KeyRange;
        keyHeight: number;
    }) => {
        const newPxPerTick = pxPerTick > 0 ? pxPerTick : 1;
        const hasChanged =
            this._pxPerTick !== newPxPerTick ||
            this._keyRange.min !== keyRange.min ||
            this._keyRange.max !== keyRange.max ||
            this._keyHeight !== keyHeight;

        if (!hasChanged) return;

        this._pxPerTick = newPxPerTick;
        this._keyRange = keyRange;
        this._keyHeight = keyHeight;
        this.updateSelectionOverlayRect();
    };

    handleBackgroundPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();

        const section = this._section;
        const grid = this.gridContent;
        const pointerMode = this._pointerMode;

        const tick = this.clampTickToSection(this.tickFromPointer(event));
        const key = this.keyFromPointer(event);

        if (pointerMode === PointerMode.Normal) {
            this.selectionContext = { pointerId: event.pointerId, startTick: tick, startKey: key };
            this.selectionBox = {
                startTick: tick,
                startKey: key,
                currentTick: tick,
                currentKey: key
            };
            this.updateSelectionOverlayRect();
            this.clearSelection();
            grid?.setPointerCapture(event.pointerId);
        } else if (pointerMode === 'pen') {
            // Clear any existing selection state when in pen mode
            this.selectionContext = null;
            this.selectionBox = null;
            this.selectionOverlayRect = null;
            this.dragContext = null;

            if (!section) return;
            const existing = this.findNoteAt(tick, key);
            if (existing) {
                this.selectNotes([existing]);
            } else {
                const newNote: Note = {
                    tick,
                    key,
                    velocity: DEFAULT_NOTE_VELOCITY,
                    pitch: DEFAULT_NOTE_PITCH
                };
                section.notes.push(newNote);
                this.sortSectionNotes(section);
                this.selectNotes([newNote]);
                this.refreshPlayer();
            }
            // Don't capture pointer in pen mode to avoid interfering with note creation
        }
    };

    handleNotePointerDown = (note: Note, event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const section = this._section;
        if (!section) return;

        if (this._pointerMode === PointerMode.Normal) {
            if (!this.selectedNotes.includes(note)) {
                this.selectNotes([note]);
            }

            const notes = [...this.selectedNotes];
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

            this.gridContent?.setPointerCapture(event.pointerId);
        } else if (this._pointerMode === 'pen') {
            // In pen mode, just select the note and clear any selection state
            this.selectionContext = null;
            this.selectionBox = null;
            this.selectionOverlayRect = null;
            this.dragContext = null;
            this.selectNotes([note]);
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
        const section = this._section;
        if (!section) return;

        // Early exit if in pen mode - no selection or drag behavior
        if (this._pointerMode === 'pen') {
            return;
        }

        // Only process drag and selection in Normal mode
        if (this._pointerMode !== PointerMode.Normal) {
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
            this.selectionBox = {
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
            this.selectNotes(notes);
        }
    }

    private finishPointerInteraction(event: PointerEvent) {
        const section = this._section;

        // In pen mode, just clean up any stale state and exit early
        if (this._pointerMode === 'pen') {
            this.selectionContext = null;
            this.selectionBox = null;
            this.selectionOverlayRect = null;
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
            const box = this.selectionBox;
            if (
                box &&
                box.startTick === box.currentTick &&
                box.startKey === box.currentKey &&
                this._pointerMode === PointerMode.Normal
            ) {
                this.clearSelection();
            }
            this.selectionContext = null;
            this.selectionBox = null;
            this.updateSelectionOverlayRect();
        }

        const grid = this.gridContent;
        if (grid) {
            try {
                if (grid.hasPointerCapture(event.pointerId)) {
                    grid.releasePointerCapture(event.pointerId);
                }
            } catch {
                // ignore
            }
        }
    }

    handleWindowKeyDown = (event: KeyboardEvent) => {
        if (!this.isActive) return;
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        if (isEditableTarget(event.target)) return;

        const section = this._section;
        if (!section) return;
        const notes = section.notes;
        if (!notes?.length || !this.selectedNotes.length) return;

        const toRemove = new Set(this.selectedNotes);
        let removed = false;
        for (let index = notes.length - 1; index >= 0; index--) {
            if (toRemove.has(notes[index]!)) {
                notes.splice(index, 1);
                removed = true;
            }
        }

        if (!removed) return;

        event.preventDefault();
        this.clearSelection();
        this.sortSectionNotes(section);
        this.refreshPlayer();
    };

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
        const section = this._section;
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
        const content = this.gridContent;
        if (!content) return 0;
        const rect = content.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const rawTick = x / this._pxPerTick;
        return this.snapTick(rawTick);
    }

    private keyFromPointer(event: PointerEvent): number {
        const content = this.gridContent;
        if (!content) return this._keyRange.max;
        const rect = content.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;
        const rawRow = Math.floor(relativeY / this._keyHeight);
        const keyCount = Math.max(1, this._keyRange.max - this._keyRange.min + 1);
        const clampedRow = Math.min(Math.max(rawRow, 0), Math.max(0, keyCount - 1));
        const key = this._keyRange.max - clampedRow;
        return Math.min(87, Math.max(0, key));
    }

    private findNoteAt(tick: number, key: number): Note | null {
        const section = this._section;
        if (!section) return null;
        for (const note of section.notes) {
            if (note.key !== key) continue;
            const start = note.tick;
            const end = start + NOTE_SPAN;
            if (tick >= start && tick < end) return note;
        }
        return null;
    }

    private selectNotes(notes: Note[]) {
        const seen = new Set<Note>();
        const filtered: Note[] = [];
        for (const note of notes) {
            if (!note || seen.has(note)) continue;
            seen.add(note);
            filtered.push(note);
        }
        const current = this.selectedNotes;
        if (current.length === filtered.length) {
            let changed = false;
            for (let index = 0; index < current.length; index++) {
                if (current[index] !== filtered[index]) {
                    changed = true;
                    break;
                }
            }
            if (!changed) {
                return;
            }
        }
        this.selectedNotes = filtered;
    }

    private clearSelection() {
        if (this.selectedNotes.length) {
            this.selectedNotes = [];
        }
    }

    private syncSelectedNotes() {
        const section = this._section;
        if (!section) {
            this.selectedNotes = [];
            this.selectionOverlayRect = null;
            this.overlayPendingRect = null;
            this.cancelOverlayFrame();
            return;
        }
        const valid = new Set(section.notes);
        const filtered: Note[] = [];
        for (const note of this.selectedNotes) {
            if (valid.has(note)) filtered.push(note);
        }
        if (filtered.length !== this.selectedNotes.length) {
            this.selectedNotes = filtered;
        } else {
            // Compare existing order; avoid reassigning when unchanged
            const current = this.selectedNotes;
            let changed = false;
            for (let index = 0; index < current.length; index++) {
                if (current[index] !== filtered[index]) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                this.selectedNotes = filtered;
            }
        }
    }

    private refreshPlayer() {
        player.refreshIndexes();
    }

    private updateSelectionOverlayRect() {
        // Never show selection overlay in pen mode
        if (this._pointerMode === 'pen') {
            this.queueOverlayRect(null);
            return;
        }

        const box = this.selectionBox;
        if (!box) {
            this.queueOverlayRect(null);
            return;
        }

        const px = this._pxPerTick > 0 ? this._pxPerTick : 1;
        const tickStart = Math.min(box.startTick, box.currentTick);
        const tickEnd = Math.max(box.startTick, box.currentTick) + NOTE_SPAN;
        const left = Math.round(tickStart * px);
        const right = Math.round(tickEnd * px);

        const keyTop = Math.max(box.startKey, box.currentKey);
        const keyBottom = Math.min(box.startKey, box.currentKey);
        const top = (this._keyRange.max - keyTop) * this._keyHeight;
        const bottom = (this._keyRange.max - keyBottom + 1) * this._keyHeight;

        this.queueOverlayRect({
            left: Math.min(left, right),
            top: Math.min(top, bottom),
            width: Math.max(1, Math.abs(right - left)),
            height: Math.max(1, Math.abs(bottom - top))
        });
    }

    private queueOverlayRect(rect: OverlayRect | null) {
        if (
            typeof globalThis === 'undefined' ||
            typeof globalThis.requestAnimationFrame !== 'function'
        ) {
            this.selectionOverlayRect = rect;
            return;
        }

        this.overlayPendingRect = rect;
        if (this.overlayFrameId !== null) return;

        this.overlayFrameId = globalThis.requestAnimationFrame(() => {
            this.selectionOverlayRect = this.overlayPendingRect;
            this.overlayFrameId = null;
        });
    }

    private cancelOverlayFrame() {
        if (this.overlayFrameId === null) return;
        if (
            typeof globalThis !== 'undefined' &&
            typeof globalThis.cancelAnimationFrame === 'function'
        ) {
            globalThis.cancelAnimationFrame(this.overlayFrameId);
        }
        this.overlayFrameId = null;
        this.overlayPendingRect = null;
    }
}

export const pianoRollMouse = new PianoRollMouseController();
