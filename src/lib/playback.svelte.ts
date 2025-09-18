import { browser } from '$app/environment';
import {
    Instrument,
    type Note,
    type NoteChannel,
    type Song,
    type TempoChange,
    type TempoChannel
} from './types';
import { generateChannelId } from './utils';

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

const metronomeSounds: Record<'high' | 'low', HTMLAudioElement> = browser
    ? {
          high: new Audio('/metronome.wav'),
          low: new Audio('/metronome.wav')
      }
    : ({} as Record<'high' | 'low', HTMLAudioElement>);

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
    // Metronome base config
    metronomeSounds.high.preload = 'auto';
    metronomeSounds.low.preload = 'auto';
    (metronomeSounds.high as any).preservesPitch = false;
    (metronomeSounds.high as any).mozPreservesPitch = false;
    (metronomeSounds.high as any).webkitPreservesPitch = false;
    (metronomeSounds.low as any).preservesPitch = false;
    (metronomeSounds.low as any).mozPreservesPitch = false;
    (metronomeSounds.low as any).webkitPreservesPitch = false;
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

function connectWithReverbGlobal(
    source: AudioBufferSourceNode,
    gainValue: number,
    ctx: AudioContext,
    reverbNode: ConvolverNode | null,
    reverbGain: GainNode | null,
    dryGain: GainNode | null,
    masterGain: GainNode | null
): void {
    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    // Route through reverb chain if available, otherwise direct to master
    if (reverbNode && reverbGain && dryGain) {
        source.connect(gain);
        // Split signal: dry path and wet path
        gain.connect(dryGain); // Dry signal
        gain.connect(reverbNode); // Wet signal through reverb
    } else {
        source.connect(gain).connect(masterGain ?? ctx.destination);
    }
}

async function playWithHtmlAudio(
    instrument: Instrument,
    key: number,
    velocity: number,
    pitch: number
) {
    const audio = getPooledAudio(instrument);
    audio.volume = (velocity / 100) * 0.5;

    const baseSampleKey = 33;
    const keyOffset = key - baseSampleKey;
    const pitchOffset = pitch / 1200;
    audio.playbackRate = Math.pow(2, (keyOffset + pitchOffset) / 12);

    return await audio.play();
}

// Emit DOM events when notes play so the UI can highlight
export function emitNotePlayed(noteId: string, durationMs = 120) {
    if (!browser) return;
    try {
        document.dispatchEvent(new CustomEvent('noteplayed', { detail: { id: noteId } }));
    } catch {}
    setTimeout(() => {
        try {
            document.dispatchEvent(new CustomEvent('noteended', { detail: { id: noteId } }));
        } catch {}
    }, durationMs);
}

/**
 * Play a single Note using the mapped instrument sample.
 *
 * Delegates to `playSound` using the fields from the provided `Note`.
 * See `src/lib/noteblocks.ts` for the `Note` shape and value ranges
 * (e.g., `key` 0–87, `velocity` 0–100, `pitch` in cents).
 */
export async function playNote(note: Note, instrument: Instrument) {
    return await playSound(instrument, note.key, note.velocity, note.pitch);
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

    // Early return to HTML Audio if Web Audio reverb not available
    if (!player.audioCtx || !player.reverbNode || !player.reverbGain || !player.dryGain) {
        return await playWithHtmlAudio(instrument, key, velocity, pitch);
    }

    try {
        // Use Web Audio API for playback with reverb
        const buf = player.buffers.get(instrument);
        if (!buf) {
            return await playWithHtmlAudio(instrument, key, velocity, pitch);
        }

        const ctx = player.audioCtx;
        const src = ctx.createBufferSource();
        src.buffer = buf;

        // Compute playback rate
        const baseSampleKey = 33;
        const keyOffset = key - baseSampleKey;
        const pitchOffset = pitch / 1200;
        src.playbackRate.value = Math.pow(2, (keyOffset + pitchOffset) / 12);

        connectWithReverbGlobal(
            src,
            (velocity / 100) * 0.5,
            ctx,
            player.reverbNode,
            player.reverbGain,
            player.dryGain,
            player.masterGain
        );

        return src.start();
    } catch {
        // Fall through to HTML Audio fallback
        return await playWithHtmlAudio(instrument, key, velocity, pitch);
    }
}

export class Player {
    // TODO: Refactor this class into several classes that have their own responsibilities.
    private _isPlaying = $state(false);
    private _currentTick = $state(0);
    private _tempo = $state(20);
    private _ticksPerBeat = $state(10);
    private _beatsPerBar = $state(4);
    private _metronomeEnabled = $state(false);

    // Looping and selection state
    private _loopMode = $state<LoopMode>(LoopMode.Off);
    private _selectionStart = $state<number | null>(null);
    private _selectionEnd = $state<number | null>(null);

    // UI tick updater (no audio emission)
    private interval: ReturnType<typeof setTimeout> | null = null;
    private _nextTickAt = 0;

