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
    // Optional stable identifier for referencing channels across edits
    id?: string;
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
    instrument: Instrument;
    isMuted: boolean;
}

export interface NoteSection {
    startingTick: number; // The starting tick of the section, relative to the start of the song
    length: number; // In ticks
    notes: Note[];
    name: string;
}

export interface Note {
    tick: number; // The tick at which the note is played, relative the note's section
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

// Human-readable names for instruments
export const INSTRUMENT_NAMES: Record<Instrument, string> = {
    [Instrument.Piano]: 'Piano',
    [Instrument.DoubleBass]: 'Double Bass',
    [Instrument.BassDrum]: 'Bass Drum',
    [Instrument.SnareDrum]: 'Snare Drum',
    [Instrument.Click]: 'Click',
    [Instrument.Guitar]: 'Guitar',
    [Instrument.Flute]: 'Flute',
    [Instrument.Bell]: 'Bell',
    [Instrument.Chime]: 'Chime',
    [Instrument.Xylophone]: 'Xylophone',
    [Instrument.IronXylophone]: 'Iron Xylophone',
    [Instrument.CowBell]: 'Cow Bell',
    [Instrument.Didgeridoo]: 'Didgeridoo',
    [Instrument.Bit]: 'Bit',
    [Instrument.Banjo]: 'Banjo',
    [Instrument.Pling]: 'Pling'
} as const;

// Icon paths for instruments
export const INSTRUMENT_ICONS: Record<Instrument, string> = {
    [Instrument.Piano]: '/instruments/harp.png',
    [Instrument.DoubleBass]: '/instruments/bass.png',
    [Instrument.BassDrum]: '/instruments/bassdrum.png',
    [Instrument.SnareDrum]: '/instruments/snare.png',
    [Instrument.Click]: '/instruments/hat.png',
    [Instrument.Guitar]: '/instruments/guitar.png',
    [Instrument.Flute]: '/instruments/flute.png',
    [Instrument.Bell]: '/instruments/bell.png',
    [Instrument.Chime]: '/instruments/icechime.png',
    [Instrument.Xylophone]: '/instruments/xylobone.png',
    [Instrument.IronXylophone]: '/instruments/iron_xylophone.png',
    [Instrument.CowBell]: '/instruments/cow_bell.png',
    [Instrument.Didgeridoo]: '/instruments/didgeridoo.png',
    [Instrument.Bit]: '/instruments/bit.png',
    [Instrument.Banjo]: '/instruments/banjo.png',
    [Instrument.Pling]: '/instruments/pling.png'
} as const;

// Helper to get all available instruments as an array
export const ALL_INSTRUMENTS = Object.values(Instrument).filter(value => typeof value === 'number') as Instrument[];
