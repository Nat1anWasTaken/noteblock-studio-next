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
    import MousePointer from '~icons/lucide/mouse-pointer';
    import MousePointerClick from '~icons/lucide/mouse-pointer-click';
    import Pencil from '~icons/lucide/pencil';
    import Pause from '~icons/lucide/pause';
    import Play from '~icons/lucide/play';
    import Repeat from '~icons/lucide/repeat';
    import SkipBack from '~icons/lucide/skip-back';

    type PianoRollContext = {
        channel: NoteChannel;
        section: NoteSection;
        channelIndex: number;
        sectionIndex: number;
    };

    type KeyRange = { min: number; max: number };

    type PianoRollPointerMode = PointerMode.Normal | 'pen';

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
    let gridContent = $state<HTMLDivElement | null>(null);

    let selectedNotes = $state<Note[]>([]);

    let selectionBox = $state<{
        startTick: number;
        startKey: number;
        currentTick: number;
        currentKey: number;
    } | null>(null);

    type DragContext = {
        notes: Note[];
        original: Map<Note, { tick: number; key: number; duration: number }>;
        minTick: number;
        maxTickEnd: number;
        minKey: number;
        maxKey: number;
        startTick: number;
        startKey: number;
        pointerId: number;
        moved: boolean;
    };
    let dragContext: DragContext | null = null;

    type PenContext = { note: Note; pointerId: number; startTick: number } | null;
    let penContext: PenContext = null;

    let selectionContext: { pointerId: number; startTick: number; startKey: number } | null = null;


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

    const MIN_NOTE_DURATION = 1;
    const DEFAULT_NOTE_VELOCITY = 100;
    const DEFAULT_NOTE_PITCH = 0;

    function normalizeDurationValue(value: number | undefined): number {
        if (!Number.isFinite(value)) return MIN_NOTE_DURATION;
        return Math.max(MIN_NOTE_DURATION, Math.round((value ?? MIN_NOTE_DURATION) as number));
    }

    function ensureNoteDuration(note: Note) {
        const normalized = normalizeDurationValue(note.duration);
        if (note.duration !== normalized) {
            note.duration = normalized;
        }
    }

    function getNoteDuration(note: Note): number {
        return normalizeDurationValue(note.duration);
    }

    function getSection(): NoteSection | null {
        return sectionData?.section ?? null;
    }

    function clampTickToSection(tick: number, duration: number): number {
        const section = getSection();
        if (!section) return Math.max(0, Math.round(tick));
        const maxTick = Math.max(0, section.length - duration);
        return Math.min(Math.max(0, Math.round(tick)), maxTick);
    }

    function sortSectionNotes(section: NoteSection) {
        section.notes.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            if (a.key !== b.key) return a.key - b.key;
            return getNoteDuration(a) - getNoteDuration(b);
        });
    }

    function tickFromPointer(event: PointerEvent): number {
        const content = gridContent;
        const pxTickValue = pxPerTick > 0 ? pxPerTick : 1;
        if (!content) return 0;
        const rect = content.getBoundingClientRect();
        const x = event.clientX - rect.left;
        return Math.max(0, Math.round(x / pxTickValue));
    }

    function keyFromPointer(event: PointerEvent): number {
        const content = gridContent;
        if (!content) return keyRange.max;
        const rect = content.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;
        const rawRow = Math.floor(relativeY / keyHeight);
        const clampedRow = Math.min(Math.max(rawRow, 0), Math.max(0, keyCount - 1));
        const key = keyRange.max - clampedRow;
        return Math.min(87, Math.max(0, key));
    }

    function findNoteAt(tick: number, key: number): Note | null {
        const section = getSection();
        if (!section) return null;
        for (const note of section.notes) {
            if (note.key !== key) continue;
            const start = note.tick;
            const end = start + getNoteDuration(note);
            if (tick >= start && tick < end) return note;
        }
        return null;
    }

    function selectNotes(notes: Note[]) {
        const seen = new Set<Note>();
        const filtered: Note[] = [];
        for (const note of notes) {
            if (!note || seen.has(note)) continue;
            seen.add(note);
            filtered.push(note);
        }
        selectedNotes = filtered;
    }

    function clearSelection() {
        if (selectedNotes.length) {
            selectedNotes = [];
        }
    }

    function isEditableTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        return (
            target.isContentEditable ||
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT'
        );
    }

    function refreshPlayer() {
        player.refreshIndexes();
    }

    function handleBackgroundPointerDown(event: PointerEvent) {
        if (event.button !== 0) return;
        event.preventDefault();
        const tick = clampTickToSection(tickFromPointer(event), MIN_NOTE_DURATION);
        const key = keyFromPointer(event);
        const captureTarget = gridContent;

        if (pointerMode === PointerMode.Normal) {
            selectionContext = { pointerId: event.pointerId, startTick: tick, startKey: key };
            selectionBox = {
                startTick: tick,
                startKey: key,
                currentTick: tick,
                currentKey: key
            };
            clearSelection();
        } else if (pointerMode === 'pen') {
            const section = getSection();
            if (!section) return;
            const existing = findNoteAt(tick, key);
            if (existing) {
                selectNotes([existing]);
                penContext = { note: existing, pointerId: event.pointerId, startTick: existing.tick };
            } else {
                const newNote: Note = {
                    tick,
                    key,
                    velocity: DEFAULT_NOTE_VELOCITY,
                    pitch: DEFAULT_NOTE_PITCH,
                    duration: MIN_NOTE_DURATION
                };
                section.notes.push(newNote);
                sortSectionNotes(section);
                selectNotes([newNote]);
                penContext = { note: newNote, pointerId: event.pointerId, startTick: tick };
                refreshPlayer();
            }
        }

        captureTarget?.setPointerCapture(event.pointerId);
    }

    function handleNotePointerDown(note: Note, event: PointerEvent) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const section = getSection();
        if (!section) return;

        if (pointerMode === PointerMode.Normal) {
            if (!selectedNotes.includes(note)) {
                selectNotes([note]);
            }

            const notes = [...selectedNotes];
            const original = new Map<Note, { tick: number; key: number; duration: number }>();
            let minTick = Number.POSITIVE_INFINITY;
            let maxTickEnd = 0;
            let minKey = Number.POSITIVE_INFINITY;
            let maxKey = Number.NEGATIVE_INFINITY;

            for (const n of notes) {
                ensureNoteDuration(n);
                original.set(n, {
                    tick: n.tick,
                    key: n.key,
                    duration: getNoteDuration(n)
                });
                if (n.tick < minTick) minTick = n.tick;
                const end = n.tick + getNoteDuration(n);
                if (end > maxTickEnd) maxTickEnd = end;
                if (n.key < minKey) minKey = n.key;
                if (n.key > maxKey) maxKey = n.key;
            }

            dragContext = {
                notes,
                original,
                minTick: Number.isFinite(minTick) ? minTick : 0,
                maxTickEnd,
                minKey: Number.isFinite(minKey) ? minKey : 0,
                maxKey: Number.isFinite(maxKey) ? maxKey : 0,
                startTick: tickFromPointer(event),
                startKey: keyFromPointer(event),
                pointerId: event.pointerId,
                moved: false
            };

            gridContent?.setPointerCapture(event.pointerId);
        } else if (pointerMode === 'pen') {
            selectNotes([note]);
            penContext = { note, pointerId: event.pointerId, startTick: note.tick };
            gridContent?.setPointerCapture(event.pointerId);
        }
    }

    function handleWindowPointerMove(event: PointerEvent) {
        const section = getSection();
        if (!section) return;

        if (dragContext && dragContext.pointerId === event.pointerId && pointerMode === PointerMode.Normal) {
            const tick = tickFromPointer(event);
            const key = keyFromPointer(event);
            let tickDelta = tick - dragContext.startTick;
            let keyDelta = key - dragContext.startKey;

            const minTickDelta = -dragContext.minTick;
            const maxTickDelta = section.length - dragContext.maxTickEnd;
            tickDelta = Math.min(Math.max(tickDelta, minTickDelta), maxTickDelta);

            const minKeyDelta = -dragContext.minKey;
            const maxKeyDelta = 87 - dragContext.maxKey;
            keyDelta = Math.min(Math.max(keyDelta, minKeyDelta), maxKeyDelta);

            for (const note of dragContext.notes) {
                const orig = dragContext.original.get(note);
                if (!orig) continue;
                note.tick = orig.tick + tickDelta;
                note.key = orig.key + keyDelta;
            }

            dragContext.moved ||= tickDelta !== 0 || keyDelta !== 0;
        }

        if (selectionContext && selectionContext.pointerId === event.pointerId && pointerMode === PointerMode.Normal) {
            const tick = tickFromPointer(event);
            const key = keyFromPointer(event);
            selectionBox = {
                startTick: selectionContext.startTick,
                startKey: selectionContext.startKey,
                currentTick: tick,
                currentKey: key
            };

            const minTick = Math.min(selectionContext.startTick, tick);
            const maxTick = Math.max(selectionContext.startTick, tick + 1);
            const minKey = Math.min(selectionContext.startKey, key);
            const maxKey = Math.max(selectionContext.startKey, key);

            const notes: Note[] = [];
            for (const n of section.notes) {
                const start = n.tick;
                const end = start + getNoteDuration(n);
                const overlapsTick = end > minTick && start < maxTick;
                const withinKey = n.key >= minKey && n.key <= maxKey;
                if (overlapsTick && withinKey) notes.push(n);
            }
            selectNotes(notes);
        }

        if (penContext && penContext.pointerId === event.pointerId && pointerMode === 'pen') {
            const note = penContext.note;
            ensureNoteDuration(note);
            const tick = clampTickToSection(tickFromPointer(event), MIN_NOTE_DURATION);
            const newDuration = Math.max(MIN_NOTE_DURATION, tick - note.tick + 1);
            const maxDuration = Math.max(MIN_NOTE_DURATION, section.length - note.tick);
            note.duration = Math.min(newDuration, maxDuration);
        }
    }

    function handleWindowPointerUp(event: PointerEvent) {
        const section = getSection();
        if (dragContext && dragContext.pointerId === event.pointerId) {
            if (dragContext.moved && section) {
                sortSectionNotes(section);
                refreshPlayer();
            }
            dragContext = null;
        }

        if (selectionContext && selectionContext.pointerId === event.pointerId) {
            const box = selectionBox;
            if (
                box &&
                box.startTick === box.currentTick &&
                box.startKey === box.currentKey &&
                pointerMode === PointerMode.Normal
            ) {
                clearSelection();
            }
            selectionContext = null;
            selectionBox = null;
        }

        if (penContext && penContext.pointerId === event.pointerId) {
            if (section) {
                sortSectionNotes(section);
                refreshPlayer();
            }
            penContext = null;
        }

        if (gridContent) {
            try {
                if (gridContent.hasPointerCapture(event.pointerId)) {
                    gridContent.releasePointerCapture(event.pointerId);
                }
            } catch {
                /* ignore */
            }
        }
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
        if (!sheetOpen) return;
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        if (isEditableTarget(event.target)) return;

        const section = getSection();
        if (!section) return;
        const notes = section.notes;
        if (!notes?.length || !selectedNotes.length) return;

        const toRemove = new Set(selectedNotes);
        let removed = false;
        for (let index = notes.length - 1; index >= 0; index--) {
            if (toRemove.has(notes[index]!)) {
                notes.splice(index, 1);
                removed = true;
            }
        }

        if (!removed) return;

        event.preventDefault();
        clearSelection();
        sortSectionNotes(section);
        refreshPlayer();
    }

    $effect(() => {
        const section = getSection();
        if (!section) {
            selectedNotes = [];
            return;
        }
        const valid = new Set(section.notes);
        const filtered: Note[] = [];
        for (const note of selectedNotes) {
            if (valid.has(note)) filtered.push(note);
        }
        if (filtered.length !== selectedNotes.length) {
            selectedNotes = filtered;
        }
    });

    $effect(() => {
        if (pointerMode !== PointerMode.Normal) {
            selectionBox = null;
            selectionContext = null;
            dragContext = null;
        }
        if (pointerMode !== 'pen') {
            penContext = null;
        }
    });

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
        Array<{
            id: string;
            left: number;
            top: number;
            width: number;
            height: number;
            note: Note;
            selected: boolean;
        }>
    >(() => {
        const section = sectionData?.section;
        if (!section)
            return [] as Array<{
                id: string;
                left: number;
                top: number;
                width: number;
                height: number;
                note: Note;
                selected: boolean;
            }>;

        const range = keyRange;
        const pxTickValue = pxPerTick > 0 ? pxPerTick : 1;
        const laneHeight = noteLaneHeight;
        const offset = (keyHeight - laneHeight) / 2;
        const selectedSet = new Set(selectedNotes);

        return (section.notes ?? []).map((note, index) => {
            const duration = getNoteDuration(note);
            const top = (range.max - note.key) * keyHeight + offset;
            const width = Math.max(8, Math.round(duration * pxTickValue));
            const left = Math.max(0, Math.round(note.tick * pxTickValue));
            const id = `${section.startingTick + note.tick}:${note.key}:${index}`;
            return {
                id,
                left,
                top,
                width,
                height: laneHeight,
                note,
                selected: selectedSet.has(note)
            };
        });
    });

    const sectionBeatLength = $derived.by(() => {
        const section = sectionData?.section;
        if (!section) return 0;
        return +(section.length / ticksPerBeat).toFixed(2);
    });

    const sectionStartTick = $derived(sectionData?.section?.startingTick ?? 0);
    const sectionEndTick = $derived.by(() => sectionStartTick + (sectionData?.section?.length ?? 0));
    const cursorTick = $derived(player.currentTick);
    const cursorVisible = $derived.by(() => cursorTick >= sectionStartTick && cursorTick <= sectionEndTick);

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

    let pointerMode = $state<PianoRollPointerMode>(PointerMode.Normal);

    const setPointerMode = (mode: PianoRollPointerMode) => {
        pointerMode = mode;
    };

    $effect(() => {
        if (!sheetOpen) {
            pointerMode = PointerMode.Normal;
        }
    });

    const pointerButtonClass = (mode: PianoRollPointerMode) =>
        pointerMode === mode
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

