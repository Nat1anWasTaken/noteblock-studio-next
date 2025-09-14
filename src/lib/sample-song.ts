import { fromArrayBuffer } from '@nbsjs/core';
import { convertNbsSong } from './nbs';
import { Instrument, type Song } from './types';
import { downloadAsArrayBuffer } from './utils';

// export const sample: Song = {
//     length: 2400,
//     tempo: 20,
//     channels: [
//         {
//             kind: 'note',
//             instrument: Instrument.Piano,
//             name: 'Piano',
//             pan: 0,
//             sections: [
//                 {
//                     startingTick: 0,
//                     length: 70,
//                     notes: [
//                         {
//                             tick: 0,
//                             key: 39,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 10,
//                             key: 39,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 20,
//                             key: 46,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 30,
//                             key: 46,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 40,
//                             key: 48,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 50,
//                             key: 48,
//                             velocity: 100,
//                             pitch: 0
//                         },
//                         {
//                             tick: 60,
//                             key: 46,
//                             velocity: 100,
//                             pitch: 0
//                         }
//                     ],
//                     name: 'Intro'
//                 }
//             ]
//         }
//     ],

//     name: 'Sample Song',
//     author: 'Noteblock Studio',
//     description: 'A simple sample song to demonstrate playback.'
// };

export async function getSampleSong(): Promise<Song> {
    const buffer = await downloadAsArrayBuffer('/sample.nbs');
    const nbsSong = fromArrayBuffer(buffer);
    return convertNbsSong(nbsSong, 'per-instrument');
}
