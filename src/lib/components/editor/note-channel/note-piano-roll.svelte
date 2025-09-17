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
    import { LoopMode, player } from '$lib/playback.svelte';
    import { INSTRUMENT_NAMES, type Note, type NoteChannel, type NoteSection } from '$lib/types';
    import PlayheadCursor from '../playhead-cursor.svelte';
    import TimelineGrid from '../timeline-grid.svelte';
    import type { Snippet } from 'svelte';
    import GitMerge from '~icons/lucide/git-merge';
    import MousePointer from '~icons/lucide/mouse-pointer';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pause from '~icons/lucide/pause';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import Scissors from '~icons/lucide/scissors';
    import SkipBack from '~icons/lucide/skip-back';

    type PianoRollContext = {
        channel: NoteChannel;
        section: NoteSection;
        channelIndex: number;
        sectionIndex: number;
    };

    type KeyRange = { min: number; max: number };

    const pianoRollTarget = $derived(editorState.pianoRollTarget);

    let sheetOpen = $state(false);

    $effect(() => {
        sheetOpen = pianoRollTarget !== null;
    });

    $effect(() => {
        if (!sheetOpen && pianoRollTarget) {
            editorState.closePianoRoll();
        }
    });

    $effect(() => {
        if (pianoRollTarget && !sectionData) {
            editorState.closePianoRoll();
            sheetOpen = false;
        }
    });

    const sectionData = $derived.by<PianoRollContext | null>(() => {
        const target = pianoRollTarget;
        if (!target) return null;
        const channel = player.song?.channels?.[target.channelIndex];
        if (!channel || channel.kind !== 'note') return null;
        const section = channel.sections?.[target.sectionIndex];
        if (!section) return null;
        return { channel, section, channelIndex: target.channelIndex, sectionIndex: target.sectionIndex };
    });

    const ticksPerBeat = $derived(Math.max(1, editorState.ticksPerBeat));
    const beatsPerBar = $derived(Math.max(1, editorState.beatsPerBar));
    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );

    const DEFAULT_KEY_RANGE: KeyRange = { min: 33, max: 57 };

    function computeKeyRange(notes: Note[] | undefined): KeyRange {
        if (!notes || notes.length === 0) return DEFAULT_KEY_RANGE;
        let min = Math.min(...notes.map((n) => n.key));
        let max = Math.max(...notes.map((n) => n.key));
        min = Math.max(0, min - 2);
        max = Math.min(87, max + 2);
        if (max - min < 12) {
            const pad = Math.ceil((12 - (max - min)) / 2);
            min = Math.max(0, min - pad);
            max = Math.min(87, max + pad);
        }
        return { min, max };
    }

    const keyRange = $derived.by<KeyRange>(() => computeKeyRange(sectionData?.section?.notes));
    const keyHeight = 20;
    const keyCount = $derived.by(() => keyRange.max - keyRange.min + 1);
    const gridHeight = $derived(Math.max(1, keyCount) * keyHeight);

    const noteLaneHeight = Math.max(8, keyHeight - 6);

    let gridScroller = $state<HTMLDivElement | null>(null);
    let keysScroller = $state<HTMLDivElement | null>(null);
    let gridScrollLeft = $state(0);

    function handleGridScroll() {
        const grid = gridScroller;
        const keys = keysScroller;
        if (!grid) return;
        const { scrollTop, scrollLeft } = grid;
        gridScrollLeft = scrollLeft;
        if (keys && Math.abs(keys.scrollTop - scrollTop) > 1) {
            keys.scrollTop = scrollTop;
        }
    }

    function keyNumberToInfo(key: number) {
        const names = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const noteName = names[key % 12];
        const octave = Math.floor((key + 9) / 12);
        const isBlack = noteName.includes('#');
        return { label: `${noteName}${octave}`, isBlack };
    }

    const keyRows = $derived.by<Array<{ key: number; label: string; isBlack: boolean }>>(() => {
        const rows: Array<{ key: number; label: string; isBlack: boolean }> = [];
        for (let key = keyRange.max; key >= keyRange.min; key--) {
            const info = keyNumberToInfo(key);
            rows.push({ key, ...info });
        }
        return rows;
    });

    const rawGridWidth = $derived.by(() => {
        const section = sectionData?.section;
        if (!section) return 0;
        const pxTick = pxPerTick > 0 ? pxPerTick : 1;
        const lengthPx = section.length * pxTick;
        const minWidth = Math.max(640, beatsPerBar * ticksPerBeat * pxTick);
        return Math.max(minWidth, Math.ceil(lengthPx));
    });

    const barWidth = $derived(Math.max(1, editorState.barWidth));
    const totalBars = $derived.by(() => {
        if (barWidth <= 0) return 1;
        return Math.max(1, Math.ceil(rawGridWidth / barWidth));
    });
    const contentWidth = $derived(totalBars * barWidth);

    const beatMarkers = $derived.by<Array<{ left: number; index: number; isBar: boolean }>>(() => {
        const pxPerBeatValue = Math.max(1, editorState.pxPerBeat);
        const totalBeats = Math.ceil(contentWidth / pxPerBeatValue);
        const markers: Array<{ left: number; index: number; isBar: boolean }> = [];
        for (let beat = 0; beat <= totalBeats; beat++) {
            const left = beat * pxPerBeatValue;
            markers.push({ left, index: beat, isBar: beat % beatsPerBar === 0 });
        }
        return markers;
    });

    const notesToRender = $derived.by<
        Array<{ id: string; left: number; top: number; width: number; height: number }>
    >(() => {
        const section = sectionData?.section;
        if (!section) return [] as Array<{ id: string; left: number; top: number; width: number; height: number }>;
        const range = keyRange;
        const pxTick = pxPerTick > 0 ? pxPerTick : 1;
        const laneHeight = noteLaneHeight;
        const offset = (keyHeight - laneHeight) / 2;
        return (section.notes ?? []).map((note) => {
            const top = (range.max - note.key) * keyHeight + offset;
            const width = Math.max(8, Math.round(pxTick * 2));
            const left = Math.max(0, Math.round(note.tick * pxTick));
            return {
                id: `${section.startingTick + note.tick}:${note.key}`,
                left,
                top,
                width,
                height: laneHeight
            };
        });
    });

    const sectionBeatLength = $derived.by(() => {
        const section = sectionData?.section;
        if (!section) return 0;
        return +(section.length / ticksPerBeat).toFixed(2);
    });

    const sectionStartTick = $derived(sectionData?.section?.startingTick ?? 0);
    const sectionEndTick = $derived(() => sectionStartTick + (sectionData?.section?.length ?? 0));
    const cursorTick = $derived(player.currentTick);
    const cursorVisible = $derived(() => cursorTick >= sectionStartTick && cursorTick <= sectionEndTick);

    $effect(() => {
        gridScrollLeft = gridScroller?.scrollLeft ?? 0;
    });

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

    const pointerButtonClass = (mode: PointerMode) =>
        editorState.pointerMode === mode
            ? 'bg-indigo-600 text-white hover:bg-indigo-600/80 dark:hover:bg-indigo-600/80 hover:text-white'
            : '';
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

