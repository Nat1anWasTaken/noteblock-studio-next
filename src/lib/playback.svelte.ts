import { browser } from '$app/environment';
import { Instrument, type Note, type Song, type TempoChange } from './types';

/**
 * Loop behavior for playback.
 */
export enum LoopMode {
    Off = 'off',
    Song = 'song',
    Selection = 'selection'
}

const soundMap: Record<Instrument, HTMLAudioElement> = browser
    ? {
          [Instrument.Banjo]: new Audio('/notes/banjo.ogg'),
          [Instrument.DoubleBass]: new Audio('/notes/bass.ogg'),
          [Instrument.BassDrum]: new Audio('/notes/bd.ogg'),
          [Instrument.Bell]: new Audio('/notes/bell.ogg'),
          [Instrument.Bit]: new Audio('/notes/bit.ogg'),
          [Instrument.CowBell]: new Audio('/notes/cow_bell.ogg'),
          [Instrument.Didgeridoo]: new Audio('/notes/didgeridoo.ogg'),
          [Instrument.Flute]: new Audio('/notes/flute.ogg'),
          [Instrument.Guitar]: new Audio('/notes/guitar.ogg'),
          [Instrument.Piano]: new Audio('/notes/harp.ogg'),
          [Instrument.Click]: new Audio('/notes/hat.ogg'),
          [Instrument.Chime]: new Audio('/notes/icechime.ogg'),
          [Instrument.IronXylophone]: new Audio('/notes/iron_xylophone.ogg'),
          [Instrument.Pling]: new Audio('/notes/pling.ogg'),
          [Instrument.SnareDrum]: new Audio('/notes/snare.ogg'),
          [Instrument.Xylophone]: new Audio('/notes/xylobone.ogg')
      }
    : ({} as Record<Instrument, HTMLAudioElement>);

function configureBaseAudio(): void {
    if (!browser) return;
    for (const instKey of Object.keys(soundMap)) {
        const inst = Number(instKey) as Instrument;
        const el = soundMap[inst];
        if (!el) continue;
        el.preload = 'auto';
        (el as any).preservesPitch = false;
        (el as any).mozPreservesPitch = false;
        (el as any).webkitPreservesPitch = false;
    }
}

const audioPool: Record<Instrument, HTMLAudioElement[]> = browser
    ? ({} as Record<Instrument, HTMLAudioElement[]>)
    : ({} as Record<Instrument, HTMLAudioElement[]>);

const MAX_POOL_SIZE = 16;

function createPooledAudio(instrument: Instrument): HTMLAudioElement {
    const base = soundMap[instrument];
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.preload = 'auto';
    (node as any).preservesPitch = false;
    (node as any).mozPreservesPitch = false;
    (node as any).webkitPreservesPitch = false;
    return node;
}

function getPooledAudio(instrument: Instrument): HTMLAudioElement {
    if (!browser) return {} as HTMLAudioElement;
    const pool = (audioPool[instrument] ||= []);
    for (const el of pool) {
        if (el.ended || el.paused) {
            try {
                el.currentTime = 0;
            } catch {}
            return el;
        }
    }
    if (pool.length < MAX_POOL_SIZE) {
        const el = createPooledAudio(instrument);
        pool.push(el);
        return el;
    }
    const reused = pool[0];
    try {
        reused.currentTime = 0;
    } catch {}
    return reused;
}

configureBaseAudio();

/**
 * Play a single Note using the mapped instrument sample.
 *
 * Delegates to `playSound` using the fields from the provided `Note`.
 * See `src/lib/noteblocks.ts` for the `Note` shape and value ranges
 * (e.g., `key` 0–87, `velocity` 0–100, `pitch` in cents).
 */
export async function playNote(note: Note) {
    return await playSound(note.instrument, note.key, note.velocity, note.pitch);
}

/**
 * Play an instrument sample at a given musical key, velocity, and pitch offset.
 *
 * - `instrument`: One of the `Instrument` enum values defined in `noteblocks.ts`.
 * - `key`: Piano key index 0–87 where 0=A0 and 87=C8. Used to derive playback rate.
 * - `velocity`: Loudness 0–100. Scaled to audio volume (max ~0.5).
 * - `pitch`: Fine detune in cents (−1200 to 1200). Applied to playback rate.
 *
 * Returns a promise from `HTMLAudioElement.play()` resolving when playback starts.
 */
