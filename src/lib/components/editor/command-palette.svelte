<script lang="ts">
    import {
        commandManager,
        shortcutToString,
        type Command as CommandType
    } from '$lib/command-manager';
    import * as Command from '$lib/components/ui/command';
    import { onMount } from 'svelte';

    let open = $state(false);
    let searchValue = $state('');

    function handleKeyDown(event: KeyboardEvent) {
        commandManager.handleKeyboardEvent(event);
    }

    function executeCommand(command: CommandType) {
        commandManager.executeCommand(command.id);
        open = false;
        searchValue = '';
    }

    const filteredCommands = $derived(
        commandManager
            .getCommands()
            .filter(
                (command) =>
                    command.title.toLowerCase().includes(searchValue.toLowerCase()) ||
                    command.id.toLowerCase().includes(searchValue.toLowerCase())
            )
    );

    onMount(() => {
        commandManager.register({
            id: 'toggle-command-palette',
            title: 'Toggle Command Palette',
            callback: () => {
                open = !open;
            },
            shortcut: 'Mod+Shift+P'
        });

        return () => {
            commandManager.unregister('toggle-command-palette');
        };
    });

    // TODO: Implement icon rendering
</script>

<svelte:window onkeydown={handleKeyDown} />

<Command.Dialog bind:open>
    {#snippet children()}
        <Command.Input bind:value={searchValue} placeholder="Type a command or search..." />
        <Command.List>
            {#each filteredCommands as command (command.id)}
                <Command.Item onSelect={() => executeCommand(command)}>
                    <div class="flex items-center gap-2">
                        {command.title}
                    </div>
                    {#if command.shortcut}
                        <Command.Shortcut>{shortcutToString(command.shortcut)}</Command.Shortcut>
                    {/if}
                </Command.Item>
            {/each}
            {#if filteredCommands.length === 0}
                <div class="py-6 text-center text-sm text-muted-foreground">No commands found.</div>
            {/if}
        </Command.List>
    {/snippet}
</Command.Dialog>
