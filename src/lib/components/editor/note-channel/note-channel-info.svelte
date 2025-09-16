<script lang="ts">
    import ChannelInfoContextMenu from '$lib/components/editor/channel-info-context-menu.svelte';
    import InstrumentSelector from '$lib/components/editor/note-channel/instrument-selector.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import Input from '$lib/components/ui/input/input.svelte';
    import { player } from '$lib/playback.svelte';
    import type { NoteChannel } from '$lib/types';
    import { Instrument, INSTRUMENT_ICONS } from '$lib/types';
    import { cn } from '$lib/utils';
    import { tick } from 'svelte';
    import { toast } from 'svelte-sonner';
    import ChannelDeletionDialog from '../channel-deletion-dialog.svelte';

    interface Props {
        channel: NoteChannel;
        index: number;
        height: number;
    }

    let { channel, index = 0, height = 72 }: Props = $props();

    const isAnyMuted = $derived(
        player.song?.channels.some((ch) => ch.kind === 'note' && ch.isMuted) ?? false
    );

    // Make the component reactive to changes in channel.isMuted
    const isChannelMuted = $derived(channel.isMuted);

    function toggleMute() {
        player.setMute(index);
    }

    function toggleSolo() {
        player.setSolo(index);
    }

    function selectInstrument(instrument: Instrument) {
        player.updateNoteChannel(index, { instrument });
    }

    let instrumentSelectorOpen = $state(false);
    let editingName = $state(false);
    let inputElement = $state<HTMLInputElement | null>(null);
    const icon = $derived(INSTRUMENT_ICONS[channel.instrument]);

    async function startEditing() {
        console.log('start editing');
        editingName = true;
        await tick();
        inputElement?.focus();
        inputElement?.select();
    }

    function saveNameChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const newName = target.value.trim();
        if (newName && newName !== channel.name) {
            player.updateNoteChannel(index, { name: newName });
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

    let deletionDialogOpen = $state(false);

    function handleDeleteChannel() {
        player.removeChannel(index);
        toast.info(`${channel.name} deleted`);
    }
</script>

<ChannelDeletionDialog
    channelName={channel.name}
    bind:open={deletionDialogOpen}
    onDelete={handleDeleteChannel}
    onCancel={() => {}}
/>

<ChannelInfoContextMenu
    onRename={startEditing}
    onChangeInstrument={() => (instrumentSelectorOpen = true)}
    onDelete={() => (deletionDialogOpen = true)}
>
    <div
        class="flex w-full items-stretch border-b border-border text-sm"
        style={`min-height:${height}px; max-height:${height}px`}
    >
        <div class="flex w-10 flex-col items-center justify-center gap-1 border-r border-border/70">
            <div class="text-muted-foreground">{index + 1}</div>
            <div class="size-1.5 rounded-full bg-muted-foreground/40"></div>
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between px-3 py-2">
            {#if editingName}
                <Input
                    bind:ref={inputElement}
                    value={channel.name}
                    class="h-auto border-none bg-transparent p-0 text-base/5 font-medium shadow-none focus-visible:ring-0"
                    onkeydown={handleKeydown}
                    onblur={cancelNameChange}
                />
            {:else}
                <div
                    class="w-full cursor-text truncate text-base/5 font-medium"
                    ondblclick={startEditing}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && startEditing()}
                >
                    {channel.name}
                </div>
            {/if}
            <div class="flex flex-row gap-2">
                <div class="flex flex-col">
                    <Button
                        size="sm"
                        onclick={toggleMute}
                        variant="outline"
                        class={cn(
                            'h-8 w-8 p-0 text-xs font-bold',
                            isChannelMuted
                                ? 'bg-red-600 text-white hover:bg-red-600 dark:bg-red-600 dark:text-white hover:dark:bg-red-600'
                                : ''
                        )}
                    >
                        M
                    </Button>
                    <Button
                        size="sm"
                        onclick={toggleSolo}
                        variant="outline"
                        class={cn(
                            'h-8 w-8 p-0 text-xs font-bold',
                            isAnyMuted && !isChannelMuted
                                ? 'bg-yellow-600 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:text-white hover:dark:bg-yellow-600'
                                : ''
                        )}
                    >
                        S
                    </Button>
                </div>

                <InstrumentSelector
                    selectedInstrument={channel.instrument}
                    onSelect={selectInstrument}
                    bind:open={instrumentSelectorOpen}
                    triggerClass="w-12"
                >
                    {#if icon}
                        <img
                            src={icon}
                            alt="instrument"
                            class="h-10 w-10 rounded-sm object-contain"
                        />
                    {/if}
                </InstrumentSelector>
            </div>
        </div>
    </div>
</ChannelInfoContextMenu>
