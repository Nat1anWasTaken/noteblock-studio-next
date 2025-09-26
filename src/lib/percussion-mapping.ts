import type { PercussionMapping } from './midi';
import { Instrument, NOTEBLOCK_LOWEST_KEY_IN_MIDI } from './types';

/**
 * Pitch conversion rule from Open Noteblock Studio -> your Noteblock MIDI range.
 * - If source pitch <= 24: treat as noteblock index (0..24) -> MIDI = 21 + pitch
 * - Else: treat as absolute MIDI key (use as-is)
 */

const p = (src: number) => (src <= 24 ? NOTEBLOCK_LOWEST_KEY_IN_MIDI + src : src);

/**
 * General MIDI Percussion note (Channel 10) -> Noteblock target
 * Keys not listed are intentionally left unmapped.
 */
export const PERCUSSION_MAPPING: PercussionMapping = {
    // 24–34 (special FX / meta)
    24: { instrument: Instrument.Bit, key: p(39) }, // Cutting Noise (SFX)
    25: { instrument: Instrument.SnareDrum, key: p(8) }, // Snare Roll
    26: { instrument: Instrument.Click, key: p(25) }, // Finger Snap
    27: { instrument: Instrument.SnareDrum, key: p(18) }, // High Q
    28: { instrument: Instrument.SnareDrum, key: p(27) }, // Slap
    29: { instrument: Instrument.Click, key: p(16) }, // Scratch Push
    30: { instrument: Instrument.Click, key: p(13) }, // Scratch Pull
    31: { instrument: Instrument.Click, key: p(9) }, // Sticks
    32: { instrument: Instrument.Click, key: p(6) }, // Square Click
    33: { instrument: Instrument.Click, key: p(2) }, // Metronome Click
    34: { instrument: Instrument.Bell, key: p(17) }, // Metronome Bell

    // 35–41
    35: { instrument: Instrument.BassDrum, key: p(10) }, // Bass Drum 2
    36: { instrument: Instrument.BassDrum, key: p(6) }, // Bass Drum 1
    37: { instrument: Instrument.Click, key: p(6) }, // Side Stick
    38: { instrument: Instrument.SnareDrum, key: p(8) }, // Snare Drum 1
    39: { instrument: Instrument.Click, key: p(6) }, // Hand Clap
    40: { instrument: Instrument.SnareDrum, key: p(4) }, // Snare Drum 2
    41: { instrument: Instrument.BassDrum, key: p(6) }, // Low Tom 2

    // 42–48
    42: { instrument: Instrument.SnareDrum, key: p(22) }, // Closed Hi-hat
    43: { instrument: Instrument.BassDrum, key: p(13) }, // Low Tom 1
    44: { instrument: Instrument.SnareDrum, key: p(22) }, // Pedal Hi-hat
    45: { instrument: Instrument.BassDrum, key: p(15) }, // Mid Tom 2
    46: { instrument: Instrument.SnareDrum, key: p(18) }, // Open Hi-hat
    47: { instrument: Instrument.BassDrum, key: p(20) }, // Mid Tom 1
    48: { instrument: Instrument.BassDrum, key: p(23) }, // High Tom 2

    // 49–55
    49: { instrument: Instrument.SnareDrum, key: p(17) }, // Crash Cymbal 1
    50: { instrument: Instrument.BassDrum, key: p(23) }, // High Tom 1
    51: { instrument: Instrument.SnareDrum, key: p(24) }, // Ride Cymbal 1
    52: { instrument: Instrument.SnareDrum, key: p(8) }, // Chinese Cymbal
    53: { instrument: Instrument.SnareDrum, key: p(13) }, // Ride Bell
    54: { instrument: Instrument.Click, key: p(18) }, // Tambourine
    55: { instrument: Instrument.SnareDrum, key: p(18) }, // Splash Cymbal

    // 56–62
    56: { instrument: Instrument.CowBell, key: p(5) }, // Cowbell
    57: { instrument: Instrument.SnareDrum, key: p(13) }, // Crash Cymbal 2
    58: { instrument: Instrument.Click, key: p(2) }, // Vibraslap
    59: { instrument: Instrument.SnareDrum, key: p(13) }, // Ride Cymbal 2
    60: { instrument: Instrument.Click, key: p(9) }, // High Bongo
    61: { instrument: Instrument.Click, key: p(2) }, // Low Bongo
    62: { instrument: Instrument.Click, key: p(8) }, // Mute High Conga

    // 63–69
    63: { instrument: Instrument.BassDrum, key: p(22) }, // Open High Conga
    64: { instrument: Instrument.BassDrum, key: p(15) }, // Low Conga
    65: { instrument: Instrument.SnareDrum, key: p(13) }, // High Timbale
    66: { instrument: Instrument.SnareDrum, key: p(8) }, // Low Timbale
    67: { instrument: Instrument.Xylophone, key: p(12) }, // High Agogo
    68: { instrument: Instrument.Xylophone, key: p(5) }, // Low Agogo
    69: { instrument: Instrument.Click, key: p(20) }, // Cabasa

    // 70–76
    70: { instrument: Instrument.Click, key: p(23) }, // Maracas
    71: { instrument: Instrument.Flute, key: p(34) }, // Short Whistle
    72: { instrument: Instrument.Flute, key: p(33) }, // Long  Whistle
    73: { instrument: Instrument.Click, key: p(17) }, // Short Guiro
    74: { instrument: Instrument.Click, key: p(11) }, // Long  Guiro
    75: { instrument: Instrument.Click, key: p(18) }, // Claves
    76: { instrument: Instrument.Click, key: p(10) }, // High Wood Block

    // 77–83
    77: { instrument: Instrument.Click, key: p(5) }, // Low Wood Block
    78: { instrument: Instrument.Didgeridoo, key: p(25) }, // Mute Cuica
    79: { instrument: Instrument.Didgeridoo, key: p(26) }, // Open Cuica
    80: { instrument: Instrument.Click, key: p(16) }, // Mute Triangle
    81: { instrument: Instrument.Bell, key: p(19) }, // Open Triangle
    82: { instrument: Instrument.SnareDrum, key: p(22) }, // Shaker
    83: { instrument: Instrument.Bell, key: p(6) }, // Jingle Bell

    // 84
    84: { instrument: Instrument.Bell, key: p(15) }, // Bell Tree
    85: { instrument: Instrument.Click, key: p(21) }, // Castanets
    86: { instrument: Instrument.BassDrum, key: p(14) }, // Mute Surdo
    87: { instrument: Instrument.BassDrum, key: p(7) }, // Open Surdo

    // Extra SFX from the same table (non-standard GM range often seen below 35):
    85_000: { instrument: Instrument.Flute, key: p(34) } // (example placeholder if you later add more)
};
