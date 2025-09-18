<script lang="ts">
    import { commandManager } from '$lib/command-manager';
    import Button from '$lib/components/ui/button/button.svelte';
    import { Input } from '$lib/components/ui/input';
    import {
        TooltipContent,
        TooltipProvider,
        Tooltip as TooltipRoot,
        TooltipTrigger
    } from '$lib/components/ui/tooltip';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { LoopMode, player } from '$lib/playback.svelte';
    import { cn } from '$lib/utils';
    import EditorTitle from './editor-title.svelte';

    import { onMount, type Snippet } from 'svelte';
    import ChevronLeft from '~icons/lucide/chevron-left';
    import GitMerge from '~icons/lucide/git-merge';
    import MousePointer from '~icons/lucide/mouse-pointer';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pause from '~icons/lucide/pause';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import Scissors from '~icons/lucide/scissors';
    import SkipBack from '~icons/lucide/skip-back';
    import Metronome from '~icons/tabler/metronome';

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

    let tempoInputElement = $state<HTMLInputElement | null>(null);

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
    const autoScrollButtonClass = $derived(
        editorState.autoScrollEnabled
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 dark:hover:bg-primary/90 hover:text-primary-foreground'
            : ''
    );
    const autoScrollLabel = $derived(
        editorState.autoScrollEnabled ? 'Follow Playhead: On' : 'Follow Playhead: Off'
    );

    // Use a unified selected color for all three pointer mode buttons
    const pointerButtonClass = (mode: PointerMode) =>
        editorState.pointerMode === mode
            ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 dark:hover:bg-indigo-600/80 hover:text-white'
            : '';

    onMount(() => {
        commandManager.registerCommands([
            {
                id: 'toggle-playback',
                title: 'Toggle Playback',
                callback: () => {
                    if (player.isPlaying) {
                        player.pause();
                    } else {
                        player.resume();
                    }
                },
                shortcut: 'Space'
            },
            {
                id: 'rotate-loop-mode',
                title: 'Rotate Loop Mode',
                callback: cycleLoop,
                shortcut: 'R'
            },
            {
                id: 'rewind-to-start',
                title: 'Rewind to Start',
                callback: rewind,
                shortcut: '0'
            },
            {
                id: 'change-tempo',
                title: 'Change Tempo',
                callback: () => {
                    tempoInputElement?.focus();
                },
                shortcut: 'T'
            },
            {
                id: 'editor-pointer-normal',
                title: 'Pointer: Normal',
                callback: () => editorState.setPointerMode(PointerMode.Normal),
                shortcut: 'MOD+1'
            },
            {
                id: 'editor-pointer-shears',
                title: 'Pointer: Shears',
                callback: () => editorState.setPointerMode(PointerMode.Shears),
                shortcut: 'MOD+2'
            },
            {
                id: 'editor-pointer-merge',
                title: 'Pointer: Merge',
                callback: () => editorState.setPointerMode(PointerMode.Merge),
                shortcut: 'MOD+3'
            },
            {
                id: 'toggle-metronome',
                title: 'Toggle Metronome',
                callback: toggleMetronome,
                shortcut: 'C'
            },
            {
                id: 'toggle-auto-scroll',
                title: 'Toggle Follow Playhead',
                callback: toggleAutoScroll,
                shortcut: 'F'
            }
        ]);

        return () => {
            commandManager.unregisterCommands([
                'toggle-playback',
                'rotate-loop-mode',
                'rewind-to-start',
                'change-tempo',
                'editor-pointer-normal',
                'editor-pointer-shears',
                'editor-pointer-merge',
                'toggle-metronome',
                'toggle-auto-scroll'
            ]);
        };
    });
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
        <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            class="text-primary"
            onclick={() => history.back()}
        >
            <ChevronLeft class="size-5" />
        </Button>
        <EditorTitle />
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
                class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest whitespace-nowrap tabular-nums shadow-xs"
            >
                <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={player.tempo}
                    oninput={(e) => player.setTempo(parseFloat(e.currentTarget.value))}
                    class="h-auto w-12  border-0 bg-background/20 p-0 text-sm tabular-nums shadow-none focus-visible:ring-0 dark:bg-background/20"
                    bind:ref={tempoInputElement}
                />
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
                        <Metronome class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: metronomeLabel,
                    children: metronomeButton,
                    disableCloseOnTriggerClick: true
                })}

                {#snippet autoScrollButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Follow Playhead"
                        onclick={toggleAutoScroll}
                        class={autoScrollButtonClass}
                    >
                        <MousePointerClick class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: autoScrollLabel,
                    children: autoScrollButton,
                    disableCloseOnTriggerClick: true
                })}
            </div>

            <!-- Pointer mode selector -->
            <div
                class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 shadow-xs dark:bg-background/20"
            >
                {#snippet normalModeButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Normal Mode"
                        class={pointerButtonClass(PointerMode.Normal)}
                        onclick={() => editorState.setPointerMode(PointerMode.Normal)}
                    >
                        <MousePointer class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: 'Normal Mode',
                    children: normalModeButton,
                    disableCloseOnTriggerClick: true
                })}

                {#snippet shearsModeButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Shears Mode"
                        class={pointerButtonClass(PointerMode.Shears)}
                        onclick={() => editorState.setPointerMode(PointerMode.Shears)}
                    >
                        <Scissors class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: 'Shears Mode',
                    children: shearsModeButton,
                    disableCloseOnTriggerClick: true
                })}

                {#snippet mergeModeButton({ props }: { props: any })}
                    <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label="Merge Mode"
                        class={pointerButtonClass(PointerMode.Merge)}
                        onclick={() => editorState.setPointerMode(PointerMode.Merge)}
                    >
                        <GitMerge class="size-5" />
                    </Button>
                {/snippet}
                {@render tooltipped({
                    label: 'Merge Mode',
                    children: mergeModeButton,
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
