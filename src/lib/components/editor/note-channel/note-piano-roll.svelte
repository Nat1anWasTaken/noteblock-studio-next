<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Sheet from '$lib/components/ui/sheet';
    import {
        TooltipContent,
        TooltipProvider,
        Tooltip as TooltipRoot,
        TooltipTrigger
    } from '$lib/components/ui/tooltip';
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import { editorState, PointerMode } from '$lib/editor-state.svelte';
    import { pianoRollMouse } from '$lib/piano-roll-mouse.svelte';
    import { pianoRollState } from '$lib/piano-roll-state.svelte';
    import { INSTRUMENT_NAMES } from '$lib/types';
    import type { Snippet } from 'svelte';
    import MousePointer from '~icons/lucide/mouse-pointer';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pause from '~icons/lucide/pause';
    import Pencil from '~icons/lucide/pencil';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import SkipBack from '~icons/lucide/skip-back';
    import PlayheadCursor from '../playhead-cursor.svelte';
    import RulerShell from '../ruler-shell.svelte';
    import TimelineGrid from '../timeline-grid.svelte';
    import PianoRollMouseWindowEvents from './piano-roll-mouse-window-events.svelte';
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

{#snippet pianoRollRulerGutter()}
    <span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Keys</span>
{/snippet}

<PianoRollMouseWindowEvents />

<Sheet.Root bind:open={pianoRollState.sheetOpen}>
    <Sheet.Content
        side="bottom"
        class="h-[70vh] w-full max-w-none border-t border-border bg-background"
    >
        {#if pianoRollState.sectionData}
            <div class="flex h-full flex-col">
                <Sheet.Header class="border-b border-border/60 px-6 pt-6 pb-4">
                    <Sheet.Title class="text-lg font-semibold"
                        >{pianoRollState.sectionData.section.name}</Sheet.Title
                    >
                    <Sheet.Description class="text-sm text-muted-foreground">
                        {INSTRUMENT_NAMES[pianoRollState.sectionData.channel.instrument]} • Channel {pianoRollState
                            .sectionData.channelIndex + 1} •
                        {pianoRollState.sectionBeatLength} beats
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
                                    class={pianoRollState.pointerButtonClass(PointerMode.Normal)}
                                    onclick={() =>
                                        pianoRollState.setPointerMode(PointerMode.Normal)}
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
                                    class={pianoRollState.pointerButtonClass('pen')}
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
                                    onclick={() =>
                                        editorState.setAutoScrollEnabled(
                                            !editorState.autoScrollEnabled
                                        )}
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

                <div class="flex flex-1 flex-col overflow-hidden">
                    <RulerShell
                        class="items-center border-b border-border bg-secondary/40 text-sm"
                        gutterWidth={96}
                        contentWidth={pianoRollState.contentWidth}
                        scrollLeft={pianoRollState.gridScrollLeft}
                        pointerDownHandler={(container, event) =>
                            editorMouse.handleRulerPointerDown(container, event)}
                        gutter={pianoRollRulerGutter}
                        on:scrollLeftChange={(event) =>
                            pianoRollState.handleRulerScrollLeft(event.detail)}
                    >
                        <TimelineGrid
                            class="z-0"
                            gutterWidth={0}
                            contentWidth={pianoRollState.contentWidth}
                            scrollLeft={0}
                            barWidth={pianoRollState.barWidth}
                            totalBars={pianoRollState.totalBars}
                            beatsPerBar={pianoRollState.beatsPerBar}
                            pxPerBeat={editorState.pxPerBeat}
                            showLabels
                        />
                    </RulerShell>

                    <div class="flex flex-1 overflow-hidden">
                        <div class="flex w-24 flex-col border-r border-border/50 bg-muted/40">
                            <div
                                class="scrollbar-fade flex-1 overflow-auto"
                                bind:this={pianoRollState.keysScroller}
                                onwheel={(event) => {
                                    const grid = pianoRollState.gridScroller;
                                    if (!grid) return;
                                    grid.scrollBy({ left: event.deltaX, top: event.deltaY });
                                    event.preventDefault();
                                }}
                            >
                                <div
                                    class="flex flex-col"
                                    style={`height:${pianoRollState.gridHeight}px;`}
                                >
                                    {#each pianoRollState.keyRows as row, index}
                                        <div
                                            class={`flex items-center justify-end pr-3 text-xs ${row.isBlack ? 'bg-muted/70 text-muted-foreground' : 'bg-background'} ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                            style={`height:${pianoRollState.keyHeight}px;`}
                                        >
                                            {row.label}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        </div>

                        <div class="relative flex-1 overflow-hidden bg-muted/20">
                            <div
                                class="relative h-full w-full overflow-auto"
                                bind:this={pianoRollState.gridScroller}
                                onscroll={pianoRollState.handleGridScroll}
                            >
                                <div
                                    bind:this={pianoRollState.gridContent}
                                    class="relative"
                                    style={`width:${pianoRollState.contentWidth}px; height:${pianoRollState.gridHeight}px;`}
                                    onpointerdown={pianoRollMouse.handleBackgroundPointerDown}
                                >
                                    <TimelineGrid
                                        gutterWidth={0}
                                        class="z-10"
                                        contentWidth={pianoRollState.contentWidth}
                                        scrollLeft={0}
                                        barWidth={pianoRollState.barWidth}
                                        totalBars={pianoRollState.totalBars}
                                        beatsPerBar={pianoRollState.beatsPerBar}
                                        pxPerBeat={editorState.pxPerBeat}
                                    />

                                    {#each pianoRollState.keyRows as row, index}
                                        <div
                                            class={`${row.isBlack ? 'bg-muted/60' : 'bg-background'} absolute right-0 left-0 ${index === pianoRollState.keyRows.length - 1 ? '' : 'border-b border-border/30'}`}
                                            style={`top:${index * pianoRollState.keyHeight}px; height:${pianoRollState.keyHeight}px;`}
                                        ></div>
                                    {/each}

                                    {#each pianoRollState.notesToRender as note}
                                        <div
                                            data-note-id={`${pianoRollState.sectionStartTick + note.note.tick}:${note.note.key}:${pianoRollState.sectionData?.channel.instrument ?? 'note'}`}
                                            class={`absolute z-30 rounded-sm border ${
                                                note.selected
                                                    ? 'border-white/70 bg-primary text-primary-foreground shadow-lg'
                                                    : 'border-primary/30 bg-primary/80 shadow-sm'
                                            }`}
                                            style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${note.height}px;`}
                                            onpointerdown={(event) =>
                                                pianoRollMouse.handleNotePointerDown(
                                                    note.note,
                                                    event
                                                )}
                                        ></div>
                                    {/each}

                                    {#if pianoRollMouse.selectionBox}
                                        {@const box = pianoRollMouse.selectionBox}
                                        {@const px =
                                            pianoRollState.pxPerTick > 0
                                                ? pianoRollState.pxPerTick
                                                : 1}
                                        {@const tickStart = Math.min(
                                            box.startTick,
                                            box.currentTick
                                        )}
                                        {@const tickEnd =
                                            Math.max(box.startTick, box.currentTick) + 1}
                                        {@const keyTop = Math.max(box.startKey, box.currentKey)}
                                        {@const keyBottom = Math.min(box.startKey, box.currentKey)}
                                        {@const left = Math.round(tickStart * px)}
                                        {@const right = Math.round(tickEnd * px)}
                                        {@const top =
                                            (pianoRollState.keyRange.max - keyTop) *
                                            pianoRollState.keyHeight}
                                        {@const bottom =
                                            (pianoRollState.keyRange.max - keyBottom + 1) *
                                            pianoRollState.keyHeight}
                                        <div
                                            class="pointer-events-none absolute z-20 border-2 border-indigo-400/70 bg-indigo-500/10"
                                            style={`left:${Math.min(left, right)}px; top:${Math.min(top, bottom)}px; width:${Math.max(1, Math.abs(right - left))}px; height:${Math.max(1, Math.abs(bottom - top))}px;`}
                                        ></div>
                                    {/if}
                                </div>
                            </div>
                            <PlayheadCursor
                                gutterWidth={0}
                                class="z-40"
                                scrollLeft={pianoRollState.gridScrollLeft}
                                pxPerTick={pianoRollState.pxPerTick > 0
                                    ? pianoRollState.pxPerTick
                                    : 1}
                                currentTick={pianoRollState.cursorTick}
                                tickOffset={pianoRollState.sectionStartTick}
                                visible={pianoRollState.cursorVisible}
                            />
                        </div>
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
