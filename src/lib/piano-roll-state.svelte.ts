import { editorState, PointerMode } from '$lib/editor-state.svelte';
import { type KeyRange, type PianoRollPointerMode } from '$lib/piano-roll-mouse.svelte';
import { LoopMode, player } from '$lib/playback.svelte';
import type { Note, NoteChannel, NoteSection } from '$lib/types';

export type PianoRollContext = {
    channel: NoteChannel;
    section: NoteSection;
    channelIndex: number;
    sectionIndex: number;
};

const FULL_MIDI_RANGE: KeyRange = { min: 0, max: 87 };
const MINECRAFT_RANGE = { min: 33, max: 57 };
const NOTE_SPAN = 1;

export class PianoRollState {
    sheetOpen = $state(false);
    pointerMode = $state<PianoRollPointerMode>(PointerMode.Normal);

    gridScroller = $state<HTMLDivElement | null>(null);
    keysScroller = $state<HTMLDivElement | null>(null);
    gridContent = $state<HTMLDivElement | null>(null);
    gridScrollLeft = $state(0);
    gridScrollTop = $state(0);

    // Mouse state - moved from piano-roll-mouse.svelte.ts
    selectedNotes = $state<Note[]>([]);
    selectionBox = $state<{
        startTick: number;
        startKey: number;
        currentTick: number;
        currentKey: number;
    } | null>(null);
    selectionOverlayRect = $state<{
        left: number;
        top: number;
        width: number;
        height: number;
    } | null>(null);
    isMouseActive = $state(false);

    // Hover state for pen mode preview
    hoverNote = $state<{ tick: number; key: number } | null>(null);

    // Overlay optimization
    private overlayPendingRect: {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null = null;
    private overlayFrameId: number | null = null;

    keyHeight = 20;
    noteLaneHeight = Math.max(8, this.keyHeight - 6);

    pianoRollTarget = $derived(editorState.pianoRollTarget);

    sectionData = $derived.by<PianoRollContext | null>(() => {
        const target = this.pianoRollTarget;
        if (!target) return null;
        const channel = player.song?.channels?.[target.channelIndex];
        if (!channel || channel.kind !== 'note') return null;
        const section = channel.sections?.[target.sectionIndex];
        if (!section) return null;
        return {
            channel,
            section,
            channelIndex: target.channelIndex,
            sectionIndex: target.sectionIndex
        } satisfies PianoRollContext;
    });

    ticksPerBeat = $derived(Math.max(1, editorState.ticksPerBeat));
    beatsPerBar = $derived(Math.max(1, editorState.beatsPerBar));
    pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );

    keyRange = FULL_MIDI_RANGE;
    keyCount = $derived.by(() => this.keyRange.max - this.keyRange.min + 1);
    gridHeight = $derived(Math.max(1, this.keyCount) * this.keyHeight);

    rawGridWidth = $derived.by(() => {
        const section = this.sectionData?.section;
        if (!section) return 0;
        const pxTick = this.pxPerTick > 0 ? this.pxPerTick : 1;
        const lengthPx = section.length * pxTick;
        // Use section length directly, with a small minimum for usability
        return Math.max(320, Math.ceil(lengthPx));
    });

    barWidth = $derived(Math.max(1, editorState.barWidth));
    totalBars = $derived.by(() => {
        if (this.barWidth <= 0) return 1;
        return Math.max(1, Math.ceil(this.rawGridWidth / this.barWidth));
    });
    contentWidth = $derived(this.totalBars * this.barWidth);

    notesToRender = $derived.by(() => {
        const section = this.sectionData?.section;
        if (!section) {
            return [] as Array<{
                id: string;
                left: number;
                top: number;
                width: number;
                height: number;
                note: Note;
                selected: boolean;
            }>;
        }

        const range = this.keyRange;
        const pxTickValue = this.pxPerTick > 0 ? this.pxPerTick : 1;
        const laneHeight = this.noteLaneHeight;
        const offset = (this.keyHeight - laneHeight) / 2;
        const selectedSet = new Set(this.selectedNotes);

        return (section.notes ?? []).map((note, index) => {
            const top = (range.max - note.key) * this.keyHeight + offset;
            const width = Math.max(8, Math.round(NOTE_SPAN * pxTickValue));
            const left = Math.max(0, Math.round(note.tick * pxTickValue));
            const id = `${section.startingTick + note.tick}:${note.key}:${index}`;
            return {
                id,
                left,
                top,
                width,
                height: laneHeight,
                note,
                selected: selectedSet.has(note)
            };
        });
    });

    sectionBeatLength = $derived.by(() => {
        const section = this.sectionData?.section;
        if (!section) return 0;
        return +(section.length / this.ticksPerBeat).toFixed(2);
    });

    sectionStartTick = $derived(this.sectionData?.section?.startingTick ?? 0);
    sectionStartBar = $derived.by(() => {
        if (!this.sectionData) return 0;
        return player.getBarAtTick(this.sectionStartTick);
    });
    sectionEndTick = $derived.by(
        () => this.sectionStartTick + (this.sectionData?.section?.length ?? 0)
    );
    cursorTick = $derived(player.currentTick);
    cursorVisible = $derived.by(
        () => this.cursorTick >= this.sectionStartTick && this.cursorTick <= this.sectionEndTick
    );

    isPlaying = $derived(player.isPlaying);

    positionBar = $derived(String(player.currentBar + 1).padStart(3, '0'));
    positionBeat = $derived(String(player.currentBeat + 1).padStart(2, '0'));
    positionTickInBeat = $derived(
        String((player.currentTick % player.ticksPerBeat) + 1).padStart(2, '0')
    );

