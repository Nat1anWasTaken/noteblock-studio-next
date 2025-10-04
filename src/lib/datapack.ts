import type { Song, NoteChannel, Instrument } from './types';

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Coordinate {
	x: number;
	y: number;
	z: number;
}

export interface NoteblockEntry {
	noteblock: Coordinate;
	blockUnder: Coordinate;
	redstoneBlock: Coordinate;
	key: number;
	pitch: number;
	instrument: Instrument;
	channelIndex: number;
	channelName: string;
}

export interface ChannelNoteblocks {
	channelIndex: number;
	channelId: string;
	channelName: string;
	noteblocks: NoteblockEntry[];
}

export type NoteblockMap = ChannelNoteblocks[];

/**
 * Generates a noteblock map from a song
 * @param song The song to generate noteblocks for
 * @param startPos Starting position for the first noteblock
 * @param direction Direction to arrange noteblocks (north=-z, south=+z, east=+x, west=-x)
 * @returns A map of channel IDs to their noteblock entries
 */
export function generateNoteblockMap(
	song: Song,
	startPos: Coordinate = { x: 0, y: 64, z: 0 },
	direction: Direction = 'east'
): NoteblockMap {
	const map: NoteblockMap = [];
	let currentPos = { ...startPos };

	// Process each note channel in order
	song.channels.forEach((channel, channelIndex) => {
		if (channel.kind !== 'note') return;

		const noteChannel = channel as NoteChannel;
		const channelId = channel.id || `channel-${channelIndex}`;
		const channelName = channel.name;

		// Gather all unique (key, pitch) combinations in this channel
		const uniquePitches = new Map<string, { key: number; pitch: number }>();

		noteChannel.sections.forEach((section) => {
			section.notes.forEach((note) => {
				const pitchKey = `${note.key}-${note.pitch}`;
				if (!uniquePitches.has(pitchKey)) {
					uniquePitches.set(pitchKey, {
						key: note.key,
						pitch: note.pitch
					});
				}
			});
		});

		// Create noteblock entries for each unique pitch
		const entries: NoteblockEntry[] = [];
		uniquePitches.forEach(({ key, pitch }) => {
			const noteblock = { ...currentPos };
			const blockUnder = { ...currentPos, y: currentPos.y - 1 };
			const redstoneBlock = getRedstoneBlockPos(currentPos, direction);

			entries.push({
				noteblock,
				blockUnder,
				redstoneBlock,
				key,
				pitch,
				instrument: noteChannel.instrument,
				channelIndex,
				channelName
			});

			// Move to next position based on direction
			currentPos = getNextPosition(currentPos, direction);
		});

		map.push({
			channelIndex,
			channelId,
			channelName,
			noteblocks: entries
		});
	});

	return map;
}

/**
 * Gets the redstone block position based on noteblock position and direction
 */
function getRedstoneBlockPos(noteblock: Coordinate, direction: Direction): Coordinate {
	switch (direction) {
		case 'north':
			return { ...noteblock, x: noteblock.x + 1, y: noteblock.y };
		case 'south':
			return { ...noteblock, x: noteblock.x + 1, y: noteblock.y };
		case 'east':
			return { ...noteblock, z: noteblock.z + 1, y: noteblock.y };
		case 'west':
			return { ...noteblock, z: noteblock.z + 1, y: noteblock.y };
	}
}

/**
 * Gets the next noteblock position based on current position and direction
 */
function getNextPosition(current: Coordinate, direction: Direction): Coordinate {
	switch (direction) {
		case 'north':
			return { ...current, z: current.z - 1 };
		case 'south':
			return { ...current, z: current.z + 1 };
		case 'east':
			return { ...current, x: current.x + 1 };
		case 'west':
			return { ...current, x: current.x - 1 };
	}
}
