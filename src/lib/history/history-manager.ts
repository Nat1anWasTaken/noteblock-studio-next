import { browser } from '$app/environment';
import { editorState } from '../editor-state.svelte';
import { player } from '../playback.svelte';
import type {
    HistoryAction,
    HistoryActionContext,
    HistoryChangeEventDetail,
    HistoryCoalesceStrategy,
    HistoryEntry,
    HistoryExecuteOptions,
    HistoryTransactionHandle
} from './types';

interface TransactionState {
    entries: HistoryEntry[];
    label?: string;
    options: HistoryExecuteOptions;
    closed: boolean;
}

function isReplaceStrategy(strategy?: HistoryCoalesceStrategy): strategy is 'replace' {
    return strategy === 'replace';
}

function mergeOptions(
    base: HistoryExecuteOptions | undefined,
    overrides: HistoryExecuteOptions | undefined
): HistoryExecuteOptions {
    return { ...(base ?? {}), ...(overrides ?? {}) };
}

export class HistoryManager {
    /** Stack of completed actions that can be undone. */
    past: HistoryEntry[] = [];
    /** Stack of undone actions that can be reapplied. */
    future: HistoryEntry[] = [];

    /** Reactive booleans for UI bindings. */
    canUndo = $state(false);
    canRedo = $state(false);
    lastLabel = $state<string | null>(null);

    private ctx: HistoryActionContext = { player, editorState };
    private eventTarget = new EventTarget();
    private activeTransaction: TransactionState | null = null;

    execute(action: HistoryAction, options: HistoryExecuteOptions = {}): HistoryEntry | null {
        const transaction = this.activeTransaction;
        const merged = mergeOptions(transaction?.options, options);
        const label = merged.label ?? transaction?.label ?? action.label ?? 'Unnamed action';

        const entry: HistoryEntry = {
            action,
            label,
            timestamp: Date.now(),
            coalesceKey: merged.coalesceKey,
            suppressAutoscroll: merged.suppressAutoscroll,
            isEphemeral: merged.isEphemeral
        };

        try {
            action.do(this.ctx);
        } catch (error) {
            console.error('HistoryManager.execute failed during action.do', error);
            throw error;
        }

        // Ephemeral actions mutate state but do not create history entries.
        if (merged.isEphemeral) {
            this.future = [];
            this.syncStacks();
            this.dispatchChange('execute');
            return null;
        }

        // Any new action invalidates the redo stack.
        this.future = [];

        if (transaction) {
            const coalesced = this.tryCoalesce(transaction.entries, entry, merged.coalesceStrategy);
            if (!coalesced) {
                transaction.entries.push(entry);
            }
            this.syncStacks();
            this.dispatchChange('execute');
            return coalesced ?? entry;
        }

        const coalesced = this.tryCoalesce(this.past, entry, merged.coalesceStrategy);
        if (!coalesced) {
            this.past.push(entry);
        }
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('execute');
        return coalesced ?? entry;
    }

    undo(): HistoryEntry | null {
        if (this.activeTransaction) {
            console.warn('Cannot undo while a transaction is active. Call commit() or cancel() first.');
            return null;
        }
        const entry = this.past.pop();
        if (!entry) {
            return null;
        }
        try {
            entry.action.undo(this.ctx);
        } catch (error) {
            console.error('HistoryManager.undo failed during action.undo', error);
            throw error;
        }
        this.future.push(entry);
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('undo');
        return entry;
    }

    redo(): HistoryEntry | null {
        if (this.activeTransaction) {
            console.warn('Cannot redo while a transaction is active. Call commit() or cancel() first.');
            return null;
        }
        const entry = this.future.pop();
        if (!entry) {
            return null;
        }
        try {
            entry.action.do(this.ctx);
        } catch (error) {
            console.error('HistoryManager.redo failed during action.do', error);
            throw error;
        }
        this.past.push(entry);
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('redo');
        return entry;
    }

    clear(reason = 'clear'): void {
        if (this.activeTransaction) {
            // Cancel without undo to avoid double undoing the callers' in-progress work.
            this.activeTransaction.closed = true;
            this.activeTransaction = null;
        }
        this.past = [];
        this.future = [];
        this.lastLabel = null;
        this.syncStacks();
        this.dispatchChange(reason);
    }

