<script lang="ts">
    import { disableScrollHandling } from '$app/navigation';
    import Button from '$lib/components/ui/button/button.svelte';
    import {
        TooltipContent,
        TooltipProvider,
        Tooltip as TooltipRoot,
        TooltipTrigger
    } from '$lib/components/ui/tooltip';
    import { editorState } from '$lib/editor-state.svelte';
    import { LoopMode, player } from '$lib/playback.svelte';
    import { cn } from '$lib/utils';
    import type { Tooltip } from 'bits-ui';
    import type { Snippet } from 'svelte';
    import ChevronDown from '~icons/lucide/chevron-down';
    import ChevronLeft from '~icons/lucide/chevron-left';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pause from '~icons/lucide/pause';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import SkipBack from '~icons/lucide/skip-back';
    import Volume2 from '~icons/lucide/volume-2';

    interface Props {
        class?: string;
    }

    let { class: className }: Props = $props();

    const rewind = () => player.setBarBeat(0, 0);
    const togglePlay = () => (player.isPlaying ? player.pause() : player.resume());
    const cycleLoop = () => {
        switch (player.loopMode) {
            case LoopMode.Off:
                player.setLoopMode(LoopMode.Song);
                break;
            case LoopMode.Song:
                player.setLoopMode(LoopMode.Selection);
                break;
            case LoopMode.Selection:
            default:
                player.setLoopMode(LoopMode.Off);
                break;
        }
    };
    const toggleMetronome = () => player.setMetronomeEnabled(!player.metronomeEnabled);
    const toggleAutoScroll = () => editorState.setAutoScrollEnabled(!editorState.autoScrollEnabled);

    const positionBar = $derived(String(player.currentBar + 1).padStart(3, '0'));
    const positionBeat = $derived(String(player.currentBeat + 1).padStart(2, '0'));
    const positionTickInBeat = $derived(
        String((player.currentTick % player.ticksPerBeat) + 1).padStart(2, '0')
    );

    const loopModeButtonClass = $derived.by(() => {
        switch (player.loopMode) {
            case LoopMode.Selection:
                return 'bg-purple-600 text-white hover:bg-purple-600/80 dark:hover:bg-purple-600/80 hover:text-white';
            case LoopMode.Song:
                return 'bg-amber-500 text-white hover:bg-amber-500/80 dark:hover:bg-amber-500/80 hover:text-white';
            case LoopMode.Off:
            default:
                return '';
        }
    });

    const metronomeButtonClass = $derived.by(() => {
        switch (player.metronomeEnabled) {
            case true:
                return 'bg-purple-600 text-white hover:bg-purple-600/80 dark:hover:bg-purple-600/80 hover:text-white';
            case false:
            default:
                return '';
        }
    });

    const loopModeLabel = $derived.by(() => {
        switch (player.loopMode) {
            case LoopMode.Selection:
                return 'Loop: Selection';
            case LoopMode.Song:
                return 'Loop: Song';
            case LoopMode.Off:
            default:
                return 'Loop: Off';
        }
    });
    const metronomeLabel = $derived(player.metronomeEnabled ? 'Metronome: On' : 'Metronome: Off');
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

<!-- Control bar container -->
<div
    class={cn(
        'flex h-12 w-full items-center gap-3 border-b border-border bg-secondary px-3 py-8 text-secondary-foreground sm:px-4',
        className
    )}
>
    <!-- Left: Back + Project name -->
    <div class="flex flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" class="text-primary">
            <ChevronLeft class="size-5" />
        </Button>
        <div class="flex min-w-0 items-center gap-1">
            <span class="truncate font-medium">{player.song?.name || 'Untitled'}</span>
            <ChevronDown class="size-4 text-muted-foreground" />
        </div>
    </div>

    <!-- Center: Transport + readouts -->
    <div class="flex flex-1 items-center justify-center gap-2">
        <TooltipProvider>
            <!-- Transport group -->
            <div
                class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 shadow-xs dark:bg-background/20"
            >
                {#snippet rewindButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Rewind to start"
                        onclick={rewind}
                    >
                        <SkipBack class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({ label: 'Rewind to start', children: rewindButton })}

                {#snippet playPauseButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Play/Pause"
                        onclick={togglePlay}
                    >
                        {#if player.isPlaying}
                            <Pause class="size-5" />
                        {:else}
                            <Play class="size-5" />
                        {/if}
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: player.isPlaying ? 'Pause' : 'Play',
                    children: playPauseButton
                })}

                {#snippet loopButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Loop"
                        class={loopModeButtonClass}
                        onclick={cycleLoop}
                    >
                        <Repeat class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: loopModeLabel,
                    children: loopButton,
                    disableCloseOnTriggerClick: true
                })}
            </div>

            <!-- Position readout -->
            <div
                class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest tabular-nums shadow-xs select-none"
            >
                {positionBar}:{positionBeat}:{positionTickInBeat}
            </div>

            <!-- Tempo -->
            <div
                class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest whitespace-nowrap tabular-nums shadow-xs select-none"
            >
                <span class="font-mono text-sm tabular-nums">{player.tempo.toFixed(1)}</span>
                <span class="ml-1 text-xs">ticks/s</span>
            </div>

            <!-- Metronome / Auto-scroll badges -->
            <div class="flex items-center gap-2 rounded-md bg-background/20 shadow-xs">
                {#snippet metronomeButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Metronome"
                        onclick={toggleMetronome}
                        class={metronomeButtonClass}
                    >
                        <Volume2 class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: metronomeLabel,
                    children: metronomeButton,
                    disableCloseOnTriggerClick: true
                })}
            </div>
        </TooltipProvider>
    </div>

    <!-- Right: Placeholder actions (undo, help, more) -->
    <div class="flex flex-1 items-center justify-end gap-1.5">
        <div class="hidden text-sm text-muted-foreground/80 sm:block">Controls</div>
        <div class="size-2 rounded-full bg-muted-foreground/30"></div>
    </div>
</div>
