type Platform = 'mac' | 'windows' | 'linux';

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
                .replace(/Mod/g, '⌘')
                .replace(/Ctrl/g, '⌃')
                .replace(/Alt/g, '⌥')
                .replace(/Shift/g, '⇧');
        default:
            return shortcut
                .replace(/Mod/g, 'Ctrl')
                .replace(/Ctrl/g, 'Ctrl')
                .replace(/Alt/g, 'Alt')
                .replace(/Shift/g, 'Shift');
    }
}

export interface Command {
    id: string;
    title: string;
    callback: () => void;
    icon?: string; // TODO: Implement icon support
    shortcut?: string;
}

export class CommandManager {
    private commands = new Map<string, Command>();
    private shortcuts = new Map<string, string>(); // shortcut -> commandId

    /**
     * Register a new command
     */
    register(command: Command): void {
        if (this.commands.has(command.id)) {
            throw new Error(`Command with id "${command.id}" is already registered.`);
        }

        this.commands.set(command.id, {
            shortcut: command.shortcut && this.normalizeShortcut(command.shortcut),
            ...command
        });

        // Register shortcut if provided
        if (command.shortcut) {
            this.shortcuts.set(this.normalizeShortcut(command.shortcut), command.id);
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
        const shortcut = this.buildShortcutString(event);

        console.log('Detected shortcut:', shortcut);

        if (this.shortcuts.has(shortcut)) {
            const commandId = this.shortcuts.get(shortcut)!;
            const command = this.commands.get(commandId);

            if (command) {
                event.preventDefault();
                event.stopPropagation();
                command.callback();
                return true;
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
        if (command && command.shortcut) {
            this.shortcuts.delete(this.normalizeShortcut(command.shortcut));
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
}

// Create a singleton instance
export const commandManager = new CommandManager();
