<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { Song } from '$lib/types';

    interface Props {
        open?: boolean;
        song: Song;
        savedAt: string;
        onResume?: () => void;
        onDiscard?: () => void;
        onCancel?: () => void;
    }

    let { open = $bindable(false), song, savedAt, onResume, onDiscard, onCancel }: Props = $props();

    function formatTimestamp(value: string): string {
        if (!value) return 'Unknown time';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown time';
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    }

    const songName = $derived(song?.name?.trim() ? song.name : 'Untitled Song');
    const songAuthor = $derived(song?.author?.trim() ? song.author : null);
    const totalChannels = $derived(song?.channels?.length ?? 0);
    const noteChannels = $derived(
        song?.channels?.filter((channel) => channel.kind === 'note').length ?? 0
    );
    const formattedSavedAt = $derived(formatTimestamp(savedAt));
    const showCancel = $derived(typeof onCancel === 'function');

    function handleResume() {
        open = false;
        onResume?.();
    }

    function handleDiscard() {
        open = false;
        onDiscard?.();
    }

    function handleCancel() {
        open = false;
        onCancel?.();
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Resume saved song?</Dialog.Title>
            <Dialog.Description>
                We found a song from your last session in this browser. Resume it or discard it to
                start fresh.
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid gap-3 py-4 text-sm">
            <div>
                <p class="text-muted-foreground">Song</p>
                <p class="font-medium">{songName}</p>
            </div>
            {#if songAuthor}
                <div>
                    <p class="text-muted-foreground">Author</p>
                    <p>{songAuthor}</p>
                </div>
            {/if}
            <div>
                <p class="text-muted-foreground">Last saved</p>
                <p>{formattedSavedAt}</p>
            </div>
            <div>
                <p class="text-muted-foreground">Channels</p>
                <p>
                    {totalChannels} total
                    {#if totalChannels}
                        · {noteChannels} note
                    {/if}
                </p>
            </div>
        </div>

        <Dialog.Footer>
            {#if showCancel}
                <Button variant="ghost" onclick={handleCancel}>Not now</Button>
            {/if}
            <Button variant="outline" onclick={handleDiscard}>Discard</Button>
            <Button onclick={handleResume}>Resume</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
