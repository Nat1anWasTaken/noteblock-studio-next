import type { Instrument, Note, NoteChannel, NoteSection, TempoChannel } from '../../types';
import type { HistoryAction, HistoryActionContext } from '../types';
import { getSong } from '../utils';

function cloneNote(note: Note): Note {
    return { ...note };
}

function sortSectionNotes(section: NoteSection): void {
    section.notes.sort((a, b) => {
        if (a.tick !== b.tick) return a.tick - b.tick;
        return a.key - b.key;
    });
}

function applyNoteState(target: Note, state: Partial<Note>): void {
    for (const key of Object.keys(state) as (keyof Note)[]) {
        const value = state[key];
        if (typeof value === 'number') {
            target[key] = value;
        }
    }
}

function getNoteSection(
    ctx: HistoryActionContext,
    channelIndex: number,
    sectionIndex: number
): NoteSection | null {
    const song = getSong(ctx.player);
    const channel = song.channels[channelIndex];
    if (channel?.kind !== 'note') return null;
    return channel.sections[sectionIndex] ?? null;
}

export interface NoteUpdateChange {
    note: Note;
    previousState: Partial<Note>;
    nextState: Partial<Note>;
}

export interface NoteRemovalChange {
    noteIndex: number;
    noteSnapshot: Note;
}

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

/**
 * Action for adding a note to a section
 */
export function createAddNoteAction(
    channelIndex: number,
    sectionIndex: number,
    note: Note,
    insertIndex: number
): HistoryAction {
    return {
        label: 'Add note',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const section = channel.sections[sectionIndex];
                if (section) {
                    section.notes.splice(insertIndex, 0, note);
                    sortSectionNotes(section);
                    ctx.player.refreshIndexes();
                }
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const section = channel.sections[sectionIndex];
                if (section) {
                    section.notes.splice(insertIndex, 1);
                    ctx.player.refreshIndexes();
                }
            }
        }
    };
}

/**
 * Action for removing a note from a section
 */
export function createRemoveNoteAction(
    channelIndex: number,
    sectionIndex: number,
    noteIndex: number,
    removedNote: Note
): HistoryAction {
    return {
        label: 'Remove note',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const section = channel.sections[sectionIndex];
                if (section) {
                    section.notes.splice(noteIndex, 1);
                    ctx.player.refreshIndexes();
                }
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const section = channel.sections[sectionIndex];
                if (section) {
                    section.notes.splice(noteIndex, 0, cloneNote(removedNote));
                    sortSectionNotes(section);
                    ctx.player.refreshIndexes();
                }
            }
        }
    };
}

/**
 * Action for updating a note with partial data
 */
export function createUpdateNoteAction(
    channelIndex: number,
    sectionIndex: number,
    note: Note,
    nextState: Partial<Note>,
    previousState: Partial<Note>
): HistoryAction {
    return {
        label: 'Update note',
        do(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            if (!section.notes.includes(note)) return;
            applyNoteState(note, nextState);
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            if (!section.notes.includes(note)) return;
            applyNoteState(note, previousState);
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        canCoalesceWith(next) {
            return next.label === 'Update note';
        }
    };
}

export function createUpdateNotesAction(
    channelIndex: number,
    sectionIndex: number,
    changes: NoteUpdateChange[]
): HistoryAction {
    const label = changes.length === 1 ? 'Update note' : 'Update notes';
    return {
        label,
        do(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            let mutated = false;
            for (const change of changes) {
                if (!section.notes.includes(change.note)) continue;
                applyNoteState(change.note, change.nextState);
                mutated = true;
            }
            if (!mutated) return;
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            let mutated = false;
            for (const change of changes) {
                if (!section.notes.includes(change.note)) continue;
                applyNoteState(change.note, change.previousState);
                mutated = true;
            }
            if (!mutated) return;
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        canCoalesceWith(next) {
            return next.label === label;
        }
    };
}

export function createRemoveNotesAction(
    channelIndex: number,
    sectionIndex: number,
    removals: NoteRemovalChange[]
): HistoryAction {
    const label = removals.length === 1 ? 'Remove note' : 'Remove notes';
    // Ensure we process removals from highest index to lowest when doing
    const descending = [...removals].sort((a, b) => b.noteIndex - a.noteIndex);
    const ascending = [...removals].sort((a, b) => a.noteIndex - b.noteIndex);
    return {
        label,
        do(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            let mutated = false;
            for (const removal of descending) {
                if (removal.noteIndex < 0 || removal.noteIndex >= section.notes.length) continue;
                section.notes.splice(removal.noteIndex, 1);
                mutated = true;
            }
            if (!mutated) return;
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const section = getNoteSection(ctx, channelIndex, sectionIndex);
            if (!section) return;
            let mutated = false;
            for (const removal of ascending) {
                section.notes.splice(removal.noteIndex, 0, cloneNote(removal.noteSnapshot));
                mutated = true;
            }
            if (!mutated) return;
            sortSectionNotes(section);
            ctx.player.refreshIndexes();
        },
        canCoalesceWith(next) {
            return next.label === label;
        }
    };
}
