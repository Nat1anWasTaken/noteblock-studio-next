<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';
    import type { TempoChange } from '$lib/types';
    import TempoChangeEditor from './tempo-change-editor.svelte';

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

    let dialogOpen = $state(false);

    function formatTempo(change: TempoChange): string {
        return `${change.tempo} t/s • ${change.ticksPerBeat} t/b • ${change.beatsPerBar} b/b`;
    }

    function handleDoubleClick() {
        if (!player.song) return;

        if (player.isPlaying) {
            player.pause();
        }

        dialogOpen = true;
    }

    function handleTempoSave(updatedChange: Partial<TempoChange>) {
        if (!player.song) return;

        // Find the tempo channel and update the specific tempo change
        for (const channel of player.song.channels) {
            if (channel.kind === 'tempo') {
                const changeIndex = channel.tempoChanges.findIndex((tc) => tc.tick === change.tick);
                if (changeIndex !== -1) {
                    channel.tempoChanges[changeIndex] = {
                        ...channel.tempoChanges[changeIndex],
                        ...updatedChange
                    };
                    break;
                }
            }
        }

        // Rebuild indexes and refresh scheduler
        player.refreshIndexes();
    }
</script>

<div
    class="absolute z-30"
    style={`left:${left}px; top:${top}px; height:${height}px; width:0;`}
    ondblclick={() => handleDoubleClick()}
    role="button"
    tabindex={30}
>
    <div class="absolute inset-y-0 left-0 w-px bg-amber-500/80"></div>
    <!-- Label to the right of the marker, aligned to the top of the row -->
    <Badge
        variant="secondary"
        class="absolute top-1 left-2 cursor-pointer px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap shadow"
    >
        {formatTempo(change)}
    </Badge>
    <!-- Interaction hit area could be added later if needed -->
    <div class="absolute top-0 left-0 h-full w-3 cursor-pointer"></div>
</div>

<TempoChangeEditor bind:open={dialogOpen} {change} onSave={handleTempoSave} />