    // Web Audio lookahead scheduler
    private _audioCtx: AudioContext | null = null;
    private _buffers: Map<Instrument, AudioBuffer> = new Map();
    private _metronomeBuffer: AudioBuffer | null = null;
    private _masterGain: GainNode | null = null;
    private _reverbNode: ConvolverNode | null = null;
    private _reverbGain: GainNode | null = null;
    private _dryGain: GainNode | null = null;
    private _schedulerTimer: ReturnType<typeof setInterval> | null = null;
    private _scheduleAheadSec = 0.15; // seconds to schedule ahead
    private _schedulerIntervalMs = 25; // how often to run scheduler
    private _nextTickToSchedule = 0;
    private _nextNoteTime = 0; // in audioCtx.currentTime seconds
    private _muteTickAudio = false; // suppress audio inside nextTick() when UI-updating
    private _scheduled: Array<{ node: AudioBufferSourceNode; when: number; tick: number }> = [];

    // Cached sorted tempo changes for quick lookup
    private _tempoChangeList: TempoChange[] = [];
    private _tickNotes: Map<
        number,
        Array<{ note: Note; instrument: Instrument; channelId: string }>
    > = new Map();
    private _tempoChanges: Map<number, TempoChange> = new Map();
    // Map for resolving current channel objects by id (keeps up-to-date when channels replaced)
    private _channelsById: Map<string, NoteChannel> = new Map();

    private _song = $state<Song | null>(null);

    get song(): Song | null {
        return this._song;
    }

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

    get metronomeEnabled() {
        return this._metronomeEnabled;
    }

    // Reverb system getters for external access
    get audioCtx() {
        return this._audioCtx;
    }

    get reverbNode() {
        return this._reverbNode;
    }

    get reverbGain() {
        return this._reverbGain;
    }

    get dryGain() {
        return this._dryGain;
    }

    get buffers() {
        return this._buffers;
    }

    get masterGain() {
        return this._masterGain;
    }

    // --- Bar/Beat helpers (considering tempo/time-signature changes) ---
    /**
     * Current bar index (0-based), derived from current tick and tempo changes.
     */
    get currentBar(): number {
        return this.computeBarBeatAtTick(this._currentTick).bar;
    }

    /**
     * Current beat index within the bar (0-based), derived from current tick.
     */
    get currentBeat(): number {
        return this.computeBarBeatAtTick(this._currentTick).beat;
    }

    /**
     * Get the bar number (0-based) at a specific tick.
     */
    getBarAtTick(tick: number): number {
        return this.computeBarBeatAtTick(tick).bar;
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
        this.resyncSchedulerOnStateChange();
    }

    /**
     * Rebuild internal indexes from the current song without resetting playback cursor.
     * Useful after in-place edits to the song data.
     */
    refreshIndexes() {
        const { tickNotes, tempoChanges, channelsById } = Player.buildIndexes(this._song as any);
        this._tickNotes = tickNotes;
        this._tempoChanges = tempoChanges;
        this._tempoChangeList = Array.from(tempoChanges.values()).sort((a, b) => a.tick - b.tick);
        this._channelsById = channelsById;
        // Keep selection bounds within new song length if applicable
        if (this._selectionStart !== null)
            this._selectionStart = this.clampTick(this._selectionStart);
        if (this._selectionEnd !== null) this._selectionEnd = this.clampTick(this._selectionEnd);
        this.resyncSchedulerOnStateChange();
    }

    /** Enable or disable the metronome clicks during playback. */
    setMetronomeEnabled(on: boolean) {
        this._metronomeEnabled = !!on;
        this.resyncSchedulerOnStateChange();
    }

    /** Set the playback tempo in ticks per second.
     * If a song is loaded, update the last tempo-change event's tempo (prefer the last one
     * at or before the current tick). Otherwise, just set the internal tempo.
     */
    setTempo(tempo: number) {
        if (!(tempo > 0)) return;

        if (this.song && this._tempoChangeList.length > 0) {
            // Find the last tempo change at or before the current tick
            let idx = -1;
            for (let i = 0; i < this._tempoChangeList.length; i++) {
                const ch = this._tempoChangeList[i];
                if (ch.tick <= this._currentTick) idx = i;
                else break;
            }
            if (idx === -1) idx = this._tempoChangeList.length - 1; // fallback to last change in song

            const target = this._tempoChangeList[idx];
            if (target) {
                // Update the change object
                target.tempo = tempo;

                // Mirror update into the map (same object instance, but keep map consistent)
                const existing = this._tempoChanges.get(target.tick);
                if (existing) existing.tempo = tempo;
                this._tempoChanges.set(target.tick, target);

                // Update the underlying song channel data
                for (const ch of this.song.channels) {
                    if (ch.kind !== 'tempo') continue;
                    for (const t of ch.tempoChanges) {
                        if (t.tick === target.tick) {
                            t.tempo = tempo;
                        }
                    }
                }

                // Keep Song.tempo in sync if we edited the very first change at tick 0
                if (target.tick === 0) this.song.tempo = tempo;

                // If that change is currently active, also reflect immediately in the player
                if (target.tick <= this._currentTick) this._tempo = tempo;

                this.resyncSchedulerOnStateChange();
                return;
            }
        }

        // Fallback: no song or no tempo changes; set internal tempo directly
        this._tempo = tempo;
        this.resyncSchedulerOnStateChange();
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
        this.resyncSchedulerOnStateChange();
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
        this.resyncSchedulerOnStateChange();
    }