export async function playSound(
    instrument: Instrument,
    key: number,
    velocity: number,
    pitch: number
) {
    if (!browser) return;
    const audio = getPooledAudio(instrument);

    // Set volume based on velocity
    audio.volume = (velocity / 100) * 0.5;

    const baseSampleKey = 33;
    const keyOffset = key - baseSampleKey;
    const pitchOffset = pitch / 1200; // Convert cents to semitones

    // Combine key and pitch offsets: 2^(semitones/12)
    audio.playbackRate = Math.pow(2, (keyOffset + pitchOffset) / 12);

    return await audio.play();
}

export class Player {
    private _isPlaying = $state(false);
    private _currentTick = $state(0);
    private _tempo = $state(20);
    private _ticksPerBeat = $state(4);
    private _beatsPerBar = $state(4);

    // Looping and selection state
    private _loopMode = $state<LoopMode>(LoopMode.Off);
    private _selectionStart = $state<number | null>(null);
    private _selectionEnd = $state<number | null>(null);

    private interval: ReturnType<typeof setTimeout> | null = null;
    private _nextTickAt = 0;
    private _tickNotes: Map<number, Note[]> = new Map();
    private _tempoChanges: Map<number, TempoChange> = new Map();

    public song: Song | null = null;

    get isPlaying() {
        return this._isPlaying;
    }

    get currentTick() {
        return this._currentTick;
    }

    get tempo() {
        return this._tempo;
    }

    get ticksPerBeat() {
        return this._ticksPerBeat;
    }

    get beatsPerBar() {
        return this._beatsPerBar;
    }

    /** Current loop mode. */
    get loopMode() {
        return this._loopMode;
    }

    /** Selection start tick (inclusive) or null. */
    get selectionStart() {
        return this._selectionStart;
    }

    /** Selection end tick (exclusive) or null. */
    get selectionEnd() {
        return this._selectionEnd;
    }

    /**
     * Change loop mode.
     */
    setLoopMode(mode: LoopMode) {
        this._loopMode = mode;
    }

    /**
     * Set selection start tick (inclusive). Clamps to valid range.
     */
    setSelectionStart(tick: number) {
        const clamped = this.clampTick(tick);
        this._selectionStart = clamped;
        // Ensure start <= end when both set
        if (this._selectionEnd !== null && this._selectionEnd < clamped) {
            this._selectionEnd = clamped;
        }
    }

    /**
     * Set selection end tick (exclusive). Clamps to valid range.
     */
    setSelectionEnd(tick: number) {
        const clamped = this.clampTick(tick);
        this._selectionEnd = clamped;
        // Ensure start <= end when both set
        if (this._selectionStart !== null && this._selectionStart > clamped) {
            this._selectionStart = clamped;
        }
    }

    /**
     * Clear any active selection.
     */
    clearSelection() {
        this._selectionStart = null;
        this._selectionEnd = null;
    }

    /** Clamp an arbitrary tick to [0, song.length] if a song is loaded, or [0, +Inf) otherwise. */
    private clampTick(tick: number): number {
        const base = Math.max(0, tick | 0);
        if (!this.song) return base;
        return Math.min(base, this.song.length);
    }

    private hasValidSelection(): boolean {
        return (
            this._selectionStart !== null &&
            this._selectionEnd !== null &&
            this._selectionEnd > this._selectionStart
        );
    }

