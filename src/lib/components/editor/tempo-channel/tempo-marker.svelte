<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { editorState } from '$lib/editor-state.svelte';
    import type { TempoChange } from '$lib/types';

    interface Props {
        change: TempoChange;
        channelIndex: number; // 0-based
        rowHeight?: number; // px
    }

    let { change, channelIndex, rowHeight = 72 }: Props = $props();

    const pxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
    const left = $derived(Math.max(0, change.tick * pxPerTick));
    const top = $derived(channelIndex * rowHeight);
    const height = $derived(Math.max(0, rowHeight));

    function formatTempo(change: TempoChange): string {
        const bpm =
            change.ticksPerBeat > 0
                ? Math.round((change.tempo * 60) / change.ticksPerBeat)
                : change.tempo;
        return `${bpm} BPM • tpb=${change.ticksPerBeat} • bpb=${change.beatsPerBar}`;
    }
</script>

<div class="absolute z-30" style={`left:${left}px; top:${top}px; height:${height}px; width:0;`}>
    <div class="absolute inset-y-0 left-0 w-px bg-amber-500/80"></div>
    <!-- Label to the right of the marker, aligned to the top of the row -->
    <Badge
        variant="secondary"
        class="absolute top-1 left-2 px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap shadow"
    >
        {formatTempo(change)}
    </Badge>
    <!-- Interaction hit area could be added later if needed -->
    <div class="absolute top-0 left-0 h-full w-3 cursor-pointer"></div>
</div>