    /**
     * Jump to a specific bar (0-based). Sets the tick to the start of that bar.
     */
    setCurrentBar(bar: number) {
        const { tick } = this.findTickForBarBeat(Math.max(0, bar | 0), 0);
        this._currentTick = this.clampTick(tick);
        this.resyncSchedulerOnSeek();
    }

    /**
     * Set the current beat (0-based) within the current bar.
     */
    setCurrentBeat(beat: number) {
        const bar = this.currentBar;
        const { tick } = this.findTickForBarBeat(bar, Math.max(0, beat | 0));
        this._currentTick = this.clampTick(tick);
        this.resyncSchedulerOnSeek();
    }

    /**
     * Jump directly to a given bar and beat (both 0-based).
     */
    setBarBeat(bar: number, beat: number) {
        const { tick } = this.findTickForBarBeat(Math.max(0, bar | 0), Math.max(0, beat | 0));
        this._currentTick = this.clampTick(tick);
        this.resyncSchedulerOnSeek();
    }

    /**
     * Directly set the current tick without clamping to song length.
     * Keeps a lower bound of 0 for sanity, but allows "free" cursor beyond the song.
     */
    setCurrentTick(tick: number) {
        this._currentTick = Math.max(0, tick | 0);
        this.resyncSchedulerOnSeek();
    }

