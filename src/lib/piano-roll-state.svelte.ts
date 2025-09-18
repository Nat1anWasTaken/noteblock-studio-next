import { editorState, PointerMode } from '$lib/editor-state.svelte';
import {
    pianoRollMouse,
    type KeyRange,
    type PianoRollPointerMode
} from '$lib/piano-roll-mouse.svelte';
import { LoopMode, player } from '$lib/playback.svelte';
import type { Note, NoteChannel, NoteSection } from '$lib/types';

export type PianoRollContext = {
    channel: NoteChannel;
    section: NoteSection;
    channelIndex: number;
    sectionIndex: number;
};

const DEFAULT_KEY_RANGE: KeyRange = { min: 33, max: 57 };
const NOTE_SPAN = 1;

function computeKeyRange(notes: Note[] | undefined): KeyRange {
    if (!notes || notes.length === 0) return DEFAULT_KEY_RANGE;
    let min = Math.min(...notes.map((n) => n.key));
    let max = Math.max(...notes.map((n) => n.key));
    min = Math.max(0, min - 2);
    max = Math.min(87, max + 2);
    if (max - min < 12) {
        const pad = Math.ceil((12 - (max - min)) / 2);
        min = Math.max(0, min - pad);
        max = Math.min(87, max + pad);
    }
    return { min, max };
}

export class PianoRollState {
    sheetOpen = $state(false);
    pointerMode = $state<PianoRollPointerMode>(PointerMode.Normal);

    gridScroller = $state<HTMLDivElement | null>(null);
    keysScroller = $state<HTMLDivElement | null>(null);
    gridContent = $state<HTMLDivElement | null>(null);
    gridScrollLeft = $state(0);
    gridScrollTop = $state(0);

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

    keyRange = $derived.by<KeyRange>(() => computeKeyRange(this.sectionData?.section?.notes));
    keyCount = $derived.by(() => this.keyRange.max - this.keyRange.min + 1);
    gridHeight = $derived(Math.max(1, this.keyCount) * this.keyHeight);

    rawGridWidth = $derived.by(() => {
        const section = this.sectionData?.section;
        if (!section) return 0;
        const pxTick = this.pxPerTick > 0 ? this.pxPerTick : 1;
        const lengthPx = section.length * pxTick;
        const minWidth = Math.max(640, this.beatsPerBar * this.ticksPerBeat * pxTick);
        return Math.max(minWidth, Math.ceil(lengthPx));
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
        const selectedSet = new Set(pianoRollMouse.selectedNotes);

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
        return { label: `${noteName}${octave}`, isBlack };
    }

    keyRows = $derived.by(() => {
        const rows: Array<{ key: number; label: string; isBlack: boolean }> = [];
        for (let key = this.keyRange.max; key >= this.keyRange.min; key--) {
            const info = this.keyNumberToInfo(key);
            rows.push({ key, ...info });
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
        this.pointerMode = mode;
    }

    pointerButtonClass(mode: PianoRollPointerMode) {
        return this.pointerMode === mode
            ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 dark:hover:bg-indigo-600/80 hover:text-white'
            : '';
    }
}

export const pianoRollState = new PianoRollState();
