import type { Note as NbsNote, Song as NbsSong } from '@nbsjs/core';
import { Song as NbsjsSong, Note, toArrayBuffer } from '@nbsjs/core';
import {
    Instrument,
    type Note as AppNote,
    type NoteChannel,
    type Song,
    type TempoChannel
} from './types';

export type ChannelSeparationMode = 'per-instrument' | 'per-layer';

/**
 * Convert an @nbsjs/core Song into this app's Song type.
 *
 * Separation modes:
 *  - 'per-instrument': merge all layers, group notes by instrument into a channel
 *  - 'per-layer': keep original layers; if a layer has multiple instruments, split into multiple channels
 */
export function convertNbsSong(nbs: NbsSong, mode: ChannelSeparationMode = 'per-layer'): Song {
    const length = nbs.getLength();
    const tempo = nbs.getTempo(); // ticks per second
    const beatsPerBar = clampNumber(nbs.timeSignature ?? 4, 1, 32);
    const ticksPerBeat = 8; // default grid density used by the editor/playback

    const noteChannels: NoteChannel[] =
        mode === 'per-instrument' ? buildChannelsPerInstrument(nbs) : buildChannelsPerLayer(nbs);

    // Add a single tempo channel at tick 0 using song's tempo and time signature
    const tempoChannel: TempoChannel = {
        kind: 'tempo',
        name: 'Tempo',
        tempoChanges: [
            {
                tick: 0,
                tempo,
                ticksPerBeat,
                beatsPerBar
            }
        ]
    };

    return {
        length,
        tempo,
        channels: [tempoChannel, ...noteChannels],
        name: nbs.name ?? '',
        author: nbs.author ?? nbs.originalAuthor ?? '',
        description: nbs.description ?? '',
        metadata: {
            version: '1.0.0',
            format: 'nbs-import',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            assets: []
        }
    };
}

function buildChannelsPerInstrument(nbs: NbsSong): NoteChannel[] {
    // instrumentId -> aggregated notes across all layers
    const byInstrument = new Map<number, Array<{ tick: number; note: AppNote }>>();

    for (const layer of nbs.layers.all) {
        for (const [t, n] of layer.notes as Iterable<[number, NbsNote]>) {
            const inst = mapBuiltInInstrument(n.instrument ?? 0);
            if (inst === null) continue; // skip unsupported custom instruments

            const list = byInstrument.get(inst) ?? [];
            list.push({ tick: t, note: mapNote(n) });
            byInstrument.set(inst, list);
        }
    }

    const channels: NoteChannel[] = [];
    for (const [inst, entries] of byInstrument.entries()) {
        const sections = [
            {
                startingTick: 0,
                length: entries.length ? Math.max(...entries.map((e) => e.tick)) + 1 : 0,
                notes: entries
                    .map((e) => ({ ...e.note, tick: e.tick }))
                    .sort((a, b) => a.tick - b.tick),
                name: 'All'
            }
        ];

        channels.push({
            kind: 'note',
            name: getInstrumentName(inst as Instrument),
            instrument: inst as Instrument,
            pan: 0,
            isMuted: false,
            sections
        });
    }

    // Stable order by instrument id
    channels.sort((a, b) => (a.instrument as number) - (b.instrument as number));
    return channels;
}

function buildChannelsPerLayer(nbs: NbsSong): NoteChannel[] {
    const channels: NoteChannel[] = [];

    nbs.layers.all.forEach((layer, layerIdx) => {
        // Group this layer's notes by instrument
        const groups = new Map<number, Array<{ tick: number; note: AppNote }>>();
        for (const [t, n] of layer.notes as Iterable<[number, NbsNote]>) {
            const inst = mapBuiltInInstrument(n.instrument ?? 0);
            if (inst === null) continue;
            const list = groups.get(inst) ?? [];
            list.push({ tick: t, note: mapNote(n) });
            groups.set(inst, list);
        }

        const layerName = layer.name ?? `Layer ${layerIdx + 1}`;
        const multi = groups.size > 1;

        let order = 0;
        for (const [inst, entries] of groups.entries()) {
            const sections = [
                {
                    startingTick: 0,
                    length: entries.length ? Math.max(...entries.map((e) => e.tick)) + 1 : 0,
                    notes: entries
                        .map((e) => ({ ...e.note, tick: e.tick }))
                        .sort((a, b) => a.tick - b.tick),
                    name: 'All'
                }
            ];

            channels.push({
                kind: 'note',
                name: multi ? `${layerName} (${getInstrumentName(inst as Instrument)})` : layerName,
                instrument: inst as Instrument,
                pan: clampNumber(layer.stereo ?? 0, -100, 100),
                isMuted: false,
                sections
            });

            order++;
        }
    });

    return channels;
}

