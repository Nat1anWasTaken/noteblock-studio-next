<script lang="ts">
    import { goto } from '$app/navigation';
    import InstrumentSelector from '$lib/components/editor/note-channel/instrument-selector.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow
    } from '$lib/components/ui/table';
    import {
        createDefaultPercussionMapping,
        guessInstrumentForTrack,
        intoChannelAsInstrument,
        intoChannelWithMapping,
        type PercussionMapping
    } from '$lib/midi';
    import { player } from '$lib/playback.svelte';
    import {
        Instrument,
        INSTRUMENT_ICONS,
        INSTRUMENT_NAMES,
        NOTEBLOCK_HIGHEST_KEY_IN_MIDI,
        NOTEBLOCK_LOWEST_KEY_IN_MIDI,
        type NoteChannel,
        type Song,
        type TempoChannel
    } from '$lib/types';
    import type { MidiJSON, TrackJSON } from '@tonejs/midi';
    import * as MidiModule from '@tonejs/midi';
    import { toast } from 'svelte-sonner';
    import ArrowDownIcon from '~icons/lucide/arrow-down';
    import ArrowUpIcon from '~icons/lucide/arrow-up';

    type MidiCtor = typeof import('@tonejs/midi').Midi;
    const midiCtor =
        (MidiModule as { Midi?: MidiCtor }).Midi ??
        (MidiModule as { default?: { Midi?: MidiCtor } }).default?.Midi;
    if (!midiCtor) {
        throw new Error('Failed to load @tonejs/midi.');
    }
    const Midi = midiCtor;

    type ChannelMode = 'instrument' | 'percussion';

    interface ChannelAssignment {
        track: TrackJSON;
        channelNumber: number;
        name: string;
        instrument: Instrument;
        mode: ChannelMode;
        percussionMapping: PercussionMapping | null;
        transpose: number;
        transposeWithinRange: boolean;
    }

    interface Props {
        open?: boolean;
    }

    let { open = $bindable(false) }: Props = $props();

    let midiFileName = $state<string | null>(null);
    let assignments = $state<ChannelAssignment[]>([]);
    let midiData = $state<MidiJSON | null>(null);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);

    let fileInput: HTMLInputElement | null = null;

    const MIDI_TO_KEY_OFFSET = 21;
    const MIN_TRANSPOSE = -36;
    const MAX_TRANSPOSE = 36;
    const OCTAVE_INTERVAL = 12;

    const canImport = $derived(
        assignments.length > 0 && assignments.some((assignment) => assignment.track.notes.length)
    );

    $effect(() => {
        if (!open) {
            resetDialog();
        }
    });

    function resetDialog() {
        midiFileName = null;
        assignments = [];
        midiData = null;
        isLoading = false;
        errorMessage = null;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    function openFilePicker() {
        fileInput?.click();
    }

    async function handleFileSelection(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        isLoading = true;
        errorMessage = null;

        try {
            const buffer = await file.arrayBuffer();
            const midi = new Midi(buffer);
            const json = midi.toJSON();

            midiFileName = file.name;
            midiData = json;
            assignments = buildAssignments(json);

            if (assignments.length === 0) {
                errorMessage = 'No playable MIDI tracks were found in this file.';
            }
        } catch (error) {
            console.error('Failed to parse MIDI file', error);
            errorMessage = 'Failed to read MIDI file. Please make sure it is a valid .mid file.';
            midiFileName = null;
            midiData = null;
            assignments = [];
        } finally {
            isLoading = false;
            if (input) input.value = '';
        }
    }

    function buildAssignments(data: MidiJSON): ChannelAssignment[] {
        return data.tracks
            .map((track, index) => {
                const channelNumber = (track.channel ?? index) + 1;
                const name = (track.name || track.instrument.name || `Track ${index + 1}`).trim();
                const defaultInstrument = guessInstrumentForTrack(track);
                const isPercussion = track.channel === 9;
                const mode: ChannelMode = isPercussion ? 'percussion' : 'instrument';
                const defaultTranspose = isPercussion ? 0 : findOptimalOctaveTranspose(track);

                return {
                    track,
                    channelNumber,
                    name: name || `Channel ${channelNumber}`,
                    instrument: defaultInstrument,
                    mode,
                    percussionMapping: isPercussion ? createDefaultPercussionMapping(track) : null,
                    transpose: defaultTranspose,
                    transposeWithinRange: false
                };
            })
            .filter((assignment) => assignment.track.notes.length > 0);
    }

    function clampTranspose(value: number): number {
        if (!Number.isFinite(value)) return 0;
        const rounded = Math.round(value);
        return Math.max(MIN_TRANSPOSE, Math.min(MAX_TRANSPOSE, rounded));
    }

    function adjustTranspose(index: number, delta: number) {
        const assignment = assignments[index];
        if (!assignment) return;

        const next = clampTranspose(assignment.transpose + delta);
        if (next === assignment.transpose) return;

        assignment.transpose = next;
        assignments = [...assignments];
    }

    function setTransposeWithinRange(index: number, value: boolean) {
        const assignment = assignments[index];
        if (!assignment) return;

        assignment.transposeWithinRange = value;
        assignments = [...assignments];
    }

    function snapMidiToNoteblockRange(midiValue: number): number {
        const minMidi = NOTEBLOCK_LOWEST_KEY_IN_MIDI + MIDI_TO_KEY_OFFSET;
        const maxMidi = NOTEBLOCK_HIGHEST_KEY_IN_MIDI + MIDI_TO_KEY_OFFSET;

        if (midiValue < minMidi) {
            const steps = Math.ceil((minMidi - midiValue) / OCTAVE_INTERVAL);
            return midiValue + steps * OCTAVE_INTERVAL;
        }

        if (midiValue > maxMidi) {
            const steps = Math.ceil((midiValue - maxMidi) / OCTAVE_INTERVAL);
            return midiValue - steps * OCTAVE_INTERVAL;
        }

        return midiValue;
    }

    function computeOutOfRangeNotes(
        track: TrackJSON,
        transpose: number,
        transposeWithinRange = false
    ) {
        let below = 0;
        let above = 0;

        for (const note of track.notes) {
            let midiValue = Math.round(note.midi + transpose);
            if (transposeWithinRange) {
                midiValue = snapMidiToNoteblockRange(midiValue);
            }
            const key = midiValue - MIDI_TO_KEY_OFFSET;
            if (key < NOTEBLOCK_LOWEST_KEY_IN_MIDI) {
                below += 1;
            } else if (key > NOTEBLOCK_HIGHEST_KEY_IN_MIDI) {
                above += 1;
            }
        }

        return { below, above } as const;
    }

    function findOptimalOctaveTranspose(track: TrackJSON): number {
        if (track.notes.length === 0) return 0;

        const zeroStats = computeOutOfRangeNotes(track, 0);
        let bestTranspose = 0;
        let bestTotal = zeroStats.above + zeroStats.below;
        let bestImbalance = Math.abs(zeroStats.above - zeroStats.below);
        let bestAbsTranspose = 0;

        for (
            let candidate = MIN_TRANSPOSE;
            candidate <= MAX_TRANSPOSE;
            candidate += OCTAVE_INTERVAL
        ) {
            if (candidate === 0) continue;

            const { below, above } = computeOutOfRangeNotes(track, candidate);
            const total = below + above;
            const imbalance = Math.abs(above - below);
            const absTranspose = Math.abs(candidate);

            const isBetter =
                total < bestTotal ||
                (total === bestTotal && imbalance < bestImbalance) ||
                (total === bestTotal &&
                    imbalance === bestImbalance &&
                    absTranspose < bestAbsTranspose) ||
                (total === bestTotal &&
                    imbalance === bestImbalance &&
                    absTranspose === bestAbsTranspose &&
                    candidate > bestTranspose);

            if (!isBetter) continue;

            bestTranspose = candidate;
            bestTotal = total;
            bestImbalance = imbalance;
            bestAbsTranspose = absTranspose;
        }

        return bestTranspose;
    }

    function formatTransposeDisplay(transpose: number): string {
        const semitoneLabel = transpose > 0 ? `+${transpose}` : String(transpose);
        if (transpose === 0) return semitoneLabel;

        const octaves = transpose / OCTAVE_INTERVAL;
        const absOctaves = Math.abs(octaves);
        const isWhole = Number.isInteger(octaves);
        const rounded = Math.round(absOctaves * 100) / 100;
        if (rounded === 0) return semitoneLabel;

        let displayValue: string;
        if (isWhole) {
            displayValue = absOctaves.toString();
        } else {
            displayValue = rounded.toFixed(2).replace(/\.0+$/, '').replace(/\.$/, '');
        }

        const octaveWord = rounded === 1 ? 'octave' : 'octaves';
        const sign = octaves > 0 ? '+' : '-';
        return `${semitoneLabel} (${sign}${displayValue} ${octaveWord})`;
    }

    function setMode(index: number, mode: ChannelMode) {
        const assignment = assignments[index];
        if (!assignment) return;

        assignment.mode = mode;
        if (mode === 'percussion' && !assignment.percussionMapping) {
            assignment.percussionMapping = createDefaultPercussionMapping(assignment.track);
        }
        assignments = [...assignments];
    }

    function handleInstrumentChange(index: number, instrument: Instrument) {
        const assignment = assignments[index];
        if (!assignment) return;

        assignment.instrument = instrument;
        assignments = [...assignments];
    }

    function describeTrack(assignment: ChannelAssignment): string {
        const noteCount = assignment.track.notes.length;
        const unique = new Set(assignment.track.notes.map((note) => note.midi)).size;
        return `${noteCount.toLocaleString()} notes • ${unique.toLocaleString()} unique pitches`;
    }

    function describePercussion(mapping: PercussionMapping | null): string {
        if (!mapping) return 'No percussion notes detected.';
        const entries = Object.values(mapping);
        if (entries.length === 0) return 'No percussion notes detected.';

        const counts = new Map<Instrument, number>();
        for (const target of entries) {
            counts.set(target.instrument, (counts.get(target.instrument) ?? 0) + 1);
        }

        const summary = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([instrument, count]) => `${count}x ${INSTRUMENT_NAMES[instrument]}`)
            .join(', ');

        return `${entries.length} unique MIDI drums -> ${summary}`;
    }

    async function handleImport() {
        if (!midiData || assignments.length === 0) return;

        try {
            const ticksPerBeat = deriveTicksPerBeat();
            const tickScale = computeTickScale(midiData, ticksPerBeat);
            const noteChannels: NoteChannel[] = [];

            for (const assignment of assignments) {
                if (assignment.track.notes.length === 0) continue;

                if (assignment.mode === 'percussion' && assignment.percussionMapping) {
                    const channels = intoChannelWithMapping(
                        assignment.track,
                        assignment.percussionMapping,
                        tickScale
                    );
                    channels.forEach((channel) => {
                        channel.name = `${assignment.name} (${INSTRUMENT_NAMES[channel.instrument]})`;
                        noteChannels.push(channel);
                    });
                } else {
                    const channel = intoChannelAsInstrument(
                        assignment.track,
                        assignment.instrument,
                        tickScale,
                        assignment.transpose,
                        assignment.transposeWithinRange
                    );
                    channel.name = assignment.name;
                    noteChannels.push(channel);
                }
            }

            if (noteChannels.length === 0) {
                toast.error('No note data available to import.');
                return;
            }

            const tempo = deriveTempo(midiData, ticksPerBeat);
            const beatsPerBar = deriveBeatsPerBar(midiData);

            const tempoChannel: TempoChannel = {
                kind: 'tempo',
                name: 'Tempo',
                tempoChanges: [
                    {
                        tick: 0,
                        tempo,
                        ticksPerBeat,
                        beatsPerBar
                    }
                ]
            };

            const length = calculateSongLength(noteChannels);
            const songName = midiData.header.name || midiFileName || 'Imported MIDI';
            const now = new Date().toISOString();

            const song: Song = {
                length,
                tempo,
                channels: [tempoChannel, ...noteChannels],
                name: songName,
                author: '',
                description: '',
                metadata: {
                    version: '1.0.0',
                    format: 'midi-import',
                    created: now,
                    modified: now,
                    assets: []
                }
            };

            player.setSong(song);
            toast.success(`Imported "${song.name}" successfully.`);
            open = false;
            await goto('/edit');
        } catch (error) {
            console.error('Failed to import MIDI data', error);
            toast.error('Failed to import MIDI file. Please try again.');
        }
    }

    function deriveTicksPerBeat(): number {
        return 4;
    }

    function deriveTempo(data: MidiJSON, ticksPerBeat: number): number {
        const bpm = data.header.tempos?.[0]?.bpm ?? 120;
        return (ticksPerBeat * bpm) / 60;
    }

    function computeTickScale(data: MidiJSON, ticksPerBeat: number): number {
        const ppq = data.header.ppq || 480;
        if (!Number.isFinite(ppq) || ppq <= 0) return 1;
        return ticksPerBeat / ppq;
    }

    function deriveBeatsPerBar(data: MidiJSON): number {
        const signature = data.header.timeSignatures?.[0]?.timeSignature;
        const numerator = signature?.[0];
        if (Number.isFinite(numerator) && numerator > 0) {
            return Math.min(16, Math.max(1, Math.round(numerator)));
        }
        return 4;
    }

    function calculateSongLength(channels: NoteChannel[]): number {
        let maxTick = 0;
        for (const channel of channels) {
            for (const section of channel.sections) {
                const sectionStart = section.startingTick;
                for (const note of section.notes) {
                    const absoluteTick = sectionStart + note.tick + 1;
                    if (absoluteTick > maxTick) {
                        maxTick = absoluteTick;
                    }
                }
            }
        }
        return maxTick;
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden">
        <Dialog.Header>
            <Dialog.Title>Import MIDI</Dialog.Title>
            <Dialog.Description>
                Choose a MIDI file, review its tracks, and map each one to a Noteblock instrument
                before importing.
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <input
                bind:this={fileInput}
                type="file"
                accept=".mid,.midi"
                class="hidden"
                onchange={handleFileSelection}
            />
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Selected file</p>
                    {#if midiFileName}
                        <p class="text-sm font-medium">{midiFileName}</p>
                    {:else}
                        <p class="text-sm text-muted-foreground">No file selected</p>
                    {/if}
                </div>
                <Button variant="outline" onclick={openFilePicker} disabled={isLoading}>
                    {#if isLoading}
                        Loading...
                    {:else if midiFileName}
                        Choose different file
                    {:else}
                        Choose MIDI file
                    {/if}
                </Button>
            </div>

            {#if errorMessage}
                <div
                    class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    {errorMessage}
                </div>
            {/if}

            {#if assignments.length > 0}
                <div class="rounded-md border">
                    <Table class="border-collapse text-sm">
                        <TableHeader class="bg-muted/40 text-muted-foreground">
                            <TableRow class="border-border/80">
                                <TableHead class="w-32 px-4 py-2">MIDI Channel</TableHead>
                                <TableHead class="w-[30rem] px-4 py-2">Track</TableHead>
                                <TableHead class="w-[26rem] px-4 py-2">Target</TableHead>
                                <TableHead class="w-52 px-4 py-2">Transpose</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {#each assignments as assignment, index}
                                <TableRow class="border-border/60">
                                    <TableCell
                                        class="w-24 px-4 py-3 align-top font-mono text-sm font-medium"
                                    >
                                        {assignment.channelNumber}
                                    </TableCell>
                                    <TableCell class="w-[26rem] px-4 py-3 align-top">
                                        <p class="font-medium">{assignment.name}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {(
                                                assignment.track.instrument.name ||
                                                'Unknown instrument'
                                            ).trim() || 'Unknown instrument'}
                                            · {describeTrack(assignment)}
                                        </p>
                                    </TableCell>
                                    <TableCell class="w-[22rem] px-4 py-3 align-top">
                                        <div class="flex flex-col gap-2">
                                            {#if assignment.track.channel === 9}
                                                <div class="flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant={assignment.mode === 'instrument'
                                                            ? 'default'
                                                            : 'outline'}
                                                        onclick={() => setMode(index, 'instrument')}
                                                    >
                                                        Instrument
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={assignment.mode === 'percussion'
                                                            ? 'default'
                                                            : 'outline'}
                                                        onclick={() => setMode(index, 'percussion')}
                                                    >
                                                        Percussion
                                                    </Button>
                                                </div>
                                            {/if}

                                            {#if assignment.mode === 'percussion' && assignment.percussionMapping}
                                                <div
                                                    class="w-full rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
                                                >
                                                    {describePercussion(
                                                        assignment.percussionMapping
                                                    )}
                                                </div>
                                            {:else}
                                                <InstrumentSelector
                                                    selectedInstrument={assignment.instrument}
                                                    onSelect={(instrument) =>
                                                        handleInstrumentChange(index, instrument)}
                                                    triggerClass="h-10 w-full justify-start gap-2"
                                                    align="start"
                                                >
                                                    <img
                                                        src={INSTRUMENT_ICONS[
                                                            assignment.instrument
                                                        ]}
                                                        alt={INSTRUMENT_NAMES[
                                                            assignment.instrument
                                                        ]}
                                                        class="h-6 w-6 rounded-sm object-contain"
                                                    />
                                                    <span class="text-sm"
                                                        >{INSTRUMENT_NAMES[
                                                            assignment.instrument
                                                        ]}</span
                                                    >
                                                </InstrumentSelector>
                                            {/if}
                                        </div>
                                    </TableCell>
                                    <TableCell class="w-52 px-4 py-3 align-top">
                                        {@const rawStats = computeOutOfRangeNotes(
                                            assignment.track,
                                            assignment.transpose
                                        )}
                                        {@const adjustedStats = computeOutOfRangeNotes(
                                            assignment.track,
                                            assignment.transpose,
                                            assignment.transposeWithinRange
                                        )}
                                        {@const hasRawOverflow =
                                            rawStats.above > 0 || rawStats.below > 0}
                                        {@const displayStats = assignment.transposeWithinRange
                                            ? adjustedStats
                                            : rawStats}
                                        {@const hasDisplayOverflow =
                                            displayStats.above > 0 || displayStats.below > 0}
                                        {@const rawSummary = [
                                            rawStats.below
                                                ? `${rawStats.below} ${
                                                      rawStats.below === 1 ? 'note' : 'notes'
                                                  } below`
                                                : null,
                                            rawStats.above
                                                ? `${rawStats.above} ${
                                                      rawStats.above === 1 ? 'note' : 'notes'
                                                  } above`
                                                : null
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        {@const displaySummary = [
                                            displayStats.below
                                                ? `${displayStats.below} ${
                                                      displayStats.below === 1 ? 'note' : 'notes'
                                                  } below`
                                                : null,
                                            displayStats.above
                                                ? `${displayStats.above} ${
                                                      displayStats.above === 1 ? 'note' : 'notes'
                                                  } above`
                                                : null
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        {@const isInstrument = assignment.mode === 'instrument'}
                                        {@const transposeWithinRange =
                                            assignment.transposeWithinRange}
                                        {@const transposeDisplay = formatTransposeDisplay(
                                            assignment.transpose
                                        )}

                                        <div class="flex flex-col gap-1.5">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    class="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background"
                                                    aria-label="Transpose down one octave"
                                                    title="Transpose down by 1 octave"
                                                    disabled={!isInstrument}
                                                    onclick={() =>
                                                        adjustTranspose(index, -OCTAVE_INTERVAL)}
                                                >
                                                    <ArrowDownIcon class="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    class="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background"
                                                    aria-label="Transpose down one semitone"
                                                    title="Transpose down by 1 semitone"
                                                    disabled={!isInstrument}
                                                    onclick={() => adjustTranspose(index, -1)}
                                                >
                                                    &lt;
                                                </button>
                                                <div
                                                    class="min-w-[9.5rem] text-center text-sm font-medium text-foreground"
                                                >
                                                    {transposeDisplay}
                                                </div>
                                                <button
                                                    type="button"
                                                    class="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background"
                                                    aria-label="Transpose up one semitone"
                                                    title="Transpose up by 1 semitone"
                                                    disabled={!isInstrument}
                                                    onclick={() => adjustTranspose(index, 1)}
                                                >
                                                    &gt;
                                                </button>
                                                <button
                                                    type="button"
                                                    class="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background"
                                                    aria-label="Transpose up one octave"
                                                    title="Transpose up by 1 octave"
                                                    disabled={!isInstrument}
                                                    onclick={() =>
                                                        adjustTranspose(index, OCTAVE_INTERVAL)}
                                                >
                                                    <ArrowUpIcon class="size-4" />
                                                </button>

                                                <label
                                                    class="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        class="h-4 w-4 rounded border border-border bg-background text-primary shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                        checked={transposeWithinRange}
                                                        disabled={!isInstrument}
                                                        onchange={(event) =>
                                                            setTransposeWithinRange(
                                                                index,
                                                                event.currentTarget.checked
                                                            )}
                                                    />
                                                    <span class="text-xs text-foreground">
                                                        Transpose into range
                                                    </span>
                                                </label>
                                            </div>

                                            {#if hasDisplayOverflow}
                                                <p
                                                    class="text-xs text-amber-600 dark:text-amber-400"
                                                >
                                                    {displaySummary}
                                                </p>
                                            {:else}
                                                <div
                                                    class="space-y-0.5 text-xs text-muted-foreground"
                                                >
                                                    <p>All notes within Noteblock range.</p>
                                                    {#if transposeWithinRange && hasRawOverflow}
                                                        <p class="text-muted-foreground/80">
                                                            {rawSummary} will be shifted to the nearest
                                                            octave when importing.
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/if}

                                            {#if !isInstrument}
                                                <p class="text-xs text-muted-foreground">
                                                    Transpose applies when importing as an
                                                    instrument.
                                                </p>
                                            {/if}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            {/each}
                        </TableBody>
                    </Table>
                </div>
            {:else}
                <div
                    class="rounded-md border border-dashed px-6 py-12 text-center text-sm text-muted-foreground"
                >
                    {#if isLoading}
                        Reading MIDI file...
                    {:else}
                        Select a MIDI file to review its channels before importing.
                    {/if}
                </div>
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
            <Button onclick={handleImport} disabled={!canImport}>
                {#if assignments.length}
                    Import {assignments.length} Track{assignments.length === 1 ? '' : 's'}
                {:else}
                    Import
                {/if}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
