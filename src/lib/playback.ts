import { browser } from '$app/environment';
import { Instrument, type Note } from './types';

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
			[Instrument.Xylophone]: new Audio('/notes/xylophone.ogg')
		}
	: ({} as Record<Instrument, HTMLAudioElement>);

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
	const audio = soundMap[instrument].cloneNode(true) as HTMLAudioElement;

	// Disable pitch correction to allow proper pitch shifting
	audio.preservesPitch = false;
	(audio as any).mozPreservesPitch = false;
	(audio as any).webkitPreservesPitch = false;

	// Set volume based on velocity
	audio.volume = (velocity / 100) * 0.5;

	const baseSampleKey = 33;
	const keyOffset = key - baseSampleKey;
	const pitchOffset = pitch / 1200; // Convert cents to semitones

	// Combine key and pitch offsets: 2^(semitones/12)
	audio.playbackRate = Math.pow(2, (keyOffset + pitchOffset) / 12);

	return await audio.play();
}

export async function test() {
	if (!browser) throw new Error('Playback test can only be run in the browser');
	console.log('Playing Twinkle Twinkle Little Star...');

	const melody = [39, 39, 46, 46, 48, 48, 46];

	// Play each note with a 500ms delay between notes
	for (const key of melody) {
		await playSound(Instrument.Piano, key, 80, 0);
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	console.log('Finished playing melody!');
}
