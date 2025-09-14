<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import type { NoteSection } from '$lib/types';

    interface Props {
        section: NoteSection;
        channelIndex: number; // 0-based
        rowHeight?: number; // px
    }

    let { section, channelIndex, rowHeight = 72 }: Props = $props();

    // Compute positions directly from editorState to avoid TS inference issues
    const left = $derived(
        section.startingTick *
            (editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0)
    );
    const width = $derived(
        Math.max(
            1,
            section.length *
                (editorState.ticksPerBeat > 0
                    ? editorState.pxPerBeat / editorState.ticksPerBeat
                    : 0)
        )
    );
    const margin = 6; // visual breathing room inside the row
    const top = $derived(channelIndex * rowHeight + margin);
    const height = $derived(Math.max(0, rowHeight - margin * 2));

    $inspect(`left:${left}px; top:${top}px; width:${width}px; height:${height}px;`);
</script>

<!-- Simple visual block for a note section; color tokens are placeholders -->
<div
    class="absolute z-10 overflow-hidden rounded-md border border-emerald-700/60 bg-emerald-600/90 text-xs shadow-sm select-none"
    style={`left:${left}px; top:${top}px; width:${width}px; height:${height}px;`}
>
    <!-- Header strip with section name -->
    <div class="w-full truncate bg-emerald-200/80 px-2 font-medium text-emerald-900">
        {section.name}
    </div>

    <!-- Body placeholder where notes will appear later -->
    <div class="h-[calc(100%-1.5rem)] w-full"></div>
</div>
