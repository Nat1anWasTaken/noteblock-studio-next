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

    interface Props {
        class?: string;
        // Width of the left gutter column (channel controls area)
        gutterWidth?: number;
        // Optional: show zoom controls in the gutter
        showZoomControls?: boolean;
    }

    let { class: className, gutterWidth = 240, showZoomControls = true }: Props = $props();

    // Sync scroll position through shared state for future channel rows
    let scroller: HTMLDivElement | null = null;
    const onScroll = () => editorState.setScrollLeft(scroller?.scrollLeft ?? 0);

    // Channel creation dialog
    let showChannelDialog = $state(false);

    function handleCreateChannels(channels: Array<{ name: string; instrument: Instrument }>) {
        for (const channelData of channels) {
            player.createNoteChannel(channelData);
        }
    }

    // Keep this scroller in sync if external changes modify scrollLeft
    $effect(() => {
        if (!scroller) return;
        if (Math.abs(scroller.scrollLeft - editorState.scrollLeft) > 1) {
            scroller.scrollLeft = editorState.scrollLeft;
        }
    });
</script>

<div
    class={cn(
        'flex w-full items-center border-b border-border bg-secondary/40 text-sm select-none',
        className
    )}
>
    <!-- Left gutter: channel/global controls -->
    <div
        class="flex items-center gap-2 border-r border-border px-3 py-2"
        style={`width:${gutterWidth}px`}
    >
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
    </div>

    <!-- Timeline ruler -->
    <div
        bind:this={scroller}
        class="scrollbar-thin relative h-full flex-1 overflow-x-auto overflow-y-hidden bg-background"
        onscroll={onScroll}
    >
        <div
            class="relative h-full cursor-crosshair"
            style={`width:${editorState.contentWidth}px`}
            onpointerdown={(e) =>
                editorMouse.handleRulerPointerDown(e.currentTarget as HTMLElement, e)}
        ></div>
    </div>
</div>

<ChannelCreationDialog bind:open={showChannelDialog} onCreate={handleCreateChannels} />

<style>
    .scrollbar-thin::-webkit-scrollbar {
        height: 0px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.25);
        border-radius: 8px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
</style>
