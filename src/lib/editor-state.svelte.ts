// Shared editor UI state for channels/ruler (Svelte 5 runes)
import { player } from './playback.svelte';

export enum PointerMode {
    Normal = 'normal',
    Shears = 'shears',
    Merge = 'merge'
}

export class EditorState {
    // Zoom represented as pixels per beat for stable feel across signatures
    pxPerBeat = $state(50); // default ~64px per beat
    minPxPerBeat = 2;
    maxPxPerBeat = 480;

    // Horizontal scroll sync across ruler and channel rows
    scrollLeft = $state(0);
    // Vertical scroll sync across channel infos and channel content
    scrollTop = $state(0);
    // Auto-follow playhead toggle
    autoScrollEnabled = $state(true);

    // Pointer/edit mode for section editing
    pointerMode = $state<PointerMode>(PointerMode.Normal);

    // Section selection (2D selection of sections by channel + tick range).
    // Stored as an array of { channelIndex, sectionIndex } for simplicity.
    selectedSections = $state<Array<{ channelIndex: number; sectionIndex: number }>>([]);

    // Current section opened in the piano roll editor (null when closed)
    pianoRollTarget = $state<{
        channelIndex: number;
        sectionIndex: number;
    } | null>(null);

    // Select a set of sections (overwrites current)
    setSelectedSections(selections: Array<{ channelIndex: number; sectionIndex: number }>) {
        this.selectedSections = selections;
    }

    // Clear section selection
    clearSelectedSections() {
        this.selectedSections = [];
    }

    // Toggle a single section
    toggleSectionSelected(channelIndex: number, sectionIndex: number) {
        const found = this.selectedSections.find(
            (s) => s.channelIndex === channelIndex && s.sectionIndex === sectionIndex
        );
        if (found) {
            this.selectedSections = this.selectedSections.filter(
                (s) => !(s.channelIndex === channelIndex && s.sectionIndex === sectionIndex)
            );
        } else {
            this.selectedSections = [...this.selectedSections, { channelIndex, sectionIndex }];
        }
    }

    // Player-linked reactive values (single source of truth for grid geometry)
    ticksPerBeat = $derived(player.ticksPerBeat);
    beatsPerBar = $derived(player.beatsPerBar);
    lengthTicks = $derived(player.song?.length ?? 0);

    // Derived grid geometry based on zoom and player values
    barWidth = $derived(this.pxPerBeat * Math.max(1, this.beatsPerBar));
    // Fallback bars to show when no song is loaded/length is 0
    defaultBars = 64;
    totalBars = $derived.by(() => {
        if (!this.lengthTicks) return this.defaultBars;
        const ticksPerBar = Math.max(1, this.ticksPerBeat * this.beatsPerBar);
        return Math.ceil(this.lengthTicks / ticksPerBar);
    });

    // Cache contentWidth calculation to reduce frequent recalculation during resize
    private _cachedContentWidth = $state(0);
    private _lastBarWidth = $state(0);
    private _lastTotalBars = $state(0);
    private _contentWidthUpdateScheduled = $state(false);

    contentWidth = $derived.by(() => {
        const currentBarWidth = this.barWidth;
        const currentTotalBars = this.totalBars;

        // Only recalculate if values have actually changed
        if (currentBarWidth === this._lastBarWidth && currentTotalBars === this._lastTotalBars) {
            return this._cachedContentWidth;
        }

        // Throttle contentWidth updates during rapid changes (like window resize)
        if (!this._contentWidthUpdateScheduled) {
            this._contentWidthUpdateScheduled = true;
            queueMicrotask(() => {
                this._cachedContentWidth = currentTotalBars * currentBarWidth;
                this._lastBarWidth = currentBarWidth;
                this._lastTotalBars = currentTotalBars;
                this._contentWidthUpdateScheduled = false;
            });
        }

        // Return cached value while update is scheduled
        return this._cachedContentWidth || currentTotalBars * currentBarWidth;
    });

    // --- Vertical zoom (row height) ---
    baseRowHeight = 72;
    private _rowZoom = $state(1); // 1x by default
    minRowZoom = 0.5;
    maxRowZoom = 2.5;
    rowHeight = $derived(Math.round(this.baseRowHeight * this._rowZoom));

    setRowZoom(z: number) {
        const clamped = Math.min(this.maxRowZoom, Math.max(this.minRowZoom, z));
        this._rowZoom = clamped;
    }

    zoomRowsIn(factor = 1.15) {
        this.setRowZoom(this._rowZoom * factor);
    }

    zoomRowsOut(factor = 1.15) {
        this.setRowZoom(this._rowZoom / factor);
    }

    setPxPerBeat(px: number) {
        const clamped = Math.min(this.maxPxPerBeat, Math.max(this.minPxPerBeat, px));
        this.pxPerBeat = Math.round(clamped);
    }

    // Flag to trigger follow cursor logic after zoom
    _shouldFollowAfterZoom = $state(false);

    // Zoom throttling state
    private _pendingZoom = $state<number | null>(null);
    private _zoomThrottleId = $state<number | null>(null);

    private _applyPendingZoom() {
        if (this._pendingZoom !== null) {
            this.setPxPerBeat(this._pendingZoom);
            this._pendingZoom = null;
            this._shouldFollowAfterZoom = true;
        }
        this._zoomThrottleId = null;
    }

    private _scheduleZoom(newPxPerBeat: number) {
        this._pendingZoom = newPxPerBeat;

        if (this._zoomThrottleId !== null) {
            return; // Already scheduled
        }

        this._zoomThrottleId = requestAnimationFrame(() => {
            this._applyPendingZoom();
        });
    }

    zoomIn(factor = 1.2) {
        const newValue = Math.min(this.maxPxPerBeat, Math.max(this.minPxPerBeat, this.pxPerBeat * factor));
        const rounded = Math.round(newValue);
        this._scheduleZoom(rounded);
    }

    zoomOut(factor = 1.2) {
        const newValue = Math.min(this.maxPxPerBeat, Math.max(this.minPxPerBeat, this.pxPerBeat / factor));
        const rounded = Math.round(newValue);
        this._scheduleZoom(rounded);
    }

    setScrollLeft(px: number) {
        this.scrollLeft = Math.max(0, px | 0);
    }

    setScrollTop(px: number) {
        this.scrollTop = Math.max(0, px | 0);
    }

    setAutoScrollEnabled(on: boolean) {
        this.autoScrollEnabled = !!on;
    }

    setPointerMode(mode: PointerMode) {
        this.pointerMode = mode;
    }

    openPianoRoll(channelIndex: number, sectionIndex: number) {
        this.pianoRollTarget = { channelIndex, sectionIndex };
    }

    closePianoRoll() {
        this.pianoRollTarget = null;
    }
}

export const editorState = new EditorState();
