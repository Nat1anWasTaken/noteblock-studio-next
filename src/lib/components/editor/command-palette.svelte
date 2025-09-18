<script lang="ts">
    import { commandManager, type Command as CommandType } from '$lib/command-manager.js';
    import * as Command from '$lib/components/ui/command';
    let open = $state(false);
    let searchValue = $state('');
    let commands = $state<CommandType[]>([]);

    function handleKeyDown(event: KeyboardEvent) {
        // Toggle on Ctrl/Cmd + Shift + P
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            open = !open;
        }
    }

    function executeCommand(command: CommandType) {
        commandManager.executeCommand(command.id);
        open = false;
        searchValue = '';
    }

    const filteredCommands = $derived(
        commands.filter(
            (command) =>
                command.title.toLowerCase().includes(searchValue.toLowerCase()) ||
                command.id.toLowerCase().includes(searchValue.toLowerCase())
        )
    );
</script>

<svelte:window onkeydown={handleKeyDown} />

<Command.Dialog bind:open>
    {#snippet children()}
        <Command.Input bind:value={searchValue} placeholder="Type a command or search..." />
        <Command.List>
            {#each filteredCommands as command (command.id)}
                <Command.Item onSelect={() => executeCommand(command)}>
                    <span class="mr-2">{command.icon}</span>
                    {command.title}
                    {#if command.shortcut}
                        <Command.Shortcut>{command.shortcut}</Command.Shortcut>
                    {/if}
                </Command.Item>
            {/each}
            {#if filteredCommands.length === 0}
                <div class="py-6 text-center text-sm text-muted-foreground">No commands found.</div>
            {/if}
        </Command.List>
    {/snippet}
</Command.Dialog>
