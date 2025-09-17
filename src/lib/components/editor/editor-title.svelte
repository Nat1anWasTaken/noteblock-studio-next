<script lang="ts">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import Input from '$lib/components/ui/input/input.svelte';
    import { player } from '$lib/playback.svelte';
    import { tick } from 'svelte';
    import ChevronDown from '~icons/lucide/chevron-down';

    interface Props {
        class?: string;
    }

    let { class: className }: Props = $props();

    let editingName = $state(false);
    let inputElement = $state<HTMLInputElement | null>(null);

    const songName = $derived(player.song?.name || 'Untitled');

    async function startEditing() {
        editingName = true;
        await tick();
        inputElement?.focus();
        inputElement?.select();
    }

    function saveNameChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const newName = target.value.trim();
        if (newName && newName !== songName && player.song) {
            player.song.name = newName;
        }
        editingName = false;
    }

    function cancelNameChange() {
        editingName = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            saveNameChange(event);
        } else if (event.key === 'Escape') {
            cancelNameChange();
        }
    }
</script>

<DropdownMenu.Root>
    <span class={`flex items-center gap-1 ${className || ''}`}>
        {#if editingName}
            <Input
                bind:ref={inputElement}
                value={songName}
                class="h-auto border-none bg-transparent p-0 font-medium shadow-none focus-visible:ring-0"
                onkeydown={handleKeydown}
                onblur={cancelNameChange}
            />
        {:else}
            <span
                class="cursor-text truncate border-1 border-transparent font-medium hover:border-current/20"
                ondblclick={startEditing}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && startEditing()}
            >
                {songName}
            </span>
        {/if}
        <DropdownMenu.Trigger>
            <ChevronDown class="size-4 cursor-pointer text-muted-foreground" />
        </DropdownMenu.Trigger>
    </span>

    <DropdownMenu.Content class="w-48">
        <DropdownMenu.Group>
            <DropdownMenu.Label>File</DropdownMenu.Label>
            <DropdownMenu.Item class="flex items-center justify-between">
                Save
                <DropdownMenu.Shortcut>Ctrl+S</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.Item class="flex items-center justify-between">
                Save As...
                <DropdownMenu.Shortcut>Ctrl+Shift+S</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>Import & Export</DropdownMenu.Label>
            <DropdownMenu.Item class="flex items-center justify-between">
                Import NBS
                <DropdownMenu.Shortcut>Ctrl+I</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.Item class="flex items-center justify-between">
                Import MIDI
                <DropdownMenu.Shortcut>Ctrl+M</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.Item class="flex items-center justify-between">
                Export
                <DropdownMenu.Shortcut>Ctrl+E</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>Projects</DropdownMenu.Label>
            <DropdownMenu.Item class="flex items-center justify-between">
                Create New Project
                <DropdownMenu.Shortcut>Ctrl+N</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
        </DropdownMenu.Group>
    </DropdownMenu.Content>
</DropdownMenu.Root>