    /**
     * Clear any active selection.
     */
    clearSelection() {
        this._selectionStart = null;
        this._selectionEnd = null;
        this.resyncSchedulerOnStateChange();
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
                if (this.atSongEnd(this._currentTick, this.song)) return this.stopInternal();
            }
        } else if (this._loopMode === LoopMode.Song) {
            if (this.atSongEnd(this._currentTick, this.song)) {
                this._currentTick = 0;
            }
        } else {
            if (this.atSongEnd(this._currentTick, this.song)) return this.stopInternal();
        }
        if (!this._muteTickAudio) {
            const notes = Player.getNotesAtTick(this._tickNotes, this._currentTick);
            if (notes) {
                for (const { note, instrument, channelId } of notes) {
                    // resolve channel object from current channels map
                    const channel =
                        this._channelsById.get(channelId) ??
                        this.song?.channels.find((c) => (c as any).id === channelId);
                    if (!channel || channel.kind !== 'note') continue;
                    if ((channel as NoteChannel).isMuted) continue;
                    try {
                        playNote(note, instrument);
                    } catch {}
                    const id = `${this._currentTick}:${note.key}:${instrument}`;
                    emitNotePlayed(id, 120);
                }
            }
        }
        // Update tempo from the latest active tempo change (not just changes at this exact tick)
        const latestTempo = this.getTempoAtTick(this._currentTick);
        if (latestTempo !== this._tempo) {
            this._tempo = latestTempo;
        }

        // Also check for time signature changes at this exact tick
        const change = Player.getTempoChangeAtTick(this._tempoChanges, this._currentTick);
        if (change) {
            this._ticksPerBeat = change.ticksPerBeat;
            this._beatsPerBar = change.beatsPerBar;
        }
        // Metronome: click on each beat boundary (accent first beat of bar)
        if (this._metronomeEnabled && !this._muteTickAudio) {
            const seg = this.getSegmentAtTick(this._currentTick);
            if (seg) {
                const ticksInto = this._currentTick - seg.start;
                if (ticksInto >= 0 && seg.tpb > 0 && ticksInto % seg.tpb === 0) {
                    const beatsInto = Math.floor(ticksInto / seg.tpb);
                    const beatInBar = beatsInto % seg.bpb;
                    this.playMetronome(beatInBar === 0);
                }
            }
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
            if (this.atSongEnd(this._currentTick, this.song)) this._currentTick = 0;
        }

        // Start UI updater (tick counter only, no audio emission)
        this._muteTickAudio = true;
        if (!this.interval) this._nextTickAt = performance.now();
        this.scheduleUi();

        // Prepare audio context and schedule engine
        await this.ensureAudioReady();
        this.startAudioScheduler();
    }

    /**
     * Pause playback.
     * Throws if the player is not running.
     */
    async pause() {
        this._isPlaying = false;

        // Stop UI updater
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }

        // Stop audio scheduler (already scheduled notes may still play)
        if (this._schedulerTimer) {
            clearInterval(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        // Cancel any scheduled audio from now on
        this.cancelScheduledFromNow();
    }

    /**
     * Set the song to be played.
     * @param song The song to load into the player.
     */
    setSong(song: Song) {
        this._song = song;
        this._currentTick = 0;
        this._tempo = song.tempo ?? this._tempo;
        const { tickNotes, tempoChanges, channelsById } = Player.buildIndexes(song);
        this._tickNotes = tickNotes;
        this._tempoChanges = tempoChanges;
        this._tempoChangeList = Array.from(tempoChanges.values()).sort((a, b) => a.tick - b.tick);
        this._channelsById = channelsById;

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
        // If playing, ensure scheduler respects the new state
        this.resyncSchedulerOnStateChange();
    }

    /**
     * Toggle mute for a note channel by index.
     * Updates the underlying Song data and resyncs the scheduler so any
     * already-scheduled audio is cancelled if necessary.
     */
    setMute(index: number) {
        if (!this.song) return;
        const ch = this.song.channels[index];
        if (!ch || ch.kind !== 'note') return;
        ch.isMuted = !ch.isMuted;
        // If we have a channelsById map, keep it in sync (the object is the same instance)
        if ((ch as any).id) {
            this._channelsById.set((ch as any).id as string, ch as NoteChannel);
        }
        // Resync scheduler so scheduled notes respect the new mute state.
        this.resyncSchedulerOnStateChange();
    }

    /**
     * Solo a channel: mute all other note channels and unmute the target.
     * If the target is already the only unmuted note channel, clear the solo
     * (unmute all note channels).
     */
    setSolo(index: number) {
        if (!this.song) return;
        const target = this.song.channels[index];
        if (!target || target.kind !== 'note') return;

        // Collect note channels with their indexes
        const noteChannels: Array<{ ch: NoteChannel; idx: number }> = [];
        for (let i = 0; i < this.song.channels.length; i++) {
            const c = this.song.channels[i];
            if (c.kind === 'note') noteChannels.push({ ch: c as NoteChannel, idx: i });
        }

        const unmuted = noteChannels.filter((n) => !n.ch.isMuted);
        const isAlreadySoloed = unmuted.length === 1 && unmuted[0].idx === index;

        if (isAlreadySoloed) {
            for (const n of noteChannels) {
                if (n.ch.isMuted) {
                    this.setMute(n.idx);
                }
            }
        } else {
            for (const n of noteChannels) {
                const shouldBeMuted = n.idx !== index;
                if (n.ch.isMuted !== shouldBeMuted) {
                    this.setMute(n.idx);
                }
            }
        }
    }

    /**
     * Update a note channel with partial data.
     * Updates the channel in place and refreshes indexes to keep player in sync.
     */
    updateNoteChannel(index: number, updates: Partial<NoteChannel>) {
        // TODO: fix the instrument latency when updating instrument in place
        if (!this.song) return;
        const channel = this.song.channels[index];
        if (!channel || channel.kind !== 'note') return;

        // Apply updates to the channel
        Object.assign(channel, updates);

        // Keep channelsById map in sync if the channel has an id
        if ((channel as any).id) {
            this._channelsById.set((channel as any).id as string, channel as NoteChannel);
        }

        // Refresh indexes to ensure player state is synchronized
        this.refreshIndexes();
    }

    /**
     * Update a tempo channel with partial data.
     * Updates the channel in place and refreshes indexes to keep player in sync.
     */
    updateTempoChannel(index: number, updates: Partial<TempoChannel>) {
        if (!this.song) return;
        const channel = this.song.channels[index];
        if (!channel || channel.kind !== 'tempo') return;

        // Apply updates to the channel
        Object.assign(channel, updates);

        // Refresh indexes to ensure player state is synchronized
        this.refreshIndexes();
    }

    /**
     * Remove a channel by index.
     * Updates the song in place and refreshes indexes to keep player in sync.
     */
    removeChannel(index: number) {
        if (!this.song) return;
        if (index < 0 || index >= this.song.channels.length) return;

        const channel = this.song.channels[index];

        // Remove the channel from the song
        this.song.channels.splice(index, 1);

        // If removing a note channel, clean up the channelsById map
        if (channel.kind === 'note' && (channel as any).id) {
            this._channelsById.delete((channel as any).id as string);
        }

        // Refresh indexes to ensure player state is synchronized
        this.refreshIndexes();
    }

    /**
     * Create a new note channel and add it to the song.
     * @param channelData The data for creating the new channel
     * @returns The index of the created channel, or -1 if creation failed
     */
    createNoteChannel(channelData: { name: string; instrument: Instrument }): number {
        if (!this.song) return -1;

        const newChannel: NoteChannel = {
            kind: 'note',
            name: channelData.name,
            id: generateChannelId(),
            sections: [],
            pan: 0,
            instrument: channelData.instrument,
            isMuted: false
        };

        // Add the channel to the song
        this.song.channels.push(newChannel);
        const newIndex = this.song.channels.length - 1;

        // Update the channelsById map
        this._channelsById.set(newChannel.id!, newChannel);

        // Refresh indexes to ensure player state is synchronized
        this.refreshIndexes();

        return newIndex;
    }

    private scheduleUi() {
        if (!this._isPlaying) return;
        const delay = Math.max(0, this._nextTickAt - performance.now());
        this.interval = setTimeout(() => {
            this.nextTick(); // UI-only advance (audio suppressed)
            if (!this._isPlaying) return;
            this._nextTickAt += 1000 / this._tempo;
            this.scheduleUi();
        }, delay);
    }

    /**
     * Return the time-signature segment active at a tick.
     */
    private getSegmentAtTick(
        tick: number
    ): { start: number; end: number; tpb: number; bpb: number } | null {
        const segments = this.getSegments();
        for (const seg of segments) {
            if (tick >= seg.start && tick < seg.end) return seg;
        }
        return segments.length ? segments[segments.length - 1] : null;
    }

    /**
     * Play a metronome click. Accent alters playback rate/volume slightly.
     */
    private playMetronome(accent: boolean) {
        if (!browser) return;
        // If using Web Audio, schedule into the audio graph for tighter timing
        if (this._audioCtx && this._metronomeBuffer) {
            const ctx = this._audioCtx;
            const src = ctx.createBufferSource();
            src.buffer = this._metronomeBuffer;
            const gain = ctx.createGain();
            gain.gain.value = accent ? 0.8 : 0.5;
            src.connect(gain).connect(this._masterGain ?? ctx.destination);
            // Start immediately; for lookahead scheduling we call scheduleMetronome()
            src.start();
            return;
        }
        const base = accent ? metronomeSounds.high : metronomeSounds.low;
        try {
            base.currentTime = 0;
        } catch {}
        base.volume = accent ? 0.65 : 0.4;
        void base.play();
    }

    private atSongEnd(currentTick: number, song: Song | null): boolean {
        if (!song) return false;
        // Add 2 bars worth of trailing beats after the last note to allow notes to finish playing
        // and provide some musical breathing room
        const trailingBars = 2;
        const { tpb, bpb } = this.getSignatureAtTick(song.length) ?? {
            tpb: this._ticksPerBeat,
            bpb: this._beatsPerBar
        };
        const trailingTicks = trailingBars * bpb * tpb;
        return currentTick >= song.length + trailingTicks;
    }

    private static getNotesAtTick(
        map: Map<number, Array<{ note: Note; instrument: Instrument; channelId: string }>>,
        tick: number
    ): Array<{ note: Note; instrument: Instrument; channelId: string }> | undefined {
        return map.get(tick);
    }

    private static getTempoChangeAtTick(
        map: Map<number, TempoChange>,
        tick: number
    ): TempoChange | undefined {
        return map.get(tick);
    }

    private static buildIndexes(song: Song) {
        const tickNotes = new Map<
            number,
            Array<{ note: Note; instrument: Instrument; channelId: string }>
        >();
        const tempoChanges = new Map<number, TempoChange>();
        const channelsById = new Map<string, NoteChannel>();

        for (const channel of song.channels) {
            if (channel.kind !== 'note') continue;
            // ensure channel has a stable id
            if (!(channel as any).id) (channel as any).id = generateChannelId();
            const cid = (channel as any).id as string;
            channelsById.set(cid, channel as NoteChannel);

            for (const section of channel.sections) {
                const base = section.startingTick;
                for (const note of section.notes) {
                    const absTick = base + note.tick;
                    const arr = tickNotes.get(absTick);
                    const item = { note, instrument: channel.instrument, channelId: cid };
                    if (arr) arr.push(item);
                    else tickNotes.set(absTick, [item]);
                }
            }
        }

        for (const channel of song.channels) {
            if (channel.kind !== 'tempo') continue;
            for (const t of channel.tempoChanges) {
                tempoChanges.set(t.tick, t);
            }
        }

        return { tickNotes, tempoChanges, channelsById };
    }

    // --- Web Audio scheduler helpers ---
    private async ensureAudioReady() {
        if (!browser) return;
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
                latencyHint: 'interactive'
            }) as AudioContext;
            this._masterGain = this._audioCtx.createGain();
            this._masterGain.gain.value = 1.0;
            this._masterGain.connect(this._audioCtx.destination);

            // Setup reverb audio chain
            this._reverbNode = this._audioCtx.createConvolver();
            this._reverbNode.buffer = this.createReverbImpulse();

            this._reverbGain = this._audioCtx.createGain();
            this._reverbGain.gain.value = 0.2; // 20% wet signal

            this._dryGain = this._audioCtx.createGain();
            this._dryGain.gain.value = 0.8; // 80% dry signal

            // Connect reverb chain: reverb -> reverbGain -> masterGain
            this._reverbNode.connect(this._reverbGain);
            this._reverbGain.connect(this._masterGain);

            // Connect dry chain: dryGain -> masterGain
            this._dryGain.connect(this._masterGain);
        }
        if (this._audioCtx.state === 'suspended') {
            try {
                await this._audioCtx.resume();
            } catch {}
        }
        // Preload buffers for instruments present in the song in the background
        if (this.song) {
            const instruments = new Set<Instrument>();
            for (const ch of this.song.channels) {
                if (ch.kind === 'note') instruments.add(ch.instrument);
            }
            await Promise.all(
                Array.from(instruments).map((inst) =>
                    this.loadInstrumentBuffer(inst).catch(() => {})
                )
            );
        }
        // Preload metronome buffer
        if (!this._metronomeBuffer) {
            try {
                this._metronomeBuffer = await this.fetchDecode('/metronome.wav');
            } catch {}
        }
    }

    private async fetchDecode(url: string): Promise<AudioBuffer> {
        if (!this._audioCtx) throw new Error('AudioContext not ready');
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        return await this._audioCtx.decodeAudioData(arr);
    }

    private createReverbImpulse(duration: number = 1.5, decay: number = 2): AudioBuffer {
        if (!this._audioCtx) throw new Error('AudioContext not ready');

        const sampleRate = this._audioCtx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this._audioCtx.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const n = length - i;
                // Create exponential decay with some noise for natural reverb
                const envelope = Math.pow(n / length, decay);
                const noise = (Math.random() * 2 - 1) * envelope;
                channelData[i] = noise;
            }
        }

        return impulse;
    }

    private connectWithReverb(source: AudioBufferSourceNode, gainValue: number): void {
        if (!this._audioCtx) return;

        const gain = this._audioCtx.createGain();
        gain.gain.value = gainValue;

        // Route through reverb chain if available, otherwise direct to master
        if (this._reverbNode && this._reverbGain && this._dryGain) {
            source.connect(gain);
            // Split signal: dry path and wet path
            gain.connect(this._dryGain); // Dry signal
            gain.connect(this._reverbNode); // Wet signal through reverb
        } else {
            source.connect(gain).connect(this._masterGain ?? this._audioCtx.destination);
        }
    }

    private async loadInstrumentBuffer(inst: Instrument): Promise<AudioBuffer | null> {
        if (!browser) return null;
        const existing = this._buffers.get(inst);
        if (existing) return existing;
        const base = soundMap[inst];
        if (!base) return null;
        try {
            const buf = await this.fetchDecode(base.src);
            this._buffers.set(inst, buf);
            return buf;
        } catch {
            return null;
        }
    }

    private getTempoAtTick(tick: number): number {
        // Follow song tempo changes; fall back to current/base tempo
        let tempo = this._tempo;
        for (let i = 0; i < this._tempoChangeList.length; i++) {
            const ch = this._tempoChangeList[i];
            if (ch.tick <= tick) tempo = ch.tempo;
            else break;
        }
        return tempo;
    }

    private getSignatureAtTick(tick: number): { tpb: number; bpb: number; segStart: number } {
        // Use existing segment computation for tpb/bpb and start
        const seg = this.getSegmentAtTick(tick);
        if (seg) return { tpb: seg.tpb, bpb: seg.bpb, segStart: seg.start };
        return { tpb: this._ticksPerBeat, bpb: this._beatsPerBar, segStart: 0 };
    }

    private startAudioScheduler() {
        if (!this._audioCtx) return;
        if (!this._isPlaying) return;

        // Initialize scheduling cursor if starting fresh
        this._nextTickToSchedule = this._currentTick;
        this._nextNoteTime = this._audioCtx.currentTime;

        if (this._schedulerTimer) clearInterval(this._schedulerTimer);
        this._schedulerTimer = setInterval(() => this.schedulerLoop(), this._schedulerIntervalMs);
        // Run one immediate pass to reduce initial latency
        this.schedulerLoop();
    }

    private schedulerLoop() {
        if (!this._audioCtx || !this._isPlaying || !this.song) return;
        const ctx = this._audioCtx;
        const aheadUntil = ctx.currentTime + this._scheduleAheadSec;

        while (this._nextNoteTime < aheadUntil) {
            // Loop/stop handling
            if (this.atSongEnd(this._nextTickToSchedule, this.song)) {
                if (this._loopMode === LoopMode.Song) {
                    this._nextTickToSchedule = 0;
                } else if (this._loopMode === LoopMode.Selection && this.hasValidSelection()) {
                    const start = this._selectionStart as number;
                    const end = Math.min(this._selectionEnd as number, this.song.length);
                    if (this._nextTickToSchedule >= end) this._nextTickToSchedule = start;
                } else {
                    // Stop playback when reaching the end in non-loop mode
                    this.stopInternal();
                    return;
                }
            }

            // Selection loop wrap (mid-song)
            if (this._loopMode === LoopMode.Selection && this.hasValidSelection()) {
                const start = this._selectionStart as number;
                const end = Math.min(this._selectionEnd as number, this.song.length);
                if (this._nextTickToSchedule >= end) this._nextTickToSchedule = start;
            }

            // Schedule notes for this tick
            const notes = Player.getNotesAtTick(this._tickNotes, this._nextTickToSchedule) ?? [];
            for (const { note, instrument, channelId } of notes) {
                const channel =
                    this._channelsById.get(channelId) ??
                    this.song?.channels.find((c) => (c as any).id === channelId);
                if (!channel || channel.kind !== 'note') continue;

                if ((channel as NoteChannel).isMuted) {
                    continue;
                }
                this.scheduleNote(instrument, note, this._nextNoteTime, this._nextTickToSchedule);
            }

            // Metronome on beat boundaries
            if (this._metronomeEnabled) {
                const { tpb, bpb, segStart } = this.getSignatureAtTick(this._nextTickToSchedule);
                const ticksInto = this._nextTickToSchedule - segStart;
                if (tpb > 0 && ticksInto >= 0 && ticksInto % tpb === 0) {
                    const beatsInto = Math.floor(ticksInto / tpb);
                    const beatInBar = beatsInto % bpb;
                    this.scheduleMetronome(
                        this._nextNoteTime,
                        beatInBar === 0,
                        this._nextTickToSchedule
                    );
                }
            }

            // Advance time by current tempo
            const tempo = this.getTempoAtTick(this._nextTickToSchedule);
            const secPerTick = tempo > 0 ? 1 / tempo : 0.05; // fallback
            this._nextNoteTime += secPerTick;
            this._nextTickToSchedule += 1;
        }
    }

    private scheduleNote(instrument: Instrument, note: Note, when: number, tick: number) {
        if (!this._audioCtx) return;
        const ctx = this._audioCtx;
        const buf = this._buffers.get(instrument);
        if (!buf) {
            // Fallback to HTMLAudio if buffer not ready yet
            const id = `${tick}:${note.key}:${instrument}`;
            emitNotePlayed(id, 120);
            void playSound(instrument, note.key, note.velocity, note.pitch);
            return;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        // Compute playback rate
        const baseSampleKey = 33;
        const keyOffset = note.key - baseSampleKey;
        const pitchOffset = note.pitch / 1200;
        src.playbackRate.value = Math.pow(2, (keyOffset + pitchOffset) / 12);

        this.connectWithReverb(src, (note.velocity / 100) * 0.5);
        try {
            src.start(when);
        } catch {
            try {
                src.start();
            } catch {}
        }
        // Schedule a UI highlight at the same moment the audio is scheduled to play.
        // Convert audio-time offset to ms and schedule an event.
        const id = `${tick}:${note.key}:${instrument}`;
        try {
            const now = ctx.currentTime;
            const delayMs = Math.max(0, (when - now) * 1000);
            setTimeout(() => emitNotePlayed(id, 120), delayMs);
        } catch {
            // best-effort: if something goes wrong, emit immediately
            try {
                emitNotePlayed(id, 120);
            } catch {}
        }
        this.trackScheduled(src, when, tick);
    }

    private scheduleMetronome(when: number, accent: boolean, tick: number) {
        if (!this._audioCtx || !this._metronomeBuffer) return;
        const ctx = this._audioCtx;
        const src = ctx.createBufferSource();
        src.buffer = this._metronomeBuffer;
        this.connectWithReverb(src, accent ? 0.8 : 0.5);
        try {
            src.start(when);
        } catch {
            try {
                src.start();
            } catch {}
        }
        this.trackScheduled(src, when, tick);
    }

    private trackScheduled(node: AudioBufferSourceNode, when: number, tick: number) {
        this._scheduled.push({ node, when, tick });
        node.onended = () => {
            this._scheduled = this._scheduled.filter((e) => e.node !== node);
        };
    }

    private cancelScheduledFromNow() {
        if (!this._audioCtx) return;
        const now = this._audioCtx.currentTime - 0.002;
        for (const e of this._scheduled) {
            if (e.when >= now) {
                try {
                    e.node.stop(0);
                } catch {}
            }
        }
        this._scheduled = [];
    }

    private resyncSchedulerOnSeek() {
        this._nextTickAt = performance.now();
        if (!this._isPlaying) return;
        if (!this._audioCtx) return;
        this.cancelScheduledFromNow();
        this._nextTickToSchedule = this._currentTick;
        this._nextNoteTime = this._audioCtx.currentTime;
        this.schedulerLoop();
    }

    private resyncSchedulerOnStateChange() {
        if (!this._isPlaying) return;
        if (!this._audioCtx) return;
        this.cancelScheduledFromNow();
        this._nextTickToSchedule = this._currentTick;
        this._nextNoteTime = this._audioCtx.currentTime;
        this.schedulerLoop();
    }

    /**
     * Compute an ordered list of tempo/time-signature segments covering the song.
     * Assumes tempo changes occur at bar boundaries (common in editors).
     */
    private getSegments(): { start: number; end: number; tpb: number; bpb: number }[] {
        const length = this.song?.length ?? Number.POSITIVE_INFINITY;
        const changes = Array.from(this._tempoChanges.values()).sort((a, b) => a.tick - b.tick);

        const segments: { start: number; end: number; tpb: number; bpb: number }[] = [];

        // Determine base signature at 0 if no change at 0
        const firstChangeAtZero = changes.length > 0 && changes[0].tick === 0;
        let cursor = 0;
        let currentTpb = firstChangeAtZero ? changes[0].ticksPerBeat : this._ticksPerBeat;
        let currentBpb = firstChangeAtZero ? changes[0].beatsPerBar : this._beatsPerBar;

        for (let i = firstChangeAtZero ? 1 : 0; i < changes.length; i++) {
            const ch = changes[i];
            if (cursor < ch.tick) {
                segments.push({ start: cursor, end: ch.tick, tpb: currentTpb, bpb: currentBpb });
                cursor = ch.tick;
            }
            currentTpb = ch.ticksPerBeat;
            currentBpb = ch.beatsPerBar;
        }

        if (cursor < length) {
            segments.push({ start: cursor, end: length, tpb: currentTpb, bpb: currentBpb });
        }

        // No song loaded and no changes: provide an open-ended default segment
        if (!this.song && segments.length === 0) {
            segments.push({
                start: 0,
                end: Number.POSITIVE_INFINITY,
                tpb: this._ticksPerBeat,
                bpb: this._beatsPerBar
            });
        }

        return segments;
    }

    /**
     * Convert a tick to bar/beat using the tempo/time-signature segments.
     * Bar and beat are 0-based.
     */
    private computeBarBeatAtTick(tick: number): { bar: number; beat: number } {
        const segments = this.getSegments();
        let barAccum = 0;
        for (const seg of segments) {
            if (tick >= seg.end) {
                const segTicks = seg.end - seg.start;
                const barsInSeg = Math.floor(segTicks / (seg.tpb * seg.bpb));
                barAccum += barsInSeg;
                continue;
            }
            if (tick >= seg.start && tick < seg.end) {
                const ticksInto = tick - seg.start;
                const beatsInto = Math.floor(ticksInto / seg.tpb);
                const barInSeg = Math.floor(beatsInto / seg.bpb);
                const beatInBar = beatsInto % seg.bpb;
                return { bar: barAccum + barInSeg, beat: beatInBar };
            }
        }
        // Past end of song: clamp to last position
        if (segments.length > 0) {
            const last = segments[segments.length - 1];
            const segTicks = Math.max(0, (this.song?.length ?? last.end) - last.start);
            const barsInSeg = Math.floor(segTicks / (last.tpb * last.bpb));
            return { bar: barAccum + barsInSeg, beat: 0 };
        }
        return { bar: 0, beat: 0 };
    }

    /**
     * Convert bar/beat (0-based) to a tick, clamped to song bounds if loaded.
     */
    private findTickForBarBeat(bar: number, beat: number): { tick: number } {
        const segments = this.getSegments();
        const targetBar = Math.max(0, bar | 0);
        let barAccum = 0;
        for (const seg of segments) {
            const barsInSeg = Math.floor((seg.end - seg.start) / (seg.tpb * seg.bpb));
            if (targetBar < barAccum + barsInSeg) {
                const barWithin = targetBar - barAccum;
                const clampedBeat = Math.min(Math.max(0, beat | 0), seg.bpb - 1);
                const tick = seg.start + barWithin * seg.bpb * seg.tpb + clampedBeat * seg.tpb;
                return { tick };
            }
            barAccum += barsInSeg;
        }

        // If requesting a bar beyond the song, clamp to end
        const endTick = this.song?.length ?? bar * this._beatsPerBar * this._ticksPerBeat;
        return { tick: endTick };
    }

    private stopInternal() {
        this._isPlaying = false;
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
        if (this._schedulerTimer) {
            clearInterval(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        this._muteTickAudio = false;
    }

    /**
     * Reset all player state to initial values.
     * Stops playback if currently playing and resets position, selection, and other state.
     */
    reset() {
        // Stop playback if currently playing
        if (this._isPlaying) {
            this.pause();
        }

        // Reset playback state
        this._currentTick = 0;
        this._tempo = 20;
        this._ticksPerBeat = 10;
        this._beatsPerBar = 4;
        this._metronomeEnabled = false;

        // Reset loop and selection state
        this._loopMode = LoopMode.Off;
        this._selectionStart = null;
        this._selectionEnd = null;

        // Reset UI timing
        this._nextTickAt = 0;

        // Reset Web Audio scheduler state
        this._nextTickToSchedule = 0;
        this._nextNoteTime = 0;
        this._muteTickAudio = false;

        // Cancel any scheduled audio
        this.cancelScheduledFromNow();

        // Clear cached data
        this._tickNotes.clear();
        this._tempoChanges.clear();
        this._tempoChangeList = [];
        this._channelsById.clear();

        // Clear song reference
        this._song = null;

        // Reset audio buffers and context (keep them for reuse)
        // Note: We don't dispose of the AudioContext or buffers as they can be reused
        this._scheduled = [];
    }
}

export const player = new Player();
