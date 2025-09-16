<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import InstrumentSelector from '$lib/components/editor/note-channel/instrument-selector.svelte';
    import { player } from '$lib/playback.svelte';
    import type { NoteChannel } from '$lib/types';
    import { Instrument, INSTRUMENT_ICONS } from '$lib/types';
    import { cn } from '$lib/utils';

    interface Props {
        channel: NoteChannel;
        index?: number;
        height?: number;
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
    const icon = $derived(INSTRUMENT_ICONS[channel.instrument]);
</script>

<div
    class="flex w-full items-stretch border-b border-border text-sm"
    style={`min-height:${height}px; max-height:${height}px`}
>
    <div class="flex w-10 flex-col items-center justify-center gap-1 border-r border-border/70">
        <div class="text-muted-foreground">{index + 1}</div>
        <div class="size-1.5 rounded-full bg-muted-foreground/40"></div>
    </div>
    <div class="flex min-w-0 flex-1 items-center justify-between px-3 py-2">
        <div class="truncate text-base/5 font-medium">{channel.name}</div>
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
