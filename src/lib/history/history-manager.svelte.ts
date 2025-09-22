import { browser } from '$app/environment';
// Do not import `player` or `editorState` here to avoid circular initialization.
// The runtime context must be set by the application once singletons are constructed.

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

    // Initialize with a placeholder; the real context must be injected via `setContext`.
    // Using a lazy any avoids accessing singletons during module initialization and prevents
    // circular import ReferenceErrors.
    private ctx: HistoryActionContext = {} as unknown as HistoryActionContext;
    private eventTarget = new EventTarget();
    private activeTransaction: TransactionState | null = null;

    execute(action: HistoryAction, options: HistoryExecuteOptions = {}): HistoryEntry | null {
        console.debug('🔄 [EXECUTE] Starting action:', action.label, {
            hasTransaction: !!this.activeTransaction,
            pastLength: this.past.length,
            futureLength: this.future.length,
            options
        });
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
            console.debug('▶️ [EXECUTE] Calling action.do for:', action.label);
            action.do(this.ctx);
            console.debug('✅ [EXECUTE] Successfully executed action.do for:', action.label);
        } catch (error) {
            console.error('❌ [EXECUTE] Failed during action.do for:', action.label, error);
            throw error;
        }

        // Ephemeral actions mutate state but do not create history entries.
        if (merged.isEphemeral) {
            console.debug(
                '👻 [EXECUTE] Ephemeral action - no history entry created for:',
                action.label
            );
            this.future = [];
            this.syncStacks();
            this.dispatchChange('execute');
            return null;
        }

        // Any new action invalidates the redo stack.
        const clearedFuture = this.future.length;
        this.future = [];
        if (clearedFuture > 0) {
            console.debug(
                '🗑️ [EXECUTE] Cleared',
                clearedFuture,
                'future entries for action:',
                action.label
            );
        }

        if (transaction) {
            console.debug('📦 [EXECUTE] Adding to transaction:', {
                actionLabel: action.label,
                transactionSize: transaction.entries.length,
                coalesceStrategy: merged.coalesceStrategy
            });
            const coalesced = this.tryCoalesce(transaction.entries, entry, merged.coalesceStrategy);
            if (!coalesced) {
                transaction.entries.push(entry);
                console.debug(
                    '➕ [EXECUTE] Added new entry to transaction. New size:',
                    transaction.entries.length
                );
            } else {
                console.debug('🔗 [EXECUTE] Coalesced action in transaction for:', action.label);
            }
            this.syncStacks();
            this.dispatchChange('execute');
            return coalesced ?? entry;
        }

        const coalesced = this.tryCoalesce(this.past, entry, merged.coalesceStrategy);
        if (!coalesced) {
            this.past.push(entry);
            console.debug(
                '📈 [EXECUTE] Added to history stack. New length:',
                this.past.length,
                'Action:',
                action.label
            );
        } else {
            console.debug('🔗 [EXECUTE] Coalesced with previous action:', action.label);
        }
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('execute');
        console.debug('🏁 [EXECUTE] Completed action:', action.label, {
            pastLength: this.past.length,
            canUndo: this.canUndo,
            canRedo: this.canRedo
        });
        return coalesced ?? entry;
    }

    undo(): HistoryEntry | null {
        console.debug('⬅️ [UNDO] Starting undo operation', {
            pastLength: this.past.length,
            futureLength: this.future.length,
            hasTransaction: !!this.activeTransaction
        });
        if (this.activeTransaction) {
            console.warn(
                '⚠️ [UNDO] Cannot undo while a transaction is active. Call commit() or cancel() first.'
            );
            return null;
        }
        const entry = this.past.pop();
        if (!entry) {
            console.debug('🚫 [UNDO] No entries to undo');
            return null;
        }
        console.debug('◀️ [UNDO] Undoing action:', entry.label);
        try {
            entry.action.undo(this.ctx);
            console.debug('✅ [UNDO] Successfully undid action:', entry.label);
        } catch (error) {
            console.error('❌ [UNDO] Failed during action.undo for:', entry.label, error);
            throw error;
        }
        this.future.push(entry);
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('undo');
        console.debug('🏁 [UNDO] Completed undo of:', entry.label, {
            pastLength: this.past.length,
            futureLength: this.future.length
        });
        return entry;
    }

    redo(): HistoryEntry | null {
        console.debug('➡️ [REDO] Starting redo operation', {
            pastLength: this.past.length,
            futureLength: this.future.length,
            hasTransaction: !!this.activeTransaction
        });
        if (this.activeTransaction) {
            console.warn(
                '⚠️ [REDO] Cannot redo while a transaction is active. Call commit() or cancel() first.'
            );
            return null;
        }
        const entry = this.future.pop();
        if (!entry) {
            console.debug('🚫 [REDO] No entries to redo');
            return null;
        }
        console.debug('▶️ [REDO] Redoing action:', entry.label);
        try {
            entry.action.do(this.ctx);
            console.debug('✅ [REDO] Successfully redid action:', entry.label);
        } catch (error) {
            console.error('❌ [REDO] Failed during action.do for:', entry.label, error);
            throw error;
        }
        this.past.push(entry);
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('redo');
        console.debug('🏁 [REDO] Completed redo of:', entry.label, {
            pastLength: this.past.length,
            futureLength: this.future.length
        });
        return entry;
    }

    clear(reason = 'clear'): void {
        console.debug('🗑️ [CLEAR] Clearing history, reason:', reason, {
            pastLength: this.past.length,
            futureLength: this.future.length,
            hasActiveTransaction: !!this.activeTransaction
        });
        if (this.activeTransaction) {
            // Cancel without undo to avoid double undoing the callers' in-progress work.
            console.debug('⚠️ [CLEAR] Closing active transaction without undo');
            this.activeTransaction.closed = true;
            this.activeTransaction = null;
        }
        const clearedPast = this.past.length;
        const clearedFuture = this.future.length;
        this.past = [];
        this.future = [];
        this.lastLabel = null;
        this.syncStacks();
        this.dispatchChange(reason);
        console.debug('✅ [CLEAR] History cleared:', {
            clearedPast,
            clearedFuture,
            reason
        });
    }

    beginTransaction(
        label?: string,
        options: HistoryExecuteOptions = {}
    ): HistoryTransactionHandle {
        console.debug('📦 [TRANSACTION] Starting transaction:', label ?? 'Unnamed', {
            options,
            currentPastLength: this.past.length
        });
        if (this.activeTransaction && !this.activeTransaction.closed) {
            throw new Error(
                'A history transaction is already active. Nested transactions are not supported.'
            );
        }
        const state: TransactionState = {
            entries: [],
            label,
            options,
            closed: false
        };
        this.activeTransaction = state;
        console.debug('✅ [TRANSACTION] Transaction created:', label ?? 'Unnamed');

        return {
            add: (action, addOptions = {}) => {
                if (state.closed) {
                    console.warn(
                        '⚠️ [TRANSACTION] Attempted to add an action to a closed transaction:',
                        action.label
                    );
                    return null;
                }
                console.debug('➕ [TRANSACTION] Adding action to transaction:', action.label);
                return this.execute(action, addOptions);
            },
            commit: (commitOptions = {}) => {
                if (state.closed) {
                    console.debug(
                        '⚠️ [TRANSACTION] Attempted to commit already closed transaction'
                    );
                    return;
                }
                console.debug(
                    '💾 [TRANSACTION] Committing transaction with',
                    state.entries.length,
                    'entries'
                );
                state.closed = true;
                this.activeTransaction = null;
                this.commitTransaction(state, commitOptions);
            },
            cancel: () => {
                if (state.closed) {
                    console.debug(
                        '⚠️ [TRANSACTION] Attempted to cancel already closed transaction'
                    );
                    return;
                }
                console.debug(
                    '❌ [TRANSACTION] Cancelling transaction with',
                    state.entries.length,
                    'entries'
                );
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
        console.debug('💾 [TRANSACTION-COMMIT] Processing commit with', entries.length, 'entries');
        if (!entries.length) {
            console.debug('🙅 [TRANSACTION-COMMIT] Empty transaction - nothing to commit');
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

        console.debug('🔗 [TRANSACTION-COMMIT] Creating composite action:', entry.label);
        const coalesced = this.tryCoalesce(this.past, entry, merged.coalesceStrategy);
        if (!coalesced) {
            this.past.push(entry);
            console.debug(
                '📈 [TRANSACTION-COMMIT] Added composite action to history. New length:',
                this.past.length
            );
        } else {
            console.debug('🔗 [TRANSACTION-COMMIT] Coalesced composite action with previous entry');
        }
        this.updateLastLabel();
        this.syncStacks();
        this.dispatchChange('transaction-commit');
        console.debug('✅ [TRANSACTION-COMMIT] Transaction committed successfully');
    }

    private cancelTransaction(state: TransactionState): void {
        const entries = state.entries;
        console.debug(
            '❌ [TRANSACTION-CANCEL] Undoing',
            entries.length,
            'actions in reverse order'
        );
        for (let i = entries.length - 1; i >= 0; i--) {
            try {
                console.debug(
                    '↩️ [TRANSACTION-CANCEL] Undoing action',
                    i + 1,
                    'of',
                    entries.length,
                    ':',
                    entries[i].label
                );
                entries[i].action.undo(this.ctx);
            } catch (error) {
                console.error(
                    '❌ [TRANSACTION-CANCEL] Failed during action.undo for:',
                    entries[i].label,
                    error
                );
                throw error;
            }
        }
        this.activeTransaction = null;
        this.syncStacks();
        this.dispatchChange('transaction-cancel');
        console.debug('✅ [TRANSACTION-CANCEL] Transaction cancelled successfully');
    }

    private tryCoalesce(
        stack: HistoryEntry[],
        entry: HistoryEntry,
        strategy?: HistoryCoalesceStrategy
    ): HistoryEntry | null {
        if (!entry.coalesceKey || !stack.length) {
            if (!entry.coalesceKey) {
                console.debug('🔗 [COALESCE] No coalesce key for:', entry.label);
            }
            return null;
        }
        const previous = stack[stack.length - 1];
        if (!previous || previous.coalesceKey !== entry.coalesceKey) {
            if (previous && previous.coalesceKey !== entry.coalesceKey) {
                console.debug(
                    '🔗 [COALESCE] Key mismatch for:',
                    entry.label,
                    'prev:',
                    previous.coalesceKey,
                    'current:',
                    entry.coalesceKey
                );
            }
            return null;
        }

        console.debug(
            '🔗 [COALESCE] Checking coalesce for:',
            entry.label,
            'with:',
            previous.label,
            'strategy:',
            strategy
        );
        let shouldCoalesce = false;
        if (!strategy) {
            shouldCoalesce = previous.action.canCoalesceWith?.(entry.action) ?? false;
            console.debug('🔗 [COALESCE] Default strategy result:', shouldCoalesce);
        } else if (isReplaceStrategy(strategy)) {
            shouldCoalesce = true;
            console.debug('🔗 [COALESCE] Replace strategy - always coalesce');
        } else {
            shouldCoalesce = strategy(previous, entry);
            console.debug('🔗 [COALESCE] Custom strategy result:', shouldCoalesce);
        }

        if (!shouldCoalesce) {
            console.debug('🚫 [COALESCE] Not coalescing:', entry.label);
            return null;
        }

        if (isReplaceStrategy(strategy)) {
            console.debug('🔄 [COALESCE] Replacing previous entry with:', entry.label);
            stack[stack.length - 1] = entry;
            return entry;
        }

        console.debug(
            '🔗 [COALESCE] Merging with previous entry:',
            previous.label,
            '->',
            entry.label
        );
        previous.label = entry.label;
        previous.timestamp = entry.timestamp;
        previous.suppressAutoscroll = entry.suppressAutoscroll;
        return previous;
    }

    private updateLastLabel(): void {
        const last = this.past[this.past.length - 1];
        const oldLabel = this.lastLabel;
        this.lastLabel = last ? last.label : null;
        if (oldLabel !== this.lastLabel) {
            console.debug('🏷️ [LABEL] Last label changed from:', oldLabel, 'to:', this.lastLabel);
        }
    }

    private syncStacks(): void {
        const oldCanUndo = this.canUndo;
        const oldCanRedo = this.canRedo;
        this.canUndo = this.past.length > 0;
        this.canRedo = this.future.length > 0;
        if (oldCanUndo !== this.canUndo || oldCanRedo !== this.canRedo) {
            console.debug('🔄 [SYNC] Stack state changed:', {
                canUndo: `${oldCanUndo} -> ${this.canUndo}`,
                canRedo: `${oldCanRedo} -> ${this.canRedo}`,
                pastLength: this.past.length,
                futureLength: this.future.length
            });
        }
    }

    private dispatchChange(reason?: string): void {
        console.debug(`History changed: ${reason}`, {
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            lastLabel: this.lastLabel,
            pastLength: this.past.length,
            futureLength: this.future.length
        });
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
