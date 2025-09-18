export interface Command {
    id: string;
    icon: string;
    title: string;
    callback: () => void;
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
            console.warn(`Command with id "${command.id}" is already registered. Overwriting.`);
        }

        this.commands.set(command.id, command);

        // Register shortcut if provided
        if (command.shortcut) {
            this.shortcuts.set(this.normalizeShortcut(command.shortcut), command.id);
        }
    }

    /**
     * Handle keyboard events and execute matching commands
     */
    handleKeyboardEvent(event: KeyboardEvent): boolean {
        const shortcut = this.buildShortcutString(event);

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
     * Build a normalized shortcut string from a KeyboardEvent
     */
    private buildShortcutString(event: KeyboardEvent): string {
        const parts: string[] = [];

        // Add modifier keys in a consistent order
        if (event.ctrlKey || event.metaKey) {
            parts.push('Mod'); // Use 'Mod' to handle both Ctrl (Windows/Linux) and Cmd (Mac)
        }
        if (event.altKey) {
            parts.push('Alt');
        }
        if (event.shiftKey) {
            parts.push('Shift');
        }

        // Add the main key
        const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
        parts.push(key);

        return parts.join('+');
    }

    /**
     * Normalize a shortcut string for consistent storage and comparison
     */
    private normalizeShortcut(shortcut: string): string {
        return shortcut
            .replace(/\s+/g, '') // Remove spaces
            .replace(/Cmd|Command/g, 'Mod') // Normalize Cmd/Command to Mod
            .replace(/Ctrl/g, 'Mod') // Normalize Ctrl to Mod
            .toUpperCase(); // Make case insensitive
    }
}

// Create a singleton instance
export const commandManager = new CommandManager();
