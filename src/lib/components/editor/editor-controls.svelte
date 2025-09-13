<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import { LoopMode, player } from '$lib/playback.svelte';
    import {
        ChevronDown,
        ChevronLeft,
        Pause,
        Play,
        Repeat,
        SkipBack,
        Volume2
    } from '@lucide/svelte';

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
</script>

<!-- Control bar container -->
<div class="flex h-12 w-full items-center gap-3 border-b border-border px-3 py-8 sm:px-4">
    <!-- Left: Back + Project name -->
    <div class="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" class="text-primary">
            <ChevronLeft class="size-5" />
        </Button>
        <div class="flex min-w-0 items-center gap-1">
            <span class="truncate font-medium">{player.song?.name || 'Untitled'}</span>
            <ChevronDown class="size-4 text-muted-foreground" />
        </div>
    </div>

    <!-- Center: Transport + readouts -->
    <div class="mx-auto flex items-center gap-2">
        <!-- Transport group -->
        <div
            class="flex h-9 items-center gap-1.5 rounded-md bg-background/10 px-1.5 shadow-xs dark:bg-background/20"
        >
            <Button variant="ghost" size="icon" aria-label="Rewind to start" onclick={rewind}>
                <SkipBack class="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Play/Pause" onclick={togglePlay}>
                {#if player.isPlaying}
                    <Pause class="size-5" />
                {:else}
                    <Play class="size-5" />
                {/if}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Loop"
                class={loopModeButtonClass}
                onclick={cycleLoop}
            >
                <Repeat class="size-5" />
            </Button>
        </div>

        <!-- Position readout -->
        <div
            class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest tabular-nums shadow-xs select-none"
        >
            {positionBar}
            {positionBeat}
            {positionTickInBeat}
        </div>

        <!-- Tempo -->
        <div
            class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest tabular-nums shadow-xs select-none"
        >
            <div class="rounded-sm bg-background/40">
                <span class="font-mono text-sm tabular-nums">{player.tempo.toFixed(1)}</span>
                <span class="text-xs">ticks / s</span>
            </div>
        </div>

        <!-- Metronome / count-in badges -->
        <div class="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                aria-label="Metronome"
                onclick={toggleMetronome}
                class={metronomeButtonClass}
            >
                <Volume2 class="size-5" />
            </Button>
        </div>
    </div>

    <!-- Right: Placeholder actions (undo, help, more) -->
    <div class="ml-auto flex items-center gap-1.5">
        <div class="hidden text-sm text-muted-foreground/80 sm:block">Controls</div>
        <div class="size-2 rounded-full bg-muted-foreground/30"></div>
    </div>
</div>