function mapNote(n: NbsNote): AppNote {
    return {
        tick: 0, // will be set by caller
        key: n.key - 12, // shift one octave down to fit app format
        velocity: n.velocity,
        pitch: n.pitch
    };
}

function getInstrumentName(i: Instrument): string {
    // Try to use enum reverse-lookup where available
    const name = (Instrument as unknown as Record<number, string>)[i as unknown as number];
    return name ?? `Instrument ${i}`;
}

function mapBuiltInInstrument(id: number): Instrument | null {
    if (Number.isFinite(id) && id >= 0 && id <= 15) return id as Instrument;
    return null;
}

function clampNumber(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/**
 * Convert an app Song to NBS format and return as ArrayBuffer.
 *
 * @param song The app Song to convert
 * @returns ArrayBuffer containing NBS file data
 */
export function songToNbs(song: Song): ArrayBufferLike {
    const nbsSong = new NbsjsSong();

    // Set basic metadata
    nbsSong.name = song.name;
    nbsSong.author = song.author;
    nbsSong.description = song.description;

    // Find the first tempo channel and use its first tempo event
    const tempoChannel = song.channels.find((ch) => ch.kind === 'tempo') as
        | TempoChannel
        | undefined;
    const firstTempoEvent = tempoChannel?.tempoChanges?.[0];
    const tempo = firstTempoEvent?.tempo ?? song.tempo;
    nbsSong.setTempo(tempo);

    // Process note channels
    const noteChannels = song.channels.filter((ch) => ch.kind === 'note') as NoteChannel[];

    noteChannels.forEach((channel) => {
        // Collect all notes from all sections with their absolute ticks
        const allNotes: Array<{ tick: number; note: AppNote }> = [];
        channel.sections.forEach((section) => {
            section.notes.forEach((note) => {
                const absoluteTick = section.startingTick + note.tick;
                allNotes.push({ tick: absoluteTick, note });
            });
        });

        // Group notes by tick to identify simultaneous notes
        const notesByTick = new Map<number, AppNote[]>();
        allNotes.forEach(({ tick, note }) => {
            if (!notesByTick.has(tick)) {
                notesByTick.set(tick, []);
            }
            notesByTick.get(tick)!.push(note);
        });

        // Find maximum number of simultaneous notes at any tick
        const maxSimultaneous = Math.max(
            1,
            ...Array.from(notesByTick.values()).map((notes) => notes.length)
        );

        // Create separate layers for each voice/simultaneous note position
        const layers: any[] = [];
        for (let i = 0; i < maxSimultaneous; i++) {
            const layer = nbsSong.layers.create();
            layer.name = maxSimultaneous > 1 ? `${channel.name} ${i + 1}` : channel.name;
            layer.volume = 100; // Default volume
            layer.stereo = clampNumber(channel.pan, -100, 100);
            layers.push(layer);
        }

        // Distribute notes across layers
        notesByTick.forEach((notes, tick) => {
            notes.forEach((note, index) => {
                const nbsNote = new Note(channel.instrument, {
                    key: note.key + 12, // shift one octave up to match NBS format
                    velocity: note.velocity,
                    pitch: note.pitch
                });
                layers[index].notes.set(tick, nbsNote);
            });
        });
    });

    return toArrayBuffer(nbsSong);
}

/**
 * Download an app Song as a .nbs file in the browser.
 *
 * @param song The Song to export
 * @param filename Optional filename (defaults to song name + .nbs)
 */
export function downloadSongAsNbs(song: Song, filename?: string): void {
    const nbsData = songToNbs(song);
    // Create a new non-resizable ArrayBuffer and copy the data
    const buffer = new ArrayBuffer(nbsData.byteLength);
    const view = new Uint8Array(buffer);
    view.set(new Uint8Array(nbsData));

    const blob = new Blob([buffer], { type: 'application/octet-stream' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const finalFilename = filename || song.name || 'song';
    a.download = finalFilename.endsWith('.nbs') ? finalFilename : `${finalFilename}.nbs`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
