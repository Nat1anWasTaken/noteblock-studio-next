import type { TrackJSON } from '@tonejs/midi';
import type { Note, NoteChannel } from './types.js';
import { Instrument } from './types.js';

export interface PercussionTarget {
    instrument: Instrument;
    key: number;
}

export type PercussionMapping = Record<number, PercussionTarget>;

export function guessInstrumentForTrack(track: TrackJSON): Instrument {
    const program = track.instrument.number ?? 0;

    if (track.channel === 9) {
        return Instrument.BassDrum;
    }

    if (program >= 8 && program <= 15) return Instrument.Bell; // Chromatic percussion
    if (program >= 16 && program <= 23) return Instrument.Chime; // Organs / sustained
    if (program >= 24 && program <= 31) return Instrument.Guitar; // Guitars
    if (program >= 32 && program <= 39) return Instrument.DoubleBass; // Basses
    if (program >= 40 && program <= 47) return Instrument.Flute; // Strings
    if (program >= 48 && program <= 55) return Instrument.Flute; // Ensemble strings
    if (program >= 56 && program <= 63) return Instrument.Didgeridoo; // Brass
    if (program >= 64 && program <= 71) return Instrument.Flute; // Reeds
    if (program >= 72 && program <= 79) return Instrument.Flute; // Pipes
    if (program >= 80 && program <= 95) return Instrument.Bit; // Synth leads/pads
    if (program >= 96 && program <= 103) return Instrument.Pling; // FX
    if (program >= 104 && program <= 111) return Instrument.Banjo; // Ethnic
    if (program >= 112 && program <= 119) return Instrument.SnareDrum; // Percussive
    if (program >= 120) return Instrument.Click; // Sound effects

    return Instrument.Piano;
}

export function createDefaultPercussionMapping(track: TrackJSON): PercussionMapping {
    const mapping: PercussionMapping = {};

    for (const note of track.notes) {
        const midi = note.midi;
        if (mapping[midi]) continue;

        mapping[midi] = {
            instrument: mapPercussionInstrument(midi),
            key: clampToRange(Math.round(midi - 21), 0, 87)
        };
    }

    return mapping;
}

function mapPercussionInstrument(midi: number): Instrument {
    if (midi <= 36) return Instrument.BassDrum;
    if (midi <= 40) return Instrument.SnareDrum;
    if (midi <= 46) return Instrument.Click;
    if (midi <= 52) return Instrument.Bell;
    if (midi <= 60) return Instrument.Guitar;
    if (midi <= 72) return Instrument.Flute;
    if (midi <= 84) return Instrument.Bit;
    return Instrument.Pling;
}

function clampToRange(value: number, min: number, max: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

export function intoChannelAsInstrument(
    midiTrack: TrackJSON,
    instrument: Instrument,
    tickScale = 1
): NoteChannel {
    const notes: Note[] = midiTrack.notes
        .map((midiNote) => ({
            tick: Math.max(0, Math.round(midiNote.ticks * tickScale)),
            key: clampToRange(Math.round(midiNote.midi - 21), 0, 87),
            velocity: clampToRange(Math.round(midiNote.velocity * 100), 0, 100),
            pitch: 0 // Default pitch adjustment
        }))
        .sort((a, b) => a.tick - b.tick);

    const sectionLength = notes.length ? Math.max(...notes.map((n) => n.tick)) + 1 : 0;

    return {
        kind: 'note',
        name: midiTrack.name || `${instrument} Track`,
        sections: [
            {
                startingTick: 0,
                length: sectionLength,
                notes,
                name: 'Main Section'
            }
        ],
        pan: 0,
        instrument,
        isMuted: false
    };
}

export function intoChannelWithMapping(
    midiTrack: TrackJSON,
    mapping: PercussionMapping,
    tickScale = 1
): NoteChannel[] {
    const channelMap = new Map<Instrument, Note[]>();

    for (const midiNote of midiTrack.notes) {
        const mappedNote = mapping[midiNote.midi];
        if (!mappedNote) continue;

        const note: Note = {
            tick: Math.max(0, Math.round(midiNote.ticks * tickScale)),
            key: clampToRange(mappedNote.key, 0, 87),
            velocity: clampToRange(Math.round(midiNote.velocity * 100), 0, 100),
            pitch: 0
        };

        if (!channelMap.has(mappedNote.instrument)) {
            channelMap.set(mappedNote.instrument, []);
        }
        channelMap.get(mappedNote.instrument)!.push(note);
    }

    return Array.from(channelMap.entries()).map(([instrument, entries]) => {
        const sorted = entries.sort((a, b) => a.tick - b.tick);
        const sectionLength = sorted.length ? Math.max(...sorted.map((n) => n.tick)) + 1 : 0;

        return {
            kind: 'note' as const,
            name: `Percussion ${instrument}`,
            sections: [
                {
                    startingTick: 0,
                    length: sectionLength,
                    notes: sorted,
                    name: 'Main Section'
                }
            ],
            pan: 0,
            instrument,
            isMuted: false
        };
    });
}
