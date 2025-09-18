import JSZip from 'jszip';
import type { Channel, Song } from './types';

/**
 * File handling utilities for Noteblock Studio songs
 * Handles conversion between Song objects and .nbx format (ZIP containing JSONs)
 */

// File structure within .nbx archive
const NBX_FILES = {
    MANIFEST: 'manifest.json',
    SONG: 'song.json',
    CHANNELS: 'channels/',
    ASSETS: 'assets/'
} as const;

/**
 * Manifest structure for .nbx files
 */
interface NbxManifest {
    version: string;
    format: string;
    created: string;
    modified: string;
    song: {
        name: string;
        author: string;
        description: string;
    };
    channels: {
        id: string;
        name: string;
        type: 'note' | 'tempo';
        file: string;
    }[];
    assets: string[];
}

/**
 * Song metadata structure for JSON serialization
 */
interface SongMetadata {
    length: number;
    tempo: number;
    name: string;
    author: string;
    description: string;
}

/**
 * Channel data structure for JSON serialization
 */
interface ChannelData {
    id?: string;
    name: string;
    type: 'note' | 'tempo';
    data: NoteChannelData | TempoChannelData;
}

/**
 * Note channel data structure
 */
interface NoteChannelData {
    pan: number;
    instrument: number;
    isMuted: boolean;
    sections: {
        startingTick: number;
        length: number;
        name: string;
        notes: {
            tick: number;
            key: number;
            velocity: number;
            pitch: number;
        }[];
    }[];
}

/**
 * Tempo channel data structure
 */
interface TempoChannelData {
    tempoChanges: {
        tick: number;
        tempo: number;
        ticksPerBeat: number;
        beatsPerBar: number;
    }[];
}

/**
 * Generate a stable channel ID based on channel properties
 */
