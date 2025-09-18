<script lang="ts">
    import Input from '$lib/components/ui/input/input.svelte';
    import { player } from '$lib/playback.svelte';
    import { tick } from 'svelte';
    import EditorTitleDropdown from './editor-title-dropdown.svelte';

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

<EditorTitleDropdown class={className}>
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
</EditorTitleDropdown>
