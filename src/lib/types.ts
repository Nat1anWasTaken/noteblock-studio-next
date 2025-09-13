export interface Song {
    length: number; // In ticks
    tempo: number; // Ticks per second
    channels: Channel[];

    name: string;
    author: string;
    description: string;
}

export type Channel = NoteChannel | TempoChannel;

export interface BaseChannel {
    kind: 'note' | 'tempo';
    name: string;
}

export interface TempoChannel extends BaseChannel {
    kind: 'tempo';
    tempoChanges: TempoChange[];
}

export interface TempoChange {
    tick: number; // The tick at which the tempo change occurs, relative to the start of the song
    tempo: number; // Ticks per second
    ticksPerBeat: number; // Ticks per beat (for time signature changes)
    beatsPerBar: number; // Beats per bar (for time signature changes)
}

export interface NoteChannel extends BaseChannel {
    kind: 'note';
    sections: NoteSection[];
    pan: number; // -100 (left) to 100 (right)
}

export interface NoteSection {
    startingTick: number; // The starting tick of the section, relative to the start of the song
    length: number; // In ticks
    notes: Note[];
    name: string;
}

export interface Note {
    tick: number; // The tick at which the note is played, relative the note's section
    instrument: Instrument;
    key: number; // From 0-87, where 0 is A0 and 87 is C8. 33-57 is within the 2-octave limit.
    velocity: number;
    pitch: number; // -1200 (lower) to 1200 (higher)
}

export enum Instrument {
    Piano = 0, // Air
    DoubleBass = 1, // Wood
    BassDrum = 2, // Stone
    SnareDrum = 3, // Sand
    Click = 4, // Glass
    Guitar = 5, // Wool
    Flute = 6, // Clay
    Bell = 7, // Block of Gold
    Chime = 8, // Packed Ice
    Xylophone = 9, // Bone Block
    IronXylophone = 10, // Iron Block
    CowBell = 11, // Soul Sand
    Didgeridoo = 12, // Pumpkin
    Bit = 13, // Block of Emerald
    Banjo = 14, // Hay
    Pling = 15 // Glowstone
}
