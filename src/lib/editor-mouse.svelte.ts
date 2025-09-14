import { editorState } from './editor-state.svelte';
import { player } from './playback.svelte';

// Centralized mouse/gesture controller for the editor
export class EditorMouseController {
    // Interaction flags
    isSelecting = $state(false);
    isScrubbing = $state(false);

    // Context captured on pointerdown
    private _contentEl: HTMLElement | null = null;
    private _startTick = 0;
    private _startX = 0;
    private _moved = false;

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
        }
        this.reset();
    };

    cancel() {
        this.reset();
    }

    private reset() {
        this.isSelecting = false;
        this.isScrubbing = false;
        this._contentEl = null;
        this._moved = false;
        this._startTick = 0;
        this._startX = 0;
    }
}

export const editorMouse = new EditorMouseController();