    beginTransaction(
        label?: string,
        options: HistoryExecuteOptions = {}
    ): HistoryTransactionHandle {
        if (this.activeTransaction && !this.activeTransaction.closed) {
            throw new Error('A history transaction is already active. Nested transactions are not supported.');
        }
        const state: TransactionState = {
            entries: [],
            label,
            options,
            closed: false
        };
        this.activeTransaction = state;

        return {
            add: (action, addOptions = {}) => {
                if (state.closed) {
                    console.warn('Attempted to add an action to a closed history transaction.');
                    return null;
                }
                return this.execute(action, addOptions);
            },
            commit: (commitOptions = {}) => {
                if (state.closed) return;
                state.closed = true;
                this.activeTransaction = null;
                this.commitTransaction(state, commitOptions);
            },
            cancel: () => {
                if (state.closed) return;
                state.closed = true;
                this.cancelTransaction(state);
            },
            get size() {
                return state.entries.length;
            },
            get closed() {
                return state.closed;
            }
        } satisfies HistoryTransactionHandle;
    }

    setContext(context: HistoryActionContext): void {
        this.ctx = context;
    }

    getContext(): HistoryActionContext {
        return this.ctx;
    }

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        this.eventTarget.addEventListener(type, listener, options);
    }

    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void {
        this.eventTarget.removeEventListener(type, listener, options);
    }

    private commitTransaction(state: TransactionState, commitOptions: HistoryExecuteOptions): void {
        const entries = state.entries;
        if (!entries.length) {
            this.syncStacks();
            this.dispatchChange('transaction-commit');
            return;
        }

        const merged = mergeOptions(state.options, commitOptions);
        // Transactions always produce a stored entry, so ignore ephemeral hints.
        delete merged.isEphemeral;

        const compositeAction: HistoryAction = {
            label: merged.label ?? state.label ?? entries[entries.length - 1]?.label,
            do: (ctx) => {
                for (const entry of entries) {
                    entry.action.do(ctx);
                }
            },
            undo: (ctx) => {
                for (let i = entries.length - 1; i >= 0; i--) {
                    entries[i].action.undo(ctx);
                }
            },
            canCoalesceWith(next) {
                const last = entries[entries.length - 1]?.action;
                if (!last?.canCoalesceWith) return false;
                return last.canCoalesceWith(next);
            }
        };

        const entry: HistoryEntry = {
            action: compositeAction,
            label: compositeAction.label ?? 'Transaction',
            timestamp: Date.now(),
            coalesceKey: merged.coalesceKey,
            suppressAutoscroll: merged.suppressAutoscroll
        };

        const coalesced = this.tryCoalesce(this.past, entry, merged.coalesceStrategy);
        if (!coalesced) {
            this.past.push(entry);
        }
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('transaction-commit');
    }

    private cancelTransaction(state: TransactionState): void {
        const entries = state.entries;
        for (let i = entries.length - 1; i >= 0; i--) {
            try {
                entries[i].action.undo(this.ctx);
            } catch (error) {
                console.error('HistoryManager.cancelTransaction failed during action.undo', error);
                throw error;
            }
        }
        this.activeTransaction = null;
        this.syncStacks();
        this.dispatchChange('transaction-cancel');
    }

    private tryCoalesce(
        stack: HistoryEntry[],
        entry: HistoryEntry,
        strategy?: HistoryCoalesceStrategy
    ): HistoryEntry | null {
        if (!entry.coalesceKey || !stack.length) return null;
        const previous = stack[stack.length - 1];
        if (!previous || previous.coalesceKey !== entry.coalesceKey) return null;

        let shouldCoalesce = false;
        if (!strategy) {
            shouldCoalesce = previous.action.canCoalesceWith?.(entry.action) ?? false;
        } else if (isReplaceStrategy(strategy)) {
            shouldCoalesce = true;
        } else {
            shouldCoalesce = strategy(previous, entry);
        }

        if (!shouldCoalesce) {
            return null;
        }

        if (isReplaceStrategy(strategy)) {
            stack[stack.length - 1] = entry;
            return entry;
        }

        previous.label = entry.label;
        previous.timestamp = entry.timestamp;
        previous.suppressAutoscroll = entry.suppressAutoscroll;
        return previous;
    }

    private updateLastLabel(): void {
        const last = this.past[this.past.length - 1];
        this.lastLabel = last ? last.label : null;
    }

    private syncStacks(): void {
        this.canUndo = this.past.length > 0;
        this.canRedo = this.future.length > 0;
    }

    private dispatchChange(reason?: string): void {
        const detail: HistoryChangeEventDetail = {
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            lastLabel: this.lastLabel,
            reason
        };
        const event = new CustomEvent<HistoryChangeEventDetail>('history:change', {
            detail
        });
        this.eventTarget.dispatchEvent(event);
        if (browser) {
            try {
                document.dispatchEvent(
                    new CustomEvent<HistoryChangeEventDetail>('history:change', {
                        detail
                    })
                );
            } catch (error) {
                console.error('HistoryManager.dispatchChange failed to dispatch DOM event', error);
            }
        }
    }
}

export const historyManager = new HistoryManager();
