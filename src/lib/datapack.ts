import { Instrument, type NoteChannel, type Song } from './types';

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
 * Calculates the Minecraft noteblock pitch (0-24) from a key value
 * @param key The key value (0-87 where 0 is A0, 33-57 is within noteblock range)
 * @returns The noteblock pitch value (0-24), clamped to valid range
 */
function calculateNoteblockPitch(key: number): number {
    // Convert key to MIDI note number (key 0 = MIDI 21)
    const midiNote = key + 21;

    // Noteblock base pitch is F♯3 (MIDI 54) = pitch 0
    // Each increment is one semitone
    const pitch = midiNote - 54;

    // Clamp to valid noteblock range (0-24)
    return Math.max(0, Math.min(24, pitch));
}

/**
 * Generates the load function content
 */
function generateLoadFunction(
    scoreboardName: string,
    songName: string,
    songLengthTicks: number
): string {
    return `# Initialize scoreboards for music playback
scoreboard objectives add ${scoreboardName}_playing dummy "Music Playing State"
scoreboard objectives add ${scoreboardName}_tick dummy "Current Music Tick"

# Set default values
scoreboard players set #playing ${scoreboardName}_playing 0
scoreboard players set #tick ${scoreboardName}_tick 0
scoreboard players set #length ${scoreboardName}_tick ${songLengthTicks}

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
                  .map(
                      (tick) =>
                          `execute if score #tick ${scoreboardName}_tick matches ${tick} run function ${namespace}:song/tick/${tick}`
                  )
                  .join('\n')
            : `# No tick functions generated yet`;

    return `# Execute the current tick's music function if it exists
${tickExecutes}

# Advance to next tick
scoreboard players add #tick ${scoreboardName}_tick 1

# Check if song has ended
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

tellraw @a {"text":"[${songName}] Stopped.","color":"yellow"}`;
}

/**
 * Generates function tag files
 */
function generateFunctionTags(namespace: string): DatapackFile[] {
    return [
        {
            path: `data/minecraft/tags/functions/load.json`,
            content: JSON.stringify({ values: [`${namespace}:load`] }, null, 2)
        },
        {
            path: `data/minecraft/tags/functions/tick.json`,
            content: JSON.stringify({ values: [`${namespace}:tick`] }, null, 2)
        }
    ];
}

/**
 * Generates commands to play a note
 */
function generatePlayNoteCommands(entry: NoteblockEntry, visualizer: boolean): string[] {
    const commands: string[] = [];
    const { redstoneBlock, instrument } = entry;

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
            path: `data/${namespace}/functions/song/tick/${tick}.mcfunction`,
            content: commands.join('\n')
        });

        // Create cleanup function file
        files.push({
            path: `data/${namespace}/functions/song/cleanup/${tick}.mcfunction`,
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
    ticksWithNotes: number[] = [],
    setupCommands: string[] = []
): Datapack {
    const packDescription = description || `Noteblock music: ${songName}`;
    const scoreboardName = `${namespace}_music`;

    const files: DatapackFile[] = [
        {
            path: `data/${namespace}/functions/load.mcfunction`,
            content: generateLoadFunction(scoreboardName, songName, songLengthTicks)
        },
        {
            path: `data/${namespace}/functions/tick.mcfunction`,
            content: generateTickFunction(namespace, scoreboardName)
        },
        {
            path: `data/${namespace}/functions/play_tick.mcfunction`,
            content: generatePlayTickFunction(namespace, scoreboardName, ticksWithNotes)
        },
        {
            path: `data/${namespace}/functions/start.mcfunction`,
            content: generateStartFunction(
                scoreboardName,
                songName,
                namespace,
                setupCommands.length > 0
            )
        },
        {
            path: `data/${namespace}/functions/stop.mcfunction`,
            content: generateStopFunction(scoreboardName, songName)
        },
        ...generateFunctionTags(namespace)
    ];

    // Add setup function if there are setup commands
    if (setupCommands.length > 0) {
        files.push({
            path: `data/${namespace}/functions/setup.mcfunction`,
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

    // Create base datapack
    const datapack = createDatapack(
        song.name,
        description,
        namespace,
        song.length,
        ticksWithNotes,
        setupCommands
    );

    // Add tick functions
    datapack.files.push(...tickFunctions);

    return datapack;
}