    nextTick() {
        if (!this.song) return;

        // Handle loop boundaries before emitting notes
        if (this._loopMode === LoopMode.Selection && this.hasValidSelection()) {
            const start = this._selectionStart as number;
            const end = Math.min(this._selectionEnd as number, this.song.length);
            // If we've just left the selection on the right bound, wrap to start
            if (this._currentTick >= end) {
                this._currentTick = start;
            } else if (this._currentTick < start) {
                // Before selection: do not force-jump; stop at song end if reached
                if (Player.atSongEnd(this._currentTick, this.song)) return this.stopInternal();
            }
        } else if (this._loopMode === LoopMode.Song) {
            if (Player.atSongEnd(this._currentTick, this.song)) {
                this._currentTick = 0;
            }
        } else {
            if (Player.atSongEnd(this._currentTick, this.song)) return this.stopInternal();
        }
        const notes = Player.getNotesAtTick(this._tickNotes, this._currentTick);
        if (notes) {
            for (const n of notes) playNote(n);
        }
        const change = Player.getTempoChangeAtTick(this._tempoChanges, this._currentTick);
        if (change) {
            this._tempo = change.tempo;
            this._ticksPerBeat = change.ticksPerBeat;
            this._beatsPerBar = change.beatsPerBar;
        }
        this._currentTick++;
    }

    /**
     * Start playing the loaded song from the current tick.
     * Throws if no song is loaded.
     *
     */
    async resume() {
        if (!this.song) throw new Error('No song loaded');

        this._isPlaying = true;

        // Do not force cursor into selection on resume; only ensure song loop wraps
        if (this._loopMode === LoopMode.Song) {
            if (Player.atSongEnd(this._currentTick, this.song)) this._currentTick = 0;
        }

        if (!this.interval) this._nextTickAt = performance.now();
        this.schedule();
    }

    /**
     * Pause playback.
     * Throws if the player is not running.
     */
    async pause() {
        this._isPlaying = false;

        if (!this.interval) {
            throw new Error('Player is not running');
        }

        clearTimeout(this.interval);
        this.interval = null;
    }

    /**
     * Set the song to be played.
     * @param song The song to load into the player.
     */
    setSong(song: Song) {
        this.song = song;
        this._currentTick = 0;
        this._tempo = song.tempo ?? this._tempo;
        const { tickNotes, tempoChanges } = Player.buildIndexes(song);
        this._tickNotes = tickNotes;
        this._tempoChanges = tempoChanges;

        // Normalize selection to the bounds of the new song
        if (this._selectionStart !== null)
            this._selectionStart = this.clampTick(this._selectionStart);
        if (this._selectionEnd !== null) this._selectionEnd = this.clampTick(this._selectionEnd);
        if (
            this._selectionStart !== null &&
            this._selectionEnd !== null &&
            this._selectionEnd < this._selectionStart
        ) {
            // Keep consistent invariant start <= end
            this._selectionEnd = this._selectionStart;
        }
    }

    private schedule() {
        if (!this._isPlaying) return;
        const delay = Math.max(0, this._nextTickAt - performance.now());
        this.interval = setTimeout(() => {
            this.nextTick();
            if (!this._isPlaying) return;
            this._nextTickAt += 1000 / this._tempo;
            this.schedule();
        }, delay);
    }

    private static atSongEnd(currentTick: number, song: Song | null): boolean {
        return !!song && currentTick >= song.length;
    }

    private static getNotesAtTick(map: Map<number, Note[]>, tick: number): Note[] | undefined {
        return map.get(tick);
    }

    private static getTempoChangeAtTick(
        map: Map<number, TempoChange>,
        tick: number
    ): TempoChange | undefined {
        return map.get(tick);
    }

    private static buildIndexes(song: Song) {
        const tickNotes = new Map<number, Note[]>();
        const tempoChanges = new Map<number, TempoChange>();

        for (const channel of song.channels) {
            if (channel.kind !== 'note') continue;
            for (const section of channel.sections) {
                const base = section.startingTick;
                for (const note of section.notes) {
                    const absTick = base + note.tick;
                    const arr = tickNotes.get(absTick);
                    if (arr) arr.push(note);
                    else tickNotes.set(absTick, [note]);
                }
            }
        }

        for (const channel of song.channels) {
            if (channel.kind !== 'tempo') continue;
            for (const t of channel.tempoChanges) {
                tempoChanges.set(t.tick, t);
            }
        }

        return { tickNotes, tempoChanges };
    }

    private stopInternal() {
        this._isPlaying = false;
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
    }
}
