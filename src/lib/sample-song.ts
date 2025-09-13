import { Instrument, type Song } from './types';

export const sample: Song = {
    length: 2400,
    tempo: 20,
    channels: [
        {
            kind: 'note',
            name: 'Piano',
            pan: 0,
            sections: [
                {
                    startingTick: 0,
                    length: 70,
                    notes: [
                        {
                            tick: 0,
                            instrument: Instrument.Piano,
                            key: 39,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 10,
                            instrument: Instrument.Piano,
                            key: 39,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 20,
                            instrument: Instrument.Piano,
                            key: 46,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 30,
                            instrument: Instrument.Piano,
                            key: 46,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 40,
                            instrument: Instrument.Piano,
                            key: 48,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 50,
                            instrument: Instrument.Piano,
                            key: 48,
                            velocity: 100,
                            pitch: 0
                        },
                        {
                            tick: 60,
                            instrument: Instrument.Piano,
                            key: 46,
                            velocity: 100,
                            pitch: 0
                        }
                    ],
                    name: 'Intro'
                }
            ]
        }
    ],

    name: 'Sample Song',
    author: 'Noteblock Studio',
    description: 'A simple sample song to demonstrate playback.'
};
