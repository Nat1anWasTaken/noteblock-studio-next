<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import { editorState } from '$lib/editor-state.svelte';
    import { cn } from '$lib/utils';
    import Plus from '~icons/lucide/plus';
    import ZoomIn from '~icons/lucide/zoom-in';
    import ZoomOut from '~icons/lucide/zoom-out';
    // Mouse interactions (grid is rendered globally in the editor)
    import { editorMouse } from '$lib/editor-mouse.svelte';
    import ChannelCreationDialog from '$lib/components/editor/channel-creation-dialog.svelte';
    import { player } from '$lib/playback.svelte';
    import type { Instrument } from '$lib/types';
    import RulerShell from './ruler-shell.svelte';

    interface Props {
        class?: string;
        // Width of the left gutter column (channel controls area)
        gutterWidth?: number;
        // Optional: show zoom controls in the gutter
        showZoomControls?: boolean;
    }

    let { class: className, gutterWidth = 240, showZoomControls = true }: Props = $props();

    // Channel creation dialog
    let showChannelDialog = $state(false);

    function handleCreateChannels(channels: Array<{ name: string; instrument: Instrument }>) {
        for (const channelData of channels) {
            player.createNoteChannel(channelData);
        }
    }

    const handlePointerDown = (container: HTMLElement, event: PointerEvent) =>
        editorMouse.handleRulerPointerDown(container, event);
</script>

{#snippet gutterContent()}
    <Button size="icon" aria-label="Create channel" onclick={() => (showChannelDialog = true)}>
        <Plus class="size-4" />
    </Button>
    {#if showZoomControls}
        <div class="ml-2 flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                onclick={() => editorState.zoomOut()}
                aria-label="Zoom out"
            >
                <ZoomOut class="size-4" />
            </Button>
            <div class="min-w-14 text-center font-mono text-xs tabular-nums">
                {Math.round(editorState.pxPerBeat)} px/beat
            </div>
            <Button
                variant="ghost"
                size="icon"
                onclick={() => editorState.zoomIn()}
                aria-label="Zoom in"
            >
                <ZoomIn class="size-4" />
            </Button>
        </div>
    {/if}
{/snippet}

<RulerShell
    class={cn('items-center border-b border-border bg-secondary/40 text-sm', className)}
    {gutterWidth}
    contentWidth={editorState.contentWidth}
    scrollLeft={editorState.scrollLeft}
    pointerDownHandler={handlePointerDown}
    gutter={gutterContent}
    on:scrollLeftChange={(event) => editorState.setScrollLeft(event.detail)}
/>

<ChannelCreationDialog bind:open={showChannelDialog} onCreate={handleCreateChannels} />