<svelte:window
    onpointermove={handleWindowPointerMove}
    onpointerup={handleWindowPointerUp}
    onpointercancel={handleWindowPointerUp}
    onkeydown={handleWindowKeyDown}
/>

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
                                    onclick={() => setPointerMode(PointerMode.Normal)}
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
                                    class={pointerButtonClass('pen')}
                                    onclick={() => setPointerMode('pen')}
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
                                bind:this={gridContent}
                                class="relative"
                                style={`width:${contentWidth}px; height:${gridHeight}px;`}
                                onpointerdown={handleBackgroundPointerDown}
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
                                        data-note-id={`${sectionStartTick + note.note.tick}:${note.note.key}:${sectionData?.channel.instrument ?? 'note'}`}
                                        class={`absolute z-30 rounded-sm border transition-all ${note.selected
                                            ? 'border-white/70 bg-primary text-primary-foreground shadow-lg'
                                            : 'border-primary/30 bg-primary/80 shadow-sm'}`}
                                        style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${note.height}px;`}
                                        onpointerdown={(event) => handleNotePointerDown(note.note, event)}
                                    >
                                    </div>
                                {/each}

                                {#if selectionBox}
                                    {@const px = pxPerTick > 0 ? pxPerTick : 1}
                                    {@const tickStart = Math.min(selectionBox.startTick, selectionBox.currentTick)}
                                    {@const tickEnd = Math.max(selectionBox.startTick, selectionBox.currentTick) + 1}
                                    {@const keyTop = Math.max(selectionBox.startKey, selectionBox.currentKey)}
                                    {@const keyBottom = Math.min(selectionBox.startKey, selectionBox.currentKey)}
                                    {@const left = Math.round(tickStart * px)}
                                    {@const right = Math.round(tickEnd * px)}
                                    {@const top = (keyRange.max - keyTop) * keyHeight}
                                    {@const bottom = (keyRange.max - keyBottom + 1) * keyHeight}
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
