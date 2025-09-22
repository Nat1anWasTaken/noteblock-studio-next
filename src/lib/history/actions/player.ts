import type { Instrument, NoteChannel, NoteSection, TempoChannel } from '../../types';
import type { HistoryAction } from '../types';
import { getSong } from '../utils';

/**
 * Action for toggling channel mute state
 */
export function createToggleMuteAction(channelIndex: number, wasMuted: boolean): HistoryAction {
    return {
        label: wasMuted ? 'Unmute channel' : 'Mute channel',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                channel.isMuted = !wasMuted;
                ctx.player.refreshIndexes();
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                channel.isMuted = wasMuted;
                ctx.player.refreshIndexes();
            }
        }
    };
}

/**
 * Action for setting solo on a channel (mutes all others, unmutes target)
 */
export function createSetSoloAction(
    channelIndex: number,
    previousMuteStates: boolean[]
): HistoryAction {
    return {
        label: 'Solo channel',
        do(ctx) {
            const song = getSong(ctx.player);
            // Apply solo logic: mute all except target
            for (let i = 0; i < song.channels.length; i++) {
                const channel = song.channels[i];
                if (channel?.kind === 'note') {
                    channel.isMuted = i !== channelIndex;
                }
            }
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            // Restore previous mute states
            let noteIdx = 0;
            for (let i = 0; i < song.channels.length; i++) {
                const channel = song.channels[i];
                if (channel?.kind === 'note') {
                    if (noteIdx < previousMuteStates.length) {
                        channel.isMuted = previousMuteStates[noteIdx];
                        noteIdx++;
                    }
                }
            }
            ctx.player.refreshIndexes();
        }
    };
}

/**
 * Action for updating a note channel with partial data
 */
export function createUpdateNoteChannelAction(
    channelIndex: number,
    updates: Partial<NoteChannel>,
    previousState: Partial<NoteChannel>
): HistoryAction {
    return {
        label: 'Update channel',
        do(ctx) {
            ctx.player.updateNoteChannel(channelIndex, updates);
        },
        undo(ctx) {
            ctx.player.updateNoteChannel(channelIndex, previousState);
        },
        canCoalesceWith(next) {
            return next.label === 'Update channel';
        }
    };
}

/**
 * Action for updating a note section with partial data
 */
export function createUpdateNoteSectionAction(
    channelIndex: number,
    sectionIndex: number,
    updates: Partial<NoteSection>,
    previousState: Partial<NoteSection>
): HistoryAction {
    return {
        label: 'Update section',
        do(ctx) {
            ctx.player.updateNoteSection(channelIndex, sectionIndex, updates);
        },
        undo(ctx) {
            ctx.player.updateNoteSection(channelIndex, sectionIndex, previousState);
        },
        canCoalesceWith(next) {
            return next.label === 'Update section';
        }
    };
}

/**
 * Action for updating a tempo channel with partial data
 */
export function createUpdateTempoChannelAction(
    channelIndex: number,
    updates: Partial<TempoChannel>,
    previousState: Partial<TempoChannel>
): HistoryAction {
    return {
        label: 'Update tempo channel',
        do(ctx) {
            ctx.player.updateTempoChannel(channelIndex, updates);
        },
        undo(ctx) {
            ctx.player.updateTempoChannel(channelIndex, previousState);
        },
        canCoalesceWith(next) {
            return next.label === 'Update tempo channel';
        }
    };
}

/**
 * Action for removing a channel
 */
export function createRemoveChannelAction(
    channelIndex: number,
    removedChannel: NoteChannel | TempoChannel
): HistoryAction {
    return {
        label: `Remove ${removedChannel.kind} channel`,
        do(ctx) {
            ctx.player.removeChannel(channelIndex);
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            // Re-insert the channel at its original position
            song.channels.splice(channelIndex, 0, removedChannel);
            ctx.player.refreshIndexes();
        }
    };
}

/**
 * Action for creating a new note channel
 */
export function createCreateNoteChannelAction(
    channelData: { name: string; instrument: Instrument },
    createdChannelIndex: number
): HistoryAction {
    return {
        label: 'Create channel',
        do(ctx) {
            ctx.player.createNoteChannel(channelData);
        },
        undo(ctx) {
            ctx.player.removeChannel(createdChannelIndex);
        }
    };
}

/**
 * Action for setting tempo
 */
export function createSetTempoAction(newTempo: number, oldTempo: number): HistoryAction {
    return {
        label: 'Set tempo',
        do(ctx) {
            ctx.player.setTempo(newTempo);
        },
        undo(ctx) {
            ctx.player.setTempo(oldTempo);
        },
        canCoalesceWith(next) {
            return next.label === 'Set tempo';
        }
    };
}
