<script lang="ts">
    import { commandManager } from '$lib/command-manager';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '$lib/components/ui/dropdown-menu';
    import { downloadSongAsNbx, songToNbx } from '$lib/files';
    import { downloadSongAsNbs, songToNbs } from '$lib/nbs';
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

    async function handleExportAsNbs() {
        if (!player.song) {
            console.warn('No song loaded to export');
            return;
        }

        const suggestedName = player.song.name || 'Untitled';
        await exportSongWithPicker(suggestedName);
    }

    async function exportSongWithPicker(suggestedName: string) {
        if (!player.song) return;

        // Try modern File System Access API first
        if ('showSaveFilePicker' in window) {
            try {
                const options = {
                    suggestedName: `${suggestedName}.nbs`,
                    types: [
                        {
                            description: 'Note Block Studio Song',
                            accept: {
                                'application/octet-stream': ['.nbs']
                            }
                        }
                    ]
                };

                const handle = await (window as any).showSaveFilePicker(options);
                const nbsData = songToNbs(player.song);

                // Create a new non-resizable ArrayBuffer and copy the data
                const buffer = new ArrayBuffer(nbsData.byteLength);
                const view = new Uint8Array(buffer);
                view.set(new Uint8Array(nbsData));

                const writable = await handle.createWritable();
                await writable.write(buffer);
                await writable.close();

                toast.success('Song exported as NBS file!');
                return;
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    return;
                }
            }
        }

        // Fallback to regular download
        downloadSongAsNbs(player.song, suggestedName);
        toast.success('Song exported as NBS file!');
    }

    onMount(() => {
        commandManager.registerCommands([
            {
                id: 'save-as',
                title: 'Save As',
                callback: handleSaveAs,
                shortcut: 'MOD+S'
            },
            {
                id: 'export-nbs',
                title: 'Export as NBS',
                callback: handleExportAsNbs,
                shortcut: 'MOD+SHIFT+N'
            }
        ]);

        return () => commandManager.unregisterCommands(['save', 'save-as', 'export-nbs']);
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
        <DropdownMenuItem onclick={handleExportAsNbs}>Export as NBS</DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