    loopModeButtonClass = $derived.by(() => {
        switch (player.loopMode) {
            case LoopMode.Selection:
                return 'bg-purple-600 text-white hover:bg-purple-600/80 dark:hover:bg-purple-600/80 hover:text-white';
            case LoopMode.Song:
                return 'bg-amber-500 text-white hover:bg-amber-500/80 dark:hover:bg-amber-500/80 hover:text-white';
            case LoopMode.Off:
            default:
                return '';
        }
    });

    loopModeLabel = $derived.by(() => {
        switch (player.loopMode) {
            case LoopMode.Selection:
                return 'Loop: Selection';
            case LoopMode.Song:
                return 'Loop: Song';
            case LoopMode.Off:
            default:
                return 'Loop: Off';
        }
    });

    constructor() {}

    handleGridScroll = () => {
        const grid = this.gridScroller;
        const keys = this.keysScroller;
        if (!grid) return;
        const { scrollTop, scrollLeft } = grid;
        this.gridScrollLeft = scrollLeft;
        this.gridScrollTop = scrollTop;
        if (keys && Math.abs(keys.scrollTop - scrollTop) > 1) {
            keys.scrollTop = scrollTop;
        }
    };

    handleRulerScrollLeft(left: number) {
        const grid = this.gridScroller;
        if (grid && Math.abs(grid.scrollLeft - left) > 1) {
            grid.scrollLeft = left;
        }
        this.gridScrollLeft = left;
    }

    keyNumberToInfo(key: number) {
        const names = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const noteName = names[key % 12];
        const octave = Math.floor((key + 9) / 12);
        const isBlack = noteName.includes('#');
        const isMinecraftRange = key >= MINECRAFT_RANGE.min && key <= MINECRAFT_RANGE.max;
        return { label: `${noteName}${octave}`, isBlack, isMinecraftRange };
    }

    keyRows = $derived.by(() => {
        const rows: Array<{
            key: number;
            label: string;
            isBlack: boolean;
            isMinecraftRange: boolean;
            isOctaveBoundary: boolean;
        }> = [];
        for (let key = this.keyRange.max; key >= this.keyRange.min; key--) {
            const info = this.keyNumberToInfo(key);
            const nextKey = key - 1;
            const nextOctave = nextKey >= this.keyRange.min ? Math.floor((nextKey + 9) / 12) : -1;
            const currentOctave = Math.floor((key + 9) / 12);
            const isOctaveBoundary = nextKey >= this.keyRange.min && nextOctave !== currentOctave;
            rows.push({ key, ...info, isOctaveBoundary });
        }
        return rows;
    });

    rewind = () => player.setBarBeat(0, 0);

    togglePlay = () => (player.isPlaying ? player.pause() : player.resume());

    cycleLoop = () => {
        switch (player.loopMode) {
            case LoopMode.Off:
                player.setLoopMode(LoopMode.Song);
                break;
            case LoopMode.Song:
                player.setLoopMode(LoopMode.Selection);
                break;
            case LoopMode.Selection:
            default:
                player.setLoopMode(LoopMode.Off);
                break;
        }
    };

    setPointerMode(mode: PianoRollPointerMode) {
        if (this.pointerMode === mode) return;
        this.pointerMode = mode;

        // Clear selection state when changing modes
        this.selectionBox = null;
        this.selectionOverlayRect = null;
        this.hoverNote = null;
        this.cancelOverlayFrame();

        // In pen mode, clear selected notes
        if (mode === 'pen') {
            this.selectedNotes = [];
        }
    }

    selectNotes(notes: Note[]) {
        const seen = new Set<Note>();
        const filtered: Note[] = [];
        for (const note of notes) {
            if (!note || seen.has(note)) continue;
            seen.add(note);
            filtered.push(note);
        }
        this.selectedNotes = filtered;
    }

    clearSelection() {
        this.selectedNotes = [];
    }

    updateSelectionOverlayRect() {
        // Never show selection overlay in pen mode
        if (this.pointerMode === 'pen') {
            this.queueOverlayRect(null);
            return;
        }

        const box = this.selectionBox;
        if (!box) {
            this.queueOverlayRect(null);
            return;
        }

        const NOTE_SPAN = 1;
        const px = this.pxPerTick > 0 ? this.pxPerTick : 1;
        const tickStart = Math.min(box.startTick, box.currentTick);
        const tickEnd = Math.max(box.startTick, box.currentTick) + NOTE_SPAN;
        const left = Math.round(tickStart * px);
        const right = Math.round(tickEnd * px);

        const keyTop = Math.max(box.startKey, box.currentKey);
        const keyBottom = Math.min(box.startKey, box.currentKey);
        const top = (this.keyRange.max - keyTop) * this.keyHeight;
        const bottom = (this.keyRange.max - keyBottom + 1) * this.keyHeight;

        this.queueOverlayRect({
            left: Math.min(left, right),
            top: Math.min(top, bottom),
            width: Math.max(1, Math.abs(right - left)),
            height: Math.max(1, Math.abs(bottom - top))
        });
    }

    private queueOverlayRect(
        rect: { left: number; top: number; width: number; height: number } | null
    ) {
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

    pointerButtonClass(mode: PianoRollPointerMode) {
        return this.pointerMode === mode
            ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 dark:hover:bg-indigo-600/80 hover:text-white'
            : '';
    }
}

export const pianoRollState = new PianoRollState();
