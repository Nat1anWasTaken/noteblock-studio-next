import type { HistoryAction } from '../types';
import { getSong } from '../utils';

export function createRenameSongAction(newName: string, oldName: string): HistoryAction {
    return {
        label: 'Rename song',
        do(ctx) {
            const song = getSong(ctx.player);
            song.name = newName;
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            song.name = oldName;
        },
        canCoalesceWith(next) {
            return next.label === 'Rename song';
        }
    };
}
