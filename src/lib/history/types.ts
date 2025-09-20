import type { EditorState } from '../editor-state.svelte';
import type { Player } from '../playback.svelte';

export interface HistoryActionContext {
    player: Player;
    editorState: EditorState;
}

export interface HistoryAction {
    do(ctx: HistoryActionContext): void;
    undo(ctx: HistoryActionContext): void;
    /**
     * Allows an existing history entry to absorb another action that occurred shortly after.
     * The current entry decides if it can merge with the provided action and may mutate itself
     * to capture the newest state while keeping the original undo baseline.
     */
    canCoalesceWith?(next: HistoryAction): boolean;
    /** Optional label to use when no label is supplied via execute options. */
    label?: string;
}

export interface HistoryEntry {
    action: HistoryAction;
    label: string;
    timestamp: number;
    coalesceKey?: string;
    suppressAutoscroll?: boolean;
    isEphemeral?: boolean;
}

export type HistoryCoalesceStrategy =
    | 'replace'
    | ((previous: HistoryEntry, next: HistoryEntry) => boolean);

export interface HistoryExecuteOptions {
    label?: string;
    coalesceKey?: string;
    coalesceStrategy?: HistoryCoalesceStrategy;
    suppressAutoscroll?: boolean;
    isEphemeral?: boolean;
}

export interface HistoryTransactionHandle {
    add(action: HistoryAction, options?: HistoryExecuteOptions): HistoryEntry | null;
    commit(options?: HistoryExecuteOptions): void;
    cancel(): void;
    readonly size: number;
    readonly closed: boolean;
}

export interface HistoryChangeEventDetail {
    canUndo: boolean;
    canRedo: boolean;
    lastLabel: string | null;
    reason?: string;
}
