<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Sheet from '$lib/components/ui/sheet';
    import {
        TooltipContent,
        TooltipProvider,
        Tooltip as TooltipRoot,
        TooltipTrigger
    } from '$lib/components/ui/tooltip';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { pianoRollState } from '$lib/piano-roll-state.svelte';
    import { player } from '$lib/playback.svelte';
    import { INSTRUMENT_NAMES, type Instrument } from '$lib/types';
    import { cn } from '$lib/utils';
    import type { Snippet } from 'svelte';
    import MousePointer from '~icons/lucide/mouse-pointer';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pause from '~icons/lucide/pause';
    import Pencil from '~icons/lucide/pencil';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import SkipBack from '~icons/lucide/skip-back';
    import ZoomIn from '~icons/lucide/zoom-in';
    import ZoomOut from '~icons/lucide/zoom-out';

    interface Props {
        sectionData: {
            section: {
                name: string;
            };
            channel: {
                instrument: Instrument;
            };
            channelIndex: number;
        };
        sectionBeatLength: number;
    }

    let { sectionData, sectionBeatLength }: Props = $props();

    // Reactive state for solo/mute buttons
    const isChannelMuted = $derived(() => {
        if (!sectionData) return false;
        const channel = player.song?.channels?.[sectionData.channelIndex];
        return channel?.kind === 'note' ? channel.isMuted : false;
    });
    const isAnyMuted = $derived(
        player.song?.channels.some((ch) => ch.kind === 'note' && ch.isMuted) ?? false
    );

    function toggleMute() {
        if (!sectionData) return;
        player.setMute(sectionData.channelIndex);
    }

    function toggleSolo() {
        if (!sectionData) return;
        player.setSolo(sectionData.channelIndex);
    }
</script>

{#snippet tooltipped({
    label,
    children,
    disableCloseOnTriggerClick = false
}: {
    label: string;
    children: Snippet<[{ props: any }]>;
    disableCloseOnTriggerClick?: boolean;
})}
    <TooltipRoot {disableCloseOnTriggerClick}>
        <TooltipTrigger>
            {#snippet child({ props })}
                {@render children?.({ props })}
            {/snippet}
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
    </TooltipRoot>
{/snippet}

<Sheet.Header class="border-b border-border/60 px-6 pt-6 pb-4">
    <Sheet.Title class="text-lg font-semibold"
        >{sectionData?.section?.name ?? 'Unknown Section'}</Sheet.Title
    >
    <Sheet.Description class="text-sm text-muted-foreground">
        {sectionData ? INSTRUMENT_NAMES[sectionData.channel.instrument] : 'Unknown'} • Channel {sectionData
            ? sectionData.channelIndex + 1
            : '?'} •
        {sectionBeatLength} beats
    </Sheet.Description>
</Sheet.Header>

<div
    class="flex h-12 items-center gap-3 border-b border-border bg-secondary/80 px-4 text-secondary-foreground"
>
    <TooltipProvider>
        <div class="flex flex-1 items-center gap-2">
            <div
                class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 shadow-xs dark:bg-background/20"
            >
                {#snippet rewindButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Rewind to start"
                        onclick={pianoRollState.rewind}
                    >
                        <SkipBack class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: 'Rewind to start',
                    children: rewindButton
                })}

                {#snippet playPauseButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Play/Pause"
                        onclick={pianoRollState.togglePlay}
                    >
                        {#if pianoRollState.isPlaying}
                            <Pause class="size-5" />
                        {:else}
                            <Play class="size-5" />
                        {/if}
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: pianoRollState.isPlaying ? 'Pause' : 'Play',
                    children: playPauseButton
                })}

                {#snippet loopButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Loop"
                        class={pianoRollState.loopModeButtonClass}
                        onclick={pianoRollState.cycleLoop}
                    >
                        <Repeat class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: pianoRollState.loopModeLabel,
                    children: loopButton,
                    disableCloseOnTriggerClick: true
                })}
            </div>

            <div
                class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest tabular-nums shadow-xs select-none"
            >
                {pianoRollState.positionBar}:{pianoRollState.positionBeat}:{pianoRollState.positionTickInBeat}
            </div>

            <div class="flex items-center gap-1 rounded-md bg-background/20 shadow-xs">
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => editorState.zoomOut()}
                    aria-label="Zoom out"
                >
                    <ZoomOut class="size-4" />
                </Button>
                <div class="min-w-14 text-center font-mono text-xs tabular-nums">
                    {Math.round(editorState.pxPerBeat)} px/beat
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => editorState.zoomIn()}
                    aria-label="Zoom in"
                >
                    <ZoomIn class="size-4" />
                </Button>
            </div>
        </div>

        <div
            class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 shadow-xs dark:bg-background/20"
        >
            {#if sectionData}
                {#snippet muteButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Mute"
                        onclick={toggleMute}
                        class={cn(
                            'h-8 w-8 p-0 text-xs font-bold',
                            isChannelMuted()
                                ? 'bg-red-600 text-white hover:bg-red-600 dark:bg-red-600 dark:text-white hover:dark:bg-red-600'
                                : ''
                        )}
                    >
                        M
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: isChannelMuted() ? 'Unmute' : 'Mute',
                    children: muteButton,
                    disableCloseOnTriggerClick: true
                })}

                {#snippet soloButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Solo"
                        onclick={toggleSolo}
                        class={cn(
                            'h-8 w-8 p-0 text-xs font-bold',
                            isAnyMuted && sectionData && !isChannelMuted()
                                ? 'bg-yellow-600 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:text-white hover:dark:bg-yellow-600'
                                : ''
                        )}
                    >
                        S
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: isAnyMuted && sectionData && !isChannelMuted() ? 'Unsolo' : 'Solo',
                    children: soloButton,
                    disableCloseOnTriggerClick: true
                })}
            {/if}
        </div>

        <div
            class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 shadow-xs dark:bg-background/20"
        >
            {#snippet normalModeButton({ props }: { props: any })}
                <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    aria-label="Normal Mode"
                    class={pianoRollState.pointerMode === PointerMode.Normal
                        ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 hover:text-white dark:hover:bg-indigo-600/80'
                        : ''}
                    onclick={() => pianoRollState.setPointerMode(PointerMode.Normal)}
                >
                    <MousePointer class="size-5" />
                </Button>
            {/snippet}
            {@render tooltipped({
                label: 'Normal Mode',
                children: normalModeButton,
                disableCloseOnTriggerClick: true
            })}

            {#snippet penModeButton({ props }: { props: any })}
                <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    aria-label="Pen Mode"
                    class={pianoRollState.pointerMode === 'pen'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 hover:text-white dark:hover:bg-indigo-600/80'
                        : ''}
                    onclick={() => pianoRollState.setPointerMode('pen')}
                >
                    <Pencil class="size-5" />
                </Button>
            {/snippet}
            {@render tooltipped({
                label: 'Pen Mode',
                children: penModeButton,
                disableCloseOnTriggerClick: true
            })}

            {#snippet autoScrollButton({ props }: { props: any })}
                <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    aria-label="Follow Playhead"
                    onclick={() => editorState.setAutoScrollEnabled(!editorState.autoScrollEnabled)}
                    class={editorState.autoScrollEnabled
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90'
                        : ''}
                >
                    <MousePointerClick class="size-5" />
                </Button>
            {/snippet}
            {@render tooltipped({
                label: editorState.autoScrollEnabled
                    ? 'Follow Playhead: On'
                    : 'Follow Playhead: Off',
                children: autoScrollButton,
                disableCloseOnTriggerClick: true
            })}
        </div>
    </TooltipProvider>
</div>
