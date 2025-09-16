<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import Input from '$lib/components/ui/input/input.svelte';
    import Label from '$lib/components/ui/label/label.svelte';
    import InstrumentSelector from '$lib/components/editor/note-channel/instrument-selector.svelte';
    import { Instrument, INSTRUMENT_NAMES, INSTRUMENT_ICONS } from '$lib/types';

    interface Props {
        open?: boolean;
        onCreate?: (channels: Array<{ name: string; instrument: Instrument }>) => void;
        onCancel?: () => void;
    }

    let { open = $bindable(false), onCreate, onCancel }: Props = $props();

    let channelName = $state('');
    let selectedInstrument = $state<Instrument>(Instrument.Piano);
    let channelAmount = $state(1);

    function handleCreate() {
        if (!channelName.trim()) {
            return;
        }

        const channels: Array<{ name: string; instrument: Instrument }> = [];
        const amount = Math.max(1, channelAmount);

        for (let i = 0; i < amount; i++) {
            channels.push({
                name: amount > 1 ? `${channelName.trim()} ${i + 1}` : channelName.trim(),
                instrument: selectedInstrument
            });
        }

        open = false;
        onCreate?.(channels);

        // Reset form
        channelName = '';
        selectedInstrument = Instrument.Piano;
        channelAmount = 1;
    }

    function handleCancel() {
        open = false;
        onCancel?.();

        // Reset form
        channelName = '';
        selectedInstrument = Instrument.Piano;
        channelAmount = 1;
    }

    function handleInstrumentSelect(instrument: Instrument) {
        selectedInstrument = instrument;
    }

    // Auto-focus the name input when dialog opens
    let nameInput: any;
    $effect(() => {
        if (open && nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Create New Channel</Dialog.Title>
            <Dialog.Description>
                Create one or more new note channels with the specified instrument and settings.
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="channel-name" class="text-right">Name</Label>
                <Input
                    bind:this={nameInput}
                    id="channel-name"
                    bind:value={channelName}
                    placeholder="Enter channel name"
                    class="col-span-3"
                    onkeydown={(e) => {
                        if (e.key === 'Enter' && channelName.trim()) {
                            handleCreate();
                        }
                    }}
                />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label class="text-right">Instrument</Label>
                <div class="col-span-3">
                    <InstrumentSelector
                        {selectedInstrument}
                        onSelect={handleInstrumentSelect}
                        triggerClass="w-full justify-start gap-2 h-10"
                        align="start"
                    >
                        <img
                            src={INSTRUMENT_ICONS[selectedInstrument]}
                            alt={INSTRUMENT_NAMES[selectedInstrument]}
                            class="h-6 w-6 rounded-sm object-contain"
                        />
                        <span class="text-sm">{INSTRUMENT_NAMES[selectedInstrument]}</span>
                    </InstrumentSelector>
                </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <Label for="channel-amount" class="text-right">Amount</Label>
                <Input
                    id="channel-amount"
                    type="number"
                    bind:value={channelAmount}
                    min="1"
                    max="20"
                    class="col-span-3"
                />
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={handleCancel}>Cancel</Button>
            <Button onclick={handleCreate} disabled={!channelName.trim()}>
                Create {channelAmount > 1 ? `${channelAmount} Channels` : 'Channel'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
