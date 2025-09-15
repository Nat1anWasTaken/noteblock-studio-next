<script lang="ts">
    import type { NoteChannel } from '$lib/types';
    import NoteSection from './note-section.svelte';

    interface Props {
        channel: NoteChannel;
        index: number; // 0-based
        rowHeight?: number; // px
    }

    let { channel, index, rowHeight = 72 }: Props = $props();
</script>

<!-- Renders all sections belonging to a single note channel on its row -->
{#each channel.sections as section, sIdx}
    <NoteSection {section} channelIndex={index} sectionIndex={sIdx} {rowHeight} />
{/each}
