import JSZip from 'jszip';
import { Instrument, type NoteChannel, type Song, type TempoChannel } from './types';

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

export interface PackMeta {
    pack: {
        pack_format: number;
        description: string;
    };
}

export interface DatapackFile {
    path: string;
    content: string;
}

export interface Datapack {
    'pack.mcmeta': PackMeta;
    files: DatapackFile[];
}

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

        // Sort pitches by key based on direction
        // For west/north (negative direction), lower pitches go first (will be leftmost)
        // For east/south (positive direction), higher pitches go first (so lower pitches end up leftmost)
        const sortedPitches = Array.from(uniquePitches.values()).sort((a, b) => {
            if (direction === 'west' || direction === 'north') {
                return a.key - b.key; // ascending: lower pitch first
            } else {
                return b.key - a.key; // descending: higher pitch first
            }
        });

        // Create noteblock entries for each unique pitch (only valid ones)
        const entries: NoteblockEntry[] = [];
        sortedPitches.forEach(({ key, pitch }) => {
            // Skip notes outside valid noteblock range
            if (!isValidNoteblockKey(key)) {
                return;
            }

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

/**
 * Maps Minecraft noteblock instruments to their corresponding block types for visualization
 */
const INSTRUMENT_BLOCKS: Record<Instrument, string> = {
    [Instrument.Piano]: 'dirt', // Air doesn't work well for falling blocks, using wool
    [Instrument.DoubleBass]: 'oak_planks',
    [Instrument.BassDrum]: 'stone',
    [Instrument.SnareDrum]: 'sand',
    [Instrument.Click]: 'glass',
    [Instrument.Guitar]: 'white_wool',
    [Instrument.Flute]: 'clay',
    [Instrument.Bell]: 'gold_block',
    [Instrument.Chime]: 'packed_ice',
    [Instrument.Xylophone]: 'bone_block',
    [Instrument.IronXylophone]: 'iron_block',
    [Instrument.CowBell]: 'soul_sand',
    [Instrument.Didgeridoo]: 'pumpkin',
    [Instrument.Bit]: 'emerald_block',
    [Instrument.Banjo]: 'hay_block',
    [Instrument.Pling]: 'glowstone'
};

/**
 * Maps instruments to the blocks that should be placed under the noteblock
 * to produce the correct instrument sound
 */
const INSTRUMENT_UNDER_BLOCKS: Record<Instrument, string> = {
    [Instrument.Piano]: 'dirt', // Air or any other block
    [Instrument.DoubleBass]: 'oak_planks', // Wood
    [Instrument.BassDrum]: 'stone',
    [Instrument.SnareDrum]: 'sand',
    [Instrument.Click]: 'glass',
    [Instrument.Guitar]: 'white_wool', // Wool
    [Instrument.Flute]: 'clay',
    [Instrument.Bell]: 'gold_block',
    [Instrument.Chime]: 'packed_ice',
    [Instrument.Xylophone]: 'bone_block',
    [Instrument.IronXylophone]: 'iron_block',
    [Instrument.CowBell]: 'soul_sand',
    [Instrument.Didgeridoo]: 'pumpkin',
    [Instrument.Bit]: 'emerald_block',
    [Instrument.Banjo]: 'hay_block',
    [Instrument.Pling]: 'glowstone'
};

/**
 * Maps instruments to their corresponding noteblock sound names for playsound command
 */
const INSTRUMENT_SOUNDS: Record<Instrument, string> = {
    [Instrument.Piano]: 'harp',
    [Instrument.DoubleBass]: 'bass',
    [Instrument.BassDrum]: 'basedrum',
    [Instrument.SnareDrum]: 'snare',
    [Instrument.Click]: 'hat',
    [Instrument.Guitar]: 'guitar',
    [Instrument.Flute]: 'flute',
    [Instrument.Bell]: 'bell',
    [Instrument.Chime]: 'chime',
    [Instrument.Xylophone]: 'xylophone',
    [Instrument.IronXylophone]: 'iron_xylophone',
    [Instrument.CowBell]: 'cow_bell',
    [Instrument.Didgeridoo]: 'didgeridoo',
    [Instrument.Bit]: 'bit',
    [Instrument.Banjo]: 'banjo',
    [Instrument.Pling]: 'pling'
};

/**
 * Calculates the Minecraft noteblock pitch (0-24) from a key value
 * @param key The key value (0-87 where 0 is A0, 33-57 is within noteblock range)
 * @returns The noteblock pitch value (can be outside 0-24 range)
 */
function calculateNoteblockPitch(key: number): number {
    // Convert key to MIDI note number (key 0 = MIDI 21)
    const midiNote = key + 21;

    // Noteblock base pitch is F♯3 (MIDI 54) = pitch 0
    // Each increment is one semitone
    // Adding 12 to shift up by one octave to match expected range
    const pitch = midiNote - 54 + 12;

    return pitch;
}

/**
 * Checks if a key is within the valid noteblock range
 */
function isValidNoteblockKey(key: number): boolean {
    const pitch = calculateNoteblockPitch(key);
    return pitch >= 0 && pitch <= 24;
}

/**
 * Generates the load function content
 */
function generateLoadFunction(
    scoreboardName: string,
    songName: string,
    songLengthTicks: number,
    tempo: number
): string {
    // For scoreboard math: multiply song ticks by 20, divide by tempo
    // This way we can use integer math: game_tick * tempo <= song_tick * 20
    const scaledLength = songLengthTicks * 20;

    return `# Initialize scoreboards for music playback
scoreboard objectives add ${scoreboardName}_playing dummy "Music Playing State"
scoreboard objectives add ${scoreboardName}_tick dummy "Current Music Tick"
scoreboard objectives add ${scoreboardName}_game dummy "Game Tick Counter"

# Set default values
scoreboard players set #playing ${scoreboardName}_playing 0
scoreboard players set #tick ${scoreboardName}_tick 0
scoreboard players set #game ${scoreboardName}_game 0
scoreboard players set #length ${scoreboardName}_tick ${scaledLength}
scoreboard players set #tempo ${scoreboardName}_tick ${tempo}
scoreboard players set #20 ${scoreboardName}_tick 20

tellraw @a {"text":"[${songName}] Datapack loaded!","color":"green"}`;
}

/**
 * Generates the tick function content
 */
function generateTickFunction(namespace: string, scoreboardName: string): string {
    return `# Check if music is playing
execute if score #playing ${scoreboardName}_playing matches 1 run function ${namespace}:play_tick`;
}

/**
 * Generates the play_tick function content
 */
function generatePlayTickFunction(
    namespace: string,
    scoreboardName: string,
    ticksWithNotes: number[] = []
): string {
    const tickExecutes =
        ticksWithNotes.length > 0
            ? ticksWithNotes
                  .map((tick) => {
                      // Scale tick by 20 for comparison (song_tick * 20)
                      const scaledTick = tick * 20;
                      return `execute if score #tick ${scoreboardName}_tick matches ${scaledTick} run function ${namespace}:song/tick/${tick}`;
                  })
                  .join('\n')
            : `# No tick functions generated yet`;

    return `# Execute the current tick's music function if it exists
${tickExecutes}

# Advance tick counter: #tick = #game * #tempo (game_ticks * ticks_per_second)
# Since 20 game ticks = 1 second, this gives us the correct song tick position
scoreboard players add #game ${scoreboardName}_game 1
scoreboard players operation #tick ${scoreboardName}_tick = #game ${scoreboardName}_game
scoreboard players operation #tick ${scoreboardName}_tick *= #tempo ${scoreboardName}_tick

# Check if song has ended (compare scaled values)
execute if score #tick ${scoreboardName}_tick >= #length ${scoreboardName}_tick run function ${namespace}:stop`;
}

/**
 * Generates setup commands for placing noteblocks
 */
function generateSetupCommands(noteblockMap: NoteblockMap): string[] {
    const commands: string[] = ['# Setup noteblocks'];

    noteblockMap.forEach((channelNoteblocks) => {
        commands.push(`# Channel: ${channelNoteblocks.channelName}`);

        channelNoteblocks.noteblocks.forEach((entry) => {
            const { noteblock, blockUnder, instrument, key } = entry;
            const pitch = calculateNoteblockPitch(key);
            const underBlock = INSTRUMENT_UNDER_BLOCKS[instrument];

            // Place the block under the noteblock
            commands.push(
                `setblock ${blockUnder.x} ${blockUnder.y} ${blockUnder.z} minecraft:${underBlock}`
            );

            // Place the noteblock with the correct pitch
            commands.push(
                `setblock ${noteblock.x} ${noteblock.y} ${noteblock.z} minecraft:note_block[note=${pitch}]`
            );
        });
    });

    return commands;
}

/**
 * Generates the start function content
 */
function generateStartFunction(
    scoreboardName: string,
    songName: string,
    namespace: string,
    hasSetup: boolean
): string {
    const setupCall = hasSetup ? `\n# Setup noteblocks\nfunction ${namespace}:setup\n` : '';

    return `# Start music playback
scoreboard players set #playing ${scoreboardName}_playing 1
scoreboard players set #tick ${scoreboardName}_tick 0
scoreboard players set #game ${scoreboardName}_game 0
${setupCall}
tellraw @a {"text":"[${songName}] Now playing!","color":"aqua"}`;
}

/**
 * Generates the stop function content
 */
function generateStopFunction(scoreboardName: string, songName: string): string {
    return `# Stop music playback
scoreboard players set #playing ${scoreboardName}_playing 0
scoreboard players set #tick ${scoreboardName}_tick 0
scoreboard players set #game ${scoreboardName}_game 0

tellraw @a {"text":"[${songName}] Stopped.","color":"yellow"}`;
}

/**
 * Generates function tag files
 */
function generateFunctionTags(namespace: string): DatapackFile[] {
    return [
        {
            path: `data/minecraft/tags/function/load.json`,
            content: JSON.stringify({ values: [`${namespace}:load`] }, null, 2)
        },
        {
            path: `data/minecraft/tags/function/tick.json`,
            content: JSON.stringify({ values: [`${namespace}:tick`] }, null, 2)
        }
    ];
}

/**
 * Generates commands to play a note
 */
function generatePlayNoteCommands(entry: NoteblockEntry, visualizer: boolean): string[] {
    const commands: string[] = [];
    const { noteblock, redstoneBlock, instrument, key } = entry;
    const noteblockPitch = calculateNoteblockPitch(key);

    // Calculate playsound pitch (0.5 * 2^(noteblock_pitch/12))
    const playsoundPitch = 0.5 * Math.pow(2, noteblockPitch / 12);
    const soundName = INSTRUMENT_SOUNDS[instrument];

    // Play sound to all players at their position
    commands.push(
        `execute as @a at @s run playsound minecraft:block.note_block.${soundName} record @s ~ ~ ~ 1 ${playsoundPitch.toFixed(6)}`
    );

    // If visualizer is enabled, summon falling block
    if (visualizer) {
        const blockType = INSTRUMENT_BLOCKS[instrument];
        commands.push(
            `summon falling_block ${redstoneBlock.x} ${redstoneBlock.y + 20} ${redstoneBlock.z} {BlockState:{Name:"minecraft:${blockType}"},Time:500,Motion:[0.0,-0.2,0.0]}`
        );
    }

    // Trigger noteblock with redstone block
    commands.push(
        `setblock ${redstoneBlock.x} ${redstoneBlock.y} ${redstoneBlock.z} minecraft:redstone_block destroy`
    );

    return commands;
}

/**
 * Generates cleanup command to remove redstone block after 2 ticks
 */
function generateCleanupCommand(redstoneBlock: Coordinate): string {
    return `setblock ${redstoneBlock.x} ${redstoneBlock.y} ${redstoneBlock.z} minecraft:air`;
}

/**
 * Generates tick function files for song playback
 * @param song The song to generate tick functions for
 * @param noteblockMap The noteblock map containing all noteblock positions
 * @param namespace The datapack namespace
 * @param visualizer Whether to enable falling block visualization
 * @returns Array of tick function files
 */
export function generateSongTickFunctions(
    song: Song,
    noteblockMap: NoteblockMap,
    namespace: string = 'noteblock_studio',
    visualizer: boolean = true
): DatapackFile[] {
    const files: DatapackFile[] = [];
    const tickNotes = new Map<number, NoteblockEntry[]>();

    // Group notes by their absolute tick in the song
    song.channels.forEach((channel) => {
        if (channel.kind !== 'note') return;

        const noteChannel = channel as NoteChannel;
        const channelNoteblocks = noteblockMap.find(
            (cm) => cm.channelIndex === song.channels.indexOf(channel)
        );

        if (!channelNoteblocks) return;

        noteChannel.sections.forEach((section) => {
            section.notes.forEach((note) => {
                const absoluteTick = section.startingTick + note.tick;

                // Find the noteblock entry for this note
                const entry = channelNoteblocks.noteblocks.find(
                    (nb) => nb.key === note.key && nb.pitch === note.pitch
                );

                if (entry) {
                    if (!tickNotes.has(absoluteTick)) {
                        tickNotes.set(absoluteTick, []);
                    }
                    tickNotes.get(absoluteTick)!.push(entry);
                }
            });
        });
    });

    // Generate tick function files
    tickNotes.forEach((entries, tick) => {
        const commands: string[] = [`# Tick ${tick}`];
        const cleanupCommands: string[] = [`# Cleanup for tick ${tick}`];

        entries.forEach((entry) => {
            commands.push(...generatePlayNoteCommands(entry, visualizer));
            cleanupCommands.push(generateCleanupCommand(entry.redstoneBlock));
        });

        // Add schedule command for cleanup
        commands.push(`schedule function ${namespace}:song/cleanup/${tick} 2t`);

        // Create tick function file
        files.push({
            path: `data/${namespace}/function/song/tick/${tick}.mcfunction`,
            content: commands.join('\n')
        });

        // Create cleanup function file
        files.push({
            path: `data/${namespace}/function/song/cleanup/${tick}.mcfunction`,
            content: cleanupCommands.join('\n')
        });
    });

    return files;
}

/**
 * Creates a basic empty datapack structure with song metadata
 * @param songName The name of the song
 * @param description Optional description for the datapack
 * @param namespace The datapack namespace (defaults to 'noteblock_studio')
 * @param songLengthTicks The total length of the song in ticks
 * @param ticksWithNotes Array of tick numbers that have notes (for generating play_tick function)
 * @param setupCommands Optional setup commands to run when starting the song
 * @returns A datapack structure ready to be populated with functions
 */
export function createDatapack(
    songName: string,
    description?: string,
    namespace: string = 'noteblock_studio',
    songLengthTicks: number = 0,
    tempo: number = 20,
    ticksWithNotes: number[] = [],
    setupCommands: string[] = []
): Datapack {
    const packDescription = description || `Noteblock music: ${songName}`;
    const scoreboardName = `${namespace}_music`;

    const files: DatapackFile[] = [
        {
            path: `data/${namespace}/function/load.mcfunction`,
            content: generateLoadFunction(scoreboardName, songName, songLengthTicks, tempo)
        },
        {
            path: `data/${namespace}/function/tick.mcfunction`,
            content: generateTickFunction(namespace, scoreboardName)
        },
        {
            path: `data/${namespace}/function/play_tick.mcfunction`,
            content: generatePlayTickFunction(namespace, scoreboardName, ticksWithNotes)
        },
        {
            path: `data/${namespace}/function/start.mcfunction`,
            content: generateStartFunction(
                scoreboardName,
                songName,
                namespace,
                setupCommands.length > 0
            )
        },
        {
            path: `data/${namespace}/function/stop.mcfunction`,
            content: generateStopFunction(scoreboardName, songName)
        },
        ...generateFunctionTags(namespace)
    ];

    // Add setup function if there are setup commands
    if (setupCommands.length > 0) {
        files.push({
            path: `data/${namespace}/function/setup.mcfunction`,
            content: setupCommands.join('\n')
        });
    }

    return {
        'pack.mcmeta': {
            pack: {
                pack_format: 48, // Minecraft 1.21 format
                description: packDescription
            }
        },
        files
    };
}

/**
 * Creates a complete datapack for a song with all tick functions and noteblock setup
 * @param song The song to create a datapack for
 * @param options Configuration options for the datapack
 * @returns A complete datapack structure ready to be exported
 */
export function createSongDatapack(
    song: Song,
    options: {
        namespace?: string;
        description?: string;
        visualizer?: boolean;
        startPos?: Coordinate;
        direction?: Direction;
    } = {}
): Datapack {
    const {
        namespace = 'noteblock_studio',
        description,
        visualizer = true,
        startPos = { x: 0, y: 64, z: 0 },
        direction = 'east'
    } = options;

    // Generate noteblock map
    const noteblockMap = generateNoteblockMap(song, startPos, direction);

    // Generate setup commands
    const setupCommands = generateSetupCommands(noteblockMap);

    // Generate tick functions
    const tickFunctions = generateSongTickFunctions(song, noteblockMap, namespace, visualizer);

    // Extract tick numbers
    const ticksWithNotes = Array.from(
        new Set(
            tickFunctions
                .filter((f) => f.path.includes('/tick/'))
                .map((f) => {
                    const match = f.path.match(/\/tick\/(\d+)\.mcfunction$/);
                    return match ? parseInt(match[1]) : -1;
                })
                .filter((t) => t >= 0)
        )
    ).sort((a, b) => a - b);

    // Get tempo from the first tempo change in the tempo channel, or fall back to song.tempo
    const tempoChannel = song.channels.find((ch) => ch.kind === 'tempo') as
        | TempoChannel
        | undefined;
    const actualTempo = tempoChannel?.tempoChanges?.[0]?.tempo ?? song.tempo;

    // Create base datapack
    const datapack = createDatapack(
        song.name,
        description,
        namespace,
        song.length,
        actualTempo,
        ticksWithNotes,
        setupCommands
    );

    // Add tick functions
    datapack.files.push(...tickFunctions);

    return datapack;
}

/**
 * Converts a datapack to a downloadable zip blob
 * @param datapack The datapack to convert
 * @returns A Promise that resolves to a Blob containing the zip file
 */
export async function datapackToZip(datapack: Datapack): Promise<Blob> {
    const zip = new JSZip();

    // Add pack.mcmeta
    zip.file('pack.mcmeta', JSON.stringify(datapack['pack.mcmeta'], null, 4));

    // Add all datapack files
    datapack.files.forEach((file) => {
        zip.file(file.path, file.content);
    });

    // Generate the zip blob
    return await zip.generateAsync({ type: 'blob' });
}

/**
 * Downloads a datapack as a zip file
 * @param datapack The datapack to download
 * @param filename The filename (without extension)
 */
export async function downloadDatapack(datapack: Datapack, filename: string): Promise<void> {
    const blob = await datapackToZip(datapack);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
