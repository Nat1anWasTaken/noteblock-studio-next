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
            ctx.player.updateNoteChannel(channelIndex, updates, { skipHistory: true });
        },
        undo(ctx) {
            ctx.player.updateNoteChannel(channelIndex, previousState, { skipHistory: true });
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
            ctx.player.updateNoteSection(channelIndex, sectionIndex, updates, {
                skipHistory: true
            });
        },
        undo(ctx) {
            ctx.player.updateNoteSection(channelIndex, sectionIndex, previousState, {
                skipHistory: true
            });
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
            ctx.player.updateTempoChannel(channelIndex, updates, { skipHistory: true });
        },
        undo(ctx) {
            ctx.player.updateTempoChannel(channelIndex, previousState, { skipHistory: true });
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
            const song = getSong(ctx.player);
            const channels = song.channels;
            if (!channels.length) return;
            let targetIndex = channels.indexOf(removedChannel);
            if (targetIndex === -1) targetIndex = channelIndex;
            if (targetIndex < 0 || targetIndex >= channels.length) return;
            channels.splice(targetIndex, 1);
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            // Re-insert the channel at its original position
            const channels = song.channels;
            const existingIndex = channels.indexOf(removedChannel);
            if (existingIndex !== -1) channels.splice(existingIndex, 1);
            const insertIndex = Math.min(Math.max(channelIndex, 0), channels.length);
            channels.splice(insertIndex, 0, removedChannel);
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
    const channel: NoteChannel = {
        kind: 'note',
        name: channelData.name,
        instrument: channelData.instrument,
        sections: [],
        pan: 0,
        isMuted: false
    };

    return {
        label: 'Create channel',
        do(ctx) {
            ctx.player.createNoteChannel(channelData, {
                skipHistory: true,
                channel,
                index: createdChannelIndex
            });
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            let index = song.channels.indexOf(channel);
            if (index === -1) index = createdChannelIndex;
            if (index >= 0 && index < song.channels.length) {
                ctx.player.removeChannel(index, { skipHistory: true });
            }
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
            ctx.player.setTempo(newTempo, { skipHistory: true });
        },
        undo(ctx) {
            ctx.player.setTempo(oldTempo, { skipHistory: true });
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

/**
 * Action for creating a new section in a note channel
 */
export function createAddSectionAction(
    channelIndex: number,
    section: NoteSection,
    insertIndex: number
): HistoryAction {
    return {
        label: 'Add section',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                channel.sections.splice(insertIndex, 0, section);
                ctx.player.refreshIndexes();
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const actualIndex = channel.sections.indexOf(section);
                if (actualIndex !== -1) {
                    channel.sections.splice(actualIndex, 1);
                } else if (insertIndex < channel.sections.length) {
                    channel.sections.splice(insertIndex, 1);
                }
                ctx.player.refreshIndexes();
            }
        }
    };
}

/**
 * Action for removing a section from a note channel
 */
export function createRemoveSectionAction(
    channelIndex: number,
    sectionIndex: number,
    removedSection: NoteSection
): HistoryAction {
    return {
        label: 'Remove section',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                channel.sections.splice(sectionIndex, 1);
                ctx.player.refreshIndexes();
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const insertIndex = Math.min(sectionIndex, channel.sections.length);
                channel.sections.splice(insertIndex, 0, removedSection);
                ctx.player.refreshIndexes();
            }
        }
    };
}

/**
 * Action for removing multiple sections from channels
 */
export function createRemoveSectionsAction(
    sectionsToRemove: Array<{
        channelIndex: number;
        sectionIndex: number;
        section: NoteSection;
    }>
): HistoryAction {
    // Sort by channel index descending, then section index descending
    // This ensures we remove from the end first to avoid index shifting
    const sortedRemovals = [...sectionsToRemove].sort((a, b) => {
        if (a.channelIndex !== b.channelIndex) {
            return b.channelIndex - a.channelIndex;
        }
        return b.sectionIndex - a.sectionIndex;
    });

    const label = sectionsToRemove.length === 1 ? 'Remove section' : 'Remove sections';

    return {
        label,
        do(ctx) {
            const song = getSong(ctx.player);
            for (const removal of sortedRemovals) {
                const channel = song.channels[removal.channelIndex];
                if (channel?.kind === 'note' && channel.sections[removal.sectionIndex]) {
                    channel.sections.splice(removal.sectionIndex, 1);
                }
            }
            ctx.player.refreshIndexes();
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            // Restore in reverse order (ascending indices)
            for (const removal of [...sortedRemovals].reverse()) {
                const channel = song.channels[removal.channelIndex];
                if (channel?.kind === 'note') {
                    const insertIndex = Math.min(removal.sectionIndex, channel.sections.length);
                    channel.sections.splice(insertIndex, 0, removal.section);
                }
            }
            ctx.player.refreshIndexes();
        }
    };
}

/**
 * Action for moving a section within a channel
 */
export function createMoveSectionAction(
    channelIndex: number,
    fromIndex: number,
    toIndex: number
): HistoryAction {
    return {
        label: 'Move section',
        do(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const section = channel.sections[fromIndex];
                if (section) {
                    channel.sections.splice(fromIndex, 1);
                    const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
                    channel.sections.splice(adjustedToIndex, 0, section);
                    ctx.player.refreshIndexes();
                }
            }
        },
        undo(ctx) {
            const song = getSong(ctx.player);
            const channel = song.channels[channelIndex];
            if (channel?.kind === 'note') {
                const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
                const section = channel.sections[adjustedToIndex];
                if (section) {
                    channel.sections.splice(adjustedToIndex, 1);
                    channel.sections.splice(fromIndex, 0, section);
                    ctx.player.refreshIndexes();
                }
            }
        }
    };
}
