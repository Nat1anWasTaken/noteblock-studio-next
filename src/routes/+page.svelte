<script>
    import Button from '$lib/components/ui/button/button.svelte';
    import { toast } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { fromArrayBuffer } from '@nbsjs/core';
    import { convertNbsSong } from '$lib/nbs';
    import { player } from '$lib/playback.svelte';
    import CirclePlus from '~icons/lucide/circle-plus';
    import Piano from '~icons/lucide/keyboard-music';
    import Music from '~icons/lucide/music-3';

    function handleImportNBS() {
        try {
            // Create a file input element
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.nbs';
            input.multiple = false;

            input.onchange = async () => {
                try {
                    const file = input.files?.[0];
                    if (!file) {
                        return; // User cancelled file selection
                    }

                    // Read file as ArrayBuffer
                    const arrayBuffer = await file.arrayBuffer();

                    // Parse NBS file using @nbsjs/core
                    const nbsSong = fromArrayBuffer(arrayBuffer);

                    // Convert to our internal format
                    const song = convertNbsSong(nbsSong);

                    // Set the song in the player
                    player.setSong(song);

                    toast.success(`Loaded "${song.name || file.name}" successfully!`);

                    // Navigate to the edit page
                    goto('/edit');
                } catch (error) {
                    console.error('Failed to import NBS file:', error);
                    toast.error('Failed to import NBS file. Please check the file format.');
                }
            };

            input.click();
        } catch (error) {
            console.error('Failed to import NBS file:', error);
            toast.error('Failed to import NBS file. Please check the file format.');
        }
    }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-2 p-24">
    <h1 class="text-4xl font-bold">Noteblock Studio Next</h1>
    <div class="flex flex-row flex-wrap gap-2">
        <Button
            variant="outline"
            class="flex aspect-square h-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={() => toast.info('Feature not implemented yet!')}
        >
            <CirclePlus />
            Create a Empty
        </Button>
        <Button
            variant="outline"
            class="flex aspect-square h-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={handleImportNBS}
        >
            <Music />
            Import NBS
        </Button>
        <Button
            variant="outline"
            class="flex aspect-square h-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={() => toast.info('Feature not implemented yet!')}
        >
            <Piano />
            Import MIDI
        </Button>
    </div>
</main>
