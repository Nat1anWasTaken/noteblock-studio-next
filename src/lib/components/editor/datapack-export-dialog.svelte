<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import Input from '$lib/components/ui/input/input.svelte';
    import Label from '$lib/components/ui/label/label.svelte';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import * as Select from '$lib/components/ui/select/index.js';
    import { createSongDatapack, datapackToZip, type Direction } from '$lib/datapack';
    import type { Song } from '$lib/types';
    import { toast } from 'svelte-sonner';

    interface Props {
        open?: boolean;
        song: Song | null;
    }

    let { open = $bindable(false), song }: Props = $props();

    let namespace = $state('noteblock_studio');
    let visualizer = $state(true);
    let direction = $state<Direction>('west');
    let startX = $state(0);
    let startY = $state(64);
    let startZ = $state(0);
    let tempoOverride = $state<number | undefined>(undefined);

    const directionLabels: Record<Direction, string> = {
        north: 'North (-Z)',
        south: 'South (+Z)',
        east: 'East (+X)',
        west: 'West (-X)'
    };

    async function handleExport() {
        if (!song) {
            console.warn('No song loaded to export');
            return;
        }

        try {
            // Generate the datapack
            const datapack = createSongDatapack(song, {
                namespace,
                visualizer,
                direction,
                startPos: { x: startX, y: startY, z: startZ },
                tempoOverride
            });

            const suggestedName = song.name || 'Untitled';

            // Try modern File System Access API first
            if ('showSaveFilePicker' in window) {
                try {
                    const options = {
                        suggestedName: `${suggestedName}_datapack.zip`,
                        types: [
                            {
                                description: 'Minecraft Datapack',
                                accept: {
                                    'application/zip': ['.zip']
                                }
                            }
                        ]
                    };

                    const handle = await (window as any).showSaveFilePicker(options);
                    const zipBlob = await datapackToZip(datapack);

                    const writable = await handle.createWritable();
                    await writable.write(zipBlob);
                    await writable.close();

                    toast.success('Datapack exported successfully!');
                    open = false;
                    return;
                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        return;
                    }
                }
            }

            // Fallback to regular download
            const zipBlob = await datapackToZip(datapack);
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${suggestedName}_datapack.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Datapack exported successfully!');
            open = false;
        } catch (error) {
            console.error('Failed to export datapack', error);
            toast.error('Failed to export datapack. Please try again.');
        }
    }

    function handleCancel() {
        open = false;
    }

    // Auto-focus the namespace input when dialog opens
    let namespaceInput: any;
    $effect(() => {
        if (open && namespaceInput) {
            setTimeout(() => namespaceInput.focus(), 100);
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Export as Datapack</Dialog.Title>
            <Dialog.Description>
                Configure datapack settings and export your song for use in Minecraft.
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="namespace" class="text-right">Namespace</Label>
                <div class="col-span-3">
                    <Input
                        bind:this={namespaceInput}
                        id="namespace"
                        bind:value={namespace}
                        placeholder="noteblock_studio"
                        onkeydown={(e) => {
                            if (e.key === 'Enter' && namespace.trim()) {
                                handleExport();
                            }
                        }}
                    />
                    <p class="mt-1 text-xs text-muted-foreground">
                        Use <code class="rounded bg-muted px-1 py-0.5"
                            >/function {namespace}:start</code
                        > to start the song
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="direction" class="text-right">Direction</Label>
                <Select.Root
                    type="single"
                    value={direction}
                    onValueChange={(v: string | undefined) => {
                        if (v) direction = v as Direction;
                    }}
                >
                    <Select.Trigger class="col-span-3">
                        {directionLabels[direction]}
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="north" label="North (-Z)" />
                        <Select.Item value="south" label="South (+Z)" />
                        <Select.Item value="east" label="East (+X)" />
                        <Select.Item value="west" label="West (-X)" />
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label class="text-right">Start Position</Label>
                <div class="col-span-3 grid grid-cols-3 gap-2">
                    <div>
                        <Label for="start-x" class="text-xs text-muted-foreground">X</Label>
                        <Input id="start-x" type="number" bind:value={startX} />
                    </div>
                    <div>
                        <Label for="start-y" class="text-xs text-muted-foreground">Y</Label>
                        <Input id="start-y" type="number" bind:value={startY} />
                    </div>
                    <div>
                        <Label for="start-z" class="text-xs text-muted-foreground">Z</Label>
                        <Input id="start-z" type="number" bind:value={startZ} />
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="tempo-override" class="text-right">Tempo Override</Label>
                <div class="col-span-3">
                    <Input
                        id="tempo-override"
                        type="number"
                        bind:value={tempoOverride}
                        placeholder={song?.tempo.toString() || ''}
                        step="0.01"
                        min="0"
                    />
                    <p class="mt-1 text-xs text-muted-foreground">
                        Datapacks work best with 10 ticks/s and 20 ticks/s
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label class="text-right">Visualizer</Label>
                <div class="col-span-3">
                    <label class="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={visualizer}
                            onCheckedChange={(checked) => (visualizer = checked ?? true)}
                        />
                        <span class="text-sm text-muted-foreground">
                            Enable falling block visualization
                        </span>
                    </label>
                </div>
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={handleCancel}>Cancel</Button>
            <Button onclick={handleExport} disabled={!namespace.trim()}>Export</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
