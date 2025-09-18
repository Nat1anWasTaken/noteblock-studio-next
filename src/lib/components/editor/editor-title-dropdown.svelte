<script lang="ts">
    import { commandManager } from '$lib/command-manager';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '$lib/components/ui/dropdown-menu';
    import { downloadSongAsNbx, songToNbx } from '$lib/files';
    import { player } from '$lib/playback.svelte';
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';

    interface Props {
        class?: string;
        children: any;
    }

    let { class: className, children }: Props = $props();

    function handleSave() {
        toast.warning(
            'Save is not available on the web browser. Please use Save As to download your song.'
        );
    }

    function handleSaveAs() {
        if (!player.song) {
            console.warn('No song loaded to save');
            return;
        }

        const suggestedName = player.song.name || 'Untitled';
        saveSongWithPicker(suggestedName);
    }

    async function saveSongWithPicker(suggestedName: string) {
        if (!player.song) return;

        // Try modern File System Access API first
        if ('showSaveFilePicker' in window) {
            try {
                const options = {
                    suggestedName: `${suggestedName}.nbx`,
                    types: [
                        {
                            description: 'Noteblock Studio Song',
                            accept: {
                                'application/zip': ['.nbx']
                            }
                        }
                    ]
                };

                const handle = await (window as any).showSaveFilePicker(options);
                const nbxData = await songToNbx(player.song);

                const writable = await handle.createWritable();
                await writable.write(nbxData);
                await writable.close();

                return;
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    return;
                }
            }
        }

        // Fallback to regular download
        downloadSongAsNbx(player.song, suggestedName);
    }

    onMount(() => {
        commandManager.registerCommands([
            {
                id: 'save',
                title: 'Save',
                callback: handleSave,
                shortcut: 'Mod+S'
            },
            {
                id: 'save-as',
                title: 'Save As',
                callback: handleSaveAs,
                shortcut: 'Mod+Shift+S'
            }
        ]);

        return () => commandManager.unregisterCommands(['save', 'save-as']);
    });
</script>

<DropdownMenu>
    <DropdownMenuTrigger class={className}>
        {@render children()}
    </DropdownMenuTrigger>
    <DropdownMenuContent>
        <!-- TODO: Enable Save button on desktop environments where we can save to a known location -->
        <DropdownMenuItem onclick={handleSave} disabled>Save</DropdownMenuItem>
        <DropdownMenuItem onclick={handleSaveAs}>Save As</DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
