<script lang="ts">
    import type { TempoChannel } from '$lib/types';
    import TempoMarker from './tempo-marker.svelte';

    interface Props {
        channel: TempoChannel;
        index: number; // 0-based
        rowHeight?: number; // px
    }

    let { channel, index, rowHeight = 72 }: Props = $props();
</script>

<!-- Render each tempo change marker on this row -->
{#each channel.tempoChanges as change}
    <TempoMarker {change} channelIndex={index} {rowHeight} />
{/each}
