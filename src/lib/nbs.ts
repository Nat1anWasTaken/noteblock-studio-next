import type { Note as NbsNote, Song as NbsSong } from '@nbsjs/core';
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
        description: nbs.description ?? ''
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