function generateStableChannelId(channel: Channel, index: number): string {
    // Create a hash-like identifier based on channel properties
    const properties = [
        channel.kind,
        channel.name,
        channel.kind === 'note' ? channel.instrument : 'tempo'
    ].join('|');

    // Simple hash function for stable IDs
    let hash = 0;
    for (let i = 0; i < properties.length; i++) {
        const char = properties.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return `channel_${Math.abs(hash)}_${index}`;
}

/**
 * Convert a Song object to .nbx format (ZIP containing JSONs)
 */
export async function songToNbx(song: Song): Promise<Uint8Array> {
    const zip = new JSZip();

    // Create manifest
    const manifest: NbxManifest = {
        version: song.metadata?.version || '1.0.0',
        format: song.metadata?.format || 'nbx',
        created: song.metadata?.created || new Date().toISOString(),
        modified: song.metadata?.modified || new Date().toISOString(),
        song: {
            name: song.name,
            author: song.author,
            description: song.description
        },
        channels: [],
        assets: song.metadata?.assets || []
    };

    // Add song metadata
    const songMetadata: SongMetadata = {
        length: song.length,
        tempo: song.tempo,
        name: song.name,
        author: song.author,
        description: song.description
    };
    zip.file(NBX_FILES.SONG, JSON.stringify(songMetadata, null, 2));

    // Add channels with stable IDs
    for (let i = 0; i < song.channels.length; i++) {
        const channel = song.channels[i];
        // Use existing ID or generate a stable one based on channel properties
        const channelId = channel.id || generateStableChannelId(channel, i);
        const channelFile = `${NBX_FILES.CHANNELS}${channelId}.json`;

        let channelData: ChannelData;
        if (channel.kind === 'note') {
            channelData = {
                id: channelId,
                name: channel.name,
                type: 'note',
                data: {
                    pan: channel.pan,
                    instrument: channel.instrument,
                    isMuted: channel.isMuted,
                    sections: channel.sections.map((section) => ({
                        startingTick: section.startingTick,
                        length: section.length,
                        name: section.name,
                        notes: section.notes
                    }))
                }
            };
        } else {
            channelData = {
                id: channelId,
                name: channel.name,
                type: 'tempo',
                data: {
                    tempoChanges: channel.tempoChanges
                }
            };
        }

        zip.file(channelFile, JSON.stringify(channelData, null, 2));
        manifest.channels.push({
            id: channelId,
            name: channel.name,
            type: channel.kind,
            file: channelFile
        });
    }

    // Add manifest
    zip.file(NBX_FILES.MANIFEST, JSON.stringify(manifest, null, 2));

    // Generate ZIP
    return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * Convert .nbx format (ZIP containing JSONs) to a Song object
 */
export async function nbxToSong(nbxData: Uint8Array): Promise<Song> {
    const zip = await JSZip.loadAsync(nbxData);

    // Read manifest
    const manifestFile = zip.file(NBX_FILES.MANIFEST);
    if (!manifestFile) {
        throw new Error('Invalid .nbx file: missing manifest.json');
    }

    const manifest: NbxManifest = JSON.parse(await manifestFile.async('text'));

    // Read song metadata
    const songFile = zip.file(NBX_FILES.SONG);
    if (!songFile) {
        throw new Error('Invalid .nbx file: missing song.json');
    }

    const songMetadata: SongMetadata = JSON.parse(await songFile.async('text'));

    // Read channels
    const channels: Channel[] = [];
    for (const channelInfo of manifest.channels) {
        const channelFile = zip.file(channelInfo.file);
        if (!channelFile) {
            throw new Error(`Invalid .nbx file: missing channel file ${channelInfo.file}`);
        }

        const channelData: ChannelData = JSON.parse(await channelFile.async('text'));

        if (channelData.type === 'note') {
            const noteData = channelData.data as NoteChannelData;
            channels.push({
                kind: 'note',
                id: channelData.id,
                name: channelData.name,
                pan: noteData.pan,
                instrument: noteData.instrument,
                isMuted: noteData.isMuted,
                sections: noteData.sections
            });
        } else {
            const tempoData = channelData.data as TempoChannelData;
            channels.push({
                kind: 'tempo',
                id: channelData.id,
                name: channelData.name,
                tempoChanges: tempoData.tempoChanges
            });
        }
    }

    return {
        length: songMetadata.length,
        tempo: songMetadata.tempo,
        channels,
        name: songMetadata.name,
        author: songMetadata.author,
        description: songMetadata.description,
        metadata: {
            version: manifest.version,
            format: manifest.format,
            created: manifest.created,
            modified: manifest.modified,
            assets: manifest.assets
        }
    };
}

/**
 * Download a Song as a .nbx file in the browser
 */
export async function downloadSongAsNbx(song: Song, filename?: string): Promise<void> {
    const nbxData = await songToNbx(song);
    const blob = new Blob([nbxData as BlobPart], { type: 'application/zip' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${song.name || 'song'}.nbx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Read a Song from a .nbx file (File object from file input)
 */
export async function readSongFromNbxFile(file: File): Promise<Song> {
    const arrayBuffer = await file.arrayBuffer();
    const nbxData = new Uint8Array(arrayBuffer);
    return await nbxToSong(nbxData);
}

/**
 * Validate if a File is a valid .nbx file
 */
export async function validateNbxFileFromFile(file: File): Promise<boolean> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const nbxData = new Uint8Array(arrayBuffer);
        const zip = await JSZip.loadAsync(nbxData);

        // Check for required files
        const manifest = zip.file(NBX_FILES.MANIFEST);
        const song = zip.file(NBX_FILES.SONG);

        return !!(manifest && song);
    } catch {
        return false;
    }
}

/**
 * Get metadata from a .nbx file without loading the full song
 */
export async function getNbxMetadataFromFile(file: File): Promise<{
    name: string;
    author: string;
    description: string;
    version: string;
    format: string;
    created: string;
    modified: string;
    channels: number;
    assets: string[];
}> {
    const arrayBuffer = await file.arrayBuffer();
    const nbxData = new Uint8Array(arrayBuffer);
    const zip = await JSZip.loadAsync(nbxData);

    const manifestFile = zip.file(NBX_FILES.MANIFEST);
    if (!manifestFile) {
        throw new Error('Invalid .nbx file: missing manifest.json');
    }

    const manifest: NbxManifest = JSON.parse(await manifestFile.async('text'));

    return {
        name: manifest.song.name,
        author: manifest.song.author,
        description: manifest.song.description,
        version: manifest.version,
        format: manifest.format,
        created: manifest.created,
        modified: manifest.modified,
        channels: manifest.channels.length,
        assets: manifest.assets
    };
}
