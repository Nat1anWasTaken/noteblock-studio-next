type Platform = 'mac' | 'windows' | 'linux';

const DEFAULT_SCOPE = 'global';

type CommandScope = typeof DEFAULT_SCOPE | string;

interface RegisteredCommand extends Command {
    scope: CommandScope;
    shortcut?: string;
}

interface ScopeLayer {
    id: CommandScope;
    exclusive: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function detectPlatform(): Platform {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('win')) return 'windows';
    return 'linux';
}

function capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function shortcutToString(shortcut: string): string {
    const platform = detectPlatform();

    shortcut.split('+').map((part) => capitalizeFirstLetter(part));

    switch (platform) {
        case 'mac':
            return shortcut
                .replace(/MOD/g, '⌘')
                .replace(/CTRL/g, '⌃')
                .replace(/ALT/g, '⌥')
                .replace(/SHIFT/g, '⇧');
        default:
            return shortcut
                .replace(/MOD/g, 'Ctrl')
                .replace(/CTRL/g, 'Ctrl')
                .replace(/ALT/g, 'Alt')
                .replace(/SHIFT/g, 'Shift');
    }
}

export interface Command {
    id: string;
    title: string;
    callback: () => void;
    icon?: string; // TODO: Implement icon support
    shortcut?: string;
    scope?: CommandScope;
}

export class CommandManager {
    private commands = new Map<string, RegisteredCommand>();
    private scopeShortcuts = new Map<CommandScope, Map<string, string>>();
    private activeScopes: ScopeLayer[] = [{ id: DEFAULT_SCOPE, exclusive: false }];

    /**
     * Register a new command
     */
    register(command: Command): void {
        if (this.commands.has(command.id)) {
            throw new Error(`Command with id "${command.id}" is already registered.`);
        }

        const scope = command.scope ?? DEFAULT_SCOPE;
        const normalizedShortcut = command.shortcut
            ? this.normalizeShortcut(command.shortcut)
            : undefined;

        const registered: RegisteredCommand = {
            ...command,
            scope,
            shortcut: normalizedShortcut
        };

        this.commands.set(command.id, registered);

        if (normalizedShortcut) {
            const shortcutsForScope = this.getScopeShortcuts(scope);
            shortcutsForScope.set(normalizedShortcut, command.id);
        }
    }

    /**
     * Register multiple commands at once
     * @param commands Array of commands to register
     */
    registerCommands(commands: Command[]): void {
        for (const command of commands) {
            this.register(command);
        }
    }

    /**
     * Handle keyboard events and execute matching commands
     */
    handleKeyboardEvent(event: KeyboardEvent): boolean {
        // Don't process shortcuts if user is focused on an editable element
        if (isEditableTarget(event.target)) {
            return false;
        }

        const shortcut = this.buildShortcutString(event);

        for (let i = this.activeScopes.length - 1; i >= 0; i--) {
            const layer = this.activeScopes[i];
            const commandId = this.getScopeShortcuts(layer.id).get(shortcut);

            if (commandId) {
                const command = this.commands.get(commandId);
                if (command) {
                    event.preventDefault();
                    event.stopPropagation();
                    command.callback();
                    return true;
                }
            }

            if (layer.exclusive) {
                break;
            }
        }

        return false;
    }

    /**
     * Execute a command by its ID
     */
    executeCommand(id: string): boolean {
        const command = this.commands.get(id);

        if (command) {
            command.callback();
            return true;
        }

        console.warn(`Command with id "${id}" not found.`);
        return false;
    }

    /**
     * Get all registered commands
     */
    getCommands(): Command[] {
        return Array.from(this.commands.values());
    }

    /**
     * Get a command by ID
     */
    getCommand(id: string): Command | undefined {
        return this.commands.get(id);
    }

    /**
     * Unregister a command
     */
    unregister(id: string): boolean {
        const command = this.commands.get(id);
        if (!command) {
            return false;
        }

        if (command.shortcut) {
            const scopeShortcuts = this.scopeShortcuts.get(command.scope);
            scopeShortcuts?.delete(command.shortcut);
            if (scopeShortcuts && scopeShortcuts.size === 0 && command.scope !== DEFAULT_SCOPE) {
                this.scopeShortcuts.delete(command.scope);
            }
        }

        return this.commands.delete(id);
    }

    /**
     * Unregister multiple commands
     * @param ids Array of command IDs to unregister
     */
    unregisterCommands(ids: string[]): void {
        for (const id of ids) {
            this.unregister(id);
        }
    }

    /**
     * Build a normalized shortcut string from a KeyboardEvent
     */
    private buildShortcutString(event: KeyboardEvent): string {
        const parts: string[] = [];

        // Add modifier keys in a consistent order
        if (event.ctrlKey || event.metaKey) {
            parts.push('MOD'); // Use 'Mod' to handle both Ctrl (Windows/Linux) and Cmd (Mac)
        }
        if (event.altKey) {
            parts.push('ALT');
        }
        if (event.shiftKey) {
            parts.push('SHIFT');
        }

        // Add the main key
        if (event.key === ' ') {
            parts.push('SPACE');
        } else {
            parts.push(event.key.toUpperCase());
        }

        return parts.join('+');
    }

    /**
     * Normalize a shortcut string for consistent storage and comparison
     */
    private normalizeShortcut(shortcut: string): string {
        return shortcut
            .replace(/\s+/g, ' ') // Remove spaces
            .replace(/Cmd|Command/g, 'Mod') // Normalize Cmd/Command to Mod
            .replace(/Ctrl/g, 'Mod') // Normalize Ctrl to Mod
            .toUpperCase(); // Make case insensitive
    }

    private getScopeShortcuts(scope: CommandScope): Map<string, string> {
        let shortcuts = this.scopeShortcuts.get(scope);
        if (!shortcuts) {
            shortcuts = new Map();
            this.scopeShortcuts.set(scope, shortcuts);
        }
        return shortcuts;
    }

    /**
     * Activate a scoped layer for keyboard shortcuts. The returned callback removes the scope.
     */
    enterScope(id: CommandScope, options?: { exclusive?: boolean }): () => void {
        const layer: ScopeLayer = {
            id,
            exclusive: options?.exclusive ?? false
        };
        this.activeScopes.push(layer);
        return () => {
            const index = this.activeScopes.indexOf(layer);
            if (index !== -1) {
                this.activeScopes.splice(index, 1);
            }
        };
    }
}

// Create a singleton instance
export const commandManager = new CommandManager();
