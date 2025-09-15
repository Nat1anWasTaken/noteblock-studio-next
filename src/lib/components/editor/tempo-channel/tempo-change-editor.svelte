<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';
    import Input from '$lib/components/ui/input/input.svelte';
    import { Label } from '$lib/components/ui/label';
    import type { TempoChange } from '$lib/types';

    interface Props {
        open: boolean;
        change: TempoChange;
        onSave?: (updatedChange: TempoChange) => void;
        onCancel?: () => void;
    }

    let { open = $bindable(), change, onSave, onCancel }: Props = $props();

    let editedChange = $state<TempoChange>({
        tick: change.tick,
        tempo: change.tempo,
        ticksPerBeat: change.ticksPerBeat,
        beatsPerBar: change.beatsPerBar
    });

    function handleSave() {
        onSave?.(editedChange);
        open = false;
    }

    function handleCancel() {
        editedChange = {
            tick: change.tick,
            tempo: change.tempo,
            ticksPerBeat: change.ticksPerBeat,
            beatsPerBar: change.beatsPerBar
        };
        onCancel?.();
        open = false;
    }

    $effect(() => {
        if (open) {
            editedChange = {
                tick: change.tick,
                tempo: change.tempo,
                ticksPerBeat: change.ticksPerBeat,
                beatsPerBar: change.beatsPerBar
            };
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Edit Tempo Change</Dialog.Title>
            <Dialog.Description>
                Edit the tempo and time signature parameters for this tempo change.
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="tick" class="text-right">Tick</Label>
                <Input id="tick" type="number" bind:value={editedChange.tick} class="col-span-3" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="tempo" class="text-right">Tempo</Label>
                <Input
                    id="tempo"
                    type="number"
                    step="0.1"
                    bind:value={editedChange.tempo}
                    class="col-span-3"
                />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="ticksPerBeat" class="text-right">Ticks/Beat</Label>
                <Input
                    id="ticksPerBeat"
                    type="number"
                    bind:value={editedChange.ticksPerBeat}
                    class="col-span-3"
                />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="beatsPerBar" class="text-right">Beats/Bar</Label>
                <Input
                    id="beatsPerBar"
                    type="number"
                    bind:value={editedChange.beatsPerBar}
                    class="col-span-3"
                />
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={handleCancel}>Cancel</Button>
            <Button onclick={handleSave}>Save Changes</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
