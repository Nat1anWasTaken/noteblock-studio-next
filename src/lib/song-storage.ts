import { browser } from '$app/environment';
import type { Song } from './types';

const STORAGE_KEY = 'noteblock-studio:saved-song';

export interface StoredSongPayload {
    version: number;
    savedAt: string;
    song: Song;
}

function normalizeSong(song: Song): Song {
    // Ensure we store plain JSON without reactive proxies; prefer structuredClone when available.
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(song) as Song;
        }
    } catch {}
    return JSON.parse(JSON.stringify(song)) as Song;
}

export function saveSongToStorage(song: Song): void {
    if (!browser) return;
    try {
        const payload: StoredSongPayload = {
            version: 1,
            savedAt: new Date().toISOString(),
            song: normalizeSong(song)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('Failed to save song to localStorage', error);
    }
}

export function loadSongFromStorage(): StoredSongPayload | null {
    if (!browser) return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredSongPayload>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.song) return null;
        const version = typeof parsed.version === 'number' ? parsed.version : 1;
        if (version !== 1) {
            console.warn('Unsupported saved song version', version);
            return null;
        }
        const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString();
        return {
            version,
            savedAt,
            song: parsed.song as Song
        };
    } catch (error) {
        console.error('Failed to load song from localStorage', error);
        return null;
    }
}

export function clearStoredSong(): void {
    if (!browser) return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear stored song from localStorage', error);
    }
}

export function hasStoredSong(): boolean {
    if (!browser) return false;
    try {
        return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
        return false;
    }
}
