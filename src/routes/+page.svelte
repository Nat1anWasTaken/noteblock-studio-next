<script>
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button/button.svelte';
    import { readSongFromNbxFile } from '$lib/files';
    import { convertNbsSong } from '$lib/nbs';
    import { player } from '$lib/playback.svelte';
    import { fromArrayBuffer } from '@nbsjs/core';
    import { toast } from 'svelte-sonner';
    import CirclePlus from '~icons/lucide/circle-plus';
    import FolderOpen from '~icons/lucide/folder-open';
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

    function handleImportNBX() {
        try {
            // Create a file input element
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.nbx';
            input.multiple = false;

            input.onchange = async () => {
                try {
                    const file = input.files?.[0];
                    if (!file) {
                        return; // User cancelled file selection
                    }

                    // Read and parse NBX file using our utility
                    const song = await readSongFromNbxFile(file);

                    // Set the song in the player
                    player.setSong(song);

                    toast.success(`Loaded "${song.name || file.name}" successfully!`);

                    // Navigate to the edit page
                    goto('/edit');
                } catch (error) {
                    console.error('Failed to import NBX file:', error);
                    toast.error('Failed to import NBX file. Please check the file format.');
                }
            };

            input.click();
        } catch (error) {
            console.error('Failed to import NBX file:', error);
            toast.error('Failed to import NBX file. Please check the file format.');
        }
    }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-2 p-24">
    <h1 class="text-4xl font-bold">Noteblock Studio Next</h1>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Button
            variant="outline"
            class="flex h-32 w-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={() => toast.info('Feature not implemented yet!')}
        >
            <CirclePlus />
            Create a Empty
        </Button>
        <Button
            variant="outline"
            class="flex h-32 w-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={handleImportNBS}
        >
            <Music />
            Import NBS
        </Button>
        <Button
            variant="outline"
            class="flex h-32 w-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={handleImportNBX}
        >
            <FolderOpen />
            Open NBX
        </Button>
        <Button
            variant="outline"
            class="flex h-32 w-32 flex-1 shrink flex-col items-center justify-center text-wrap text-muted-foreground"
            onclick={() => toast.info('Feature not implemented yet!')}
        >
            <Piano />
            Import MIDI
        </Button>
    </div>
</main>
