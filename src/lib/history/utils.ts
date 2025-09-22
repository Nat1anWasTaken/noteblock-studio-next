import type { Player } from '../playback.svelte';
import type { Song } from '../types';

export function assertSongLoaded(player: Player): asserts player is Player & { song: Song } {
    if (!player.song) {
        throw new Error('No song is currently loaded. History action requires an active song.');
    }
}

export function getSong(player: Player): Song {
    assertSongLoaded(player);
    return player.song;
}