<Sheet.Root bind:open={sheetOpen}>
    <Sheet.Content
        side="bottom"
        class="h-[70vh] w-full max-w-none border-t border-border bg-background"
    >
        {#if sectionData}
            <div class="flex h-full flex-col">
                <Sheet.Header class="border-b border-border/60 px-6 pb-4 pt-6">
                    <Sheet.Title class="text-lg font-semibold">{sectionData.section.name}</Sheet.Title>
                    <Sheet.Description class="text-sm text-muted-foreground">
                        {INSTRUMENT_NAMES[sectionData.channel.instrument]} • Channel {sectionData.channelIndex + 1} •
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

                            <div
                                class="flex h-9 items-center rounded-md bg-background/20 px-3 font-mono text-sm tracking-widest tabular-nums shadow-xs select-none"
                            >
                                {positionBar}:{positionBeat}:{positionTickInBeat}
                            </div>
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

                            {#snippet autoScrollButton({ props }: { props: any })}
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Follow Playhead"
                                    onclick={() => editorState.setAutoScrollEnabled(!editorState.autoScrollEnabled)}
                                    class={editorState.autoScrollEnabled
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 dark:hover:bg-primary/90 hover:text-primary-foreground'
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

                <div class="flex flex-1 overflow-hidden">
                    <div class="flex w-24 flex-col border-r border-border/50 bg-muted/40">
                        <div class="flex h-10 items-center border-b border-border/40 px-3 text-xs uppercase tracking-wide text-muted-foreground">
                            Keys
                        </div>
                        <div
                            class="scrollbar-fade flex-1 overflow-auto"
                            bind:this={keysScroller}
                            onwheel={(event) => {
                                const grid = gridScroller;
                                if (!grid) return;
                                grid.scrollBy({ left: event.deltaX, top: event.deltaY });
                                event.preventDefault();
                            }}
                        >
                            <div class="flex flex-col" style={`height:${gridHeight}px;`}>
                                {#each keyRows as row, index}
                                    <div
                                        class={`flex items-center justify-end pr-3 text-xs ${row.isBlack ? 'bg-muted/70 text-muted-foreground' : 'bg-background'} ${index === keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                        style={`height:${keyHeight}px;`}
                                    >
                                        {row.label}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <div class="relative flex-1 overflow-hidden bg-muted/20">
                        <div class="relative h-full w-full overflow-auto" bind:this={gridScroller} onscroll={handleGridScroll}>
                            <div class="sticky top-0 z-20 flex h-10 items-center border-b border-border/40 bg-background/95 px-4 text-xs font-medium text-muted-foreground backdrop-blur">
                                <div class="relative h-full w-full" style={`min-width:${contentWidth}px;`}>
                                    {#each beatMarkers as marker}
                                        <div
                                            class={`${marker.isBar ? 'font-semibold text-foreground' : 'text-muted-foreground'} absolute top-1/2 -translate-y-1/2`}
                                            style={`left:${marker.left}px;`}
                                        >
                                            {#if marker.isBar}
                                                Bar {Math.floor(marker.index / beatsPerBar) + 1}
                                            {:else}
                                                {marker.index + 1}
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                            <div
                                class="relative"
                                style={`width:${contentWidth}px; height:${gridHeight}px;`}
                            >
                                <TimelineGrid
                                    gutterWidth={0}
                                    class="z-10"
                                    contentWidth={contentWidth}
                                    scrollLeft={0}
                                    barWidth={barWidth}
                                    totalBars={totalBars}
                                    beatsPerBar={beatsPerBar}
                                    pxPerBeat={editorState.pxPerBeat}
                                />

                                {#each keyRows as row, index}
                                    <div
                                        class={`${row.isBlack ? 'bg-muted/60' : 'bg-background'} absolute left-0 right-0 ${index === keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                        style={`top:${index * keyHeight}px; height:${keyHeight}px;`}
                                    ></div>
                                {/each}

                                {#each notesToRender as note}
                                    <div
                                        class="absolute z-30 rounded-sm bg-primary/80 shadow-sm"
                                        style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${note.height}px;`}
                                    ></div>
                                {/each}
                            </div>
                        </div>
                        <PlayheadCursor
                            gutterWidth={0}
                            class="z-40"
                            scrollLeft={gridScrollLeft}
                            pxPerTick={pxPerTick > 0 ? pxPerTick : 1}
                            currentTick={cursorTick}
                            tickOffset={sectionStartTick}
                            visible={cursorVisible}
                        />
                    </div>
                </div>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>

<style>
    .scrollbar-fade::-webkit-scrollbar {
        width: 6px;
    }

    .scrollbar-fade::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollbar-fade::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.35);
        border-radius: 9999px;
    }

    .scrollbar-fade {
        scrollbar-width: thin;
    }
</style>
