<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import { editorState } from '$lib/editor-state.svelte';
    import { cn } from '$lib/utils';
    import { createEventDispatcher } from 'svelte';
    import Plus from '~icons/lucide/plus';
    import ZoomIn from '~icons/lucide/zoom-in';
    import ZoomOut from '~icons/lucide/zoom-out';

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

    // Keep this scroller in sync if external changes modify scrollLeft
    $effect(() => {
        if (!scroller) return;
        if (Math.abs(scroller.scrollLeft - editorState.scrollLeft) > 1) {
            scroller.scrollLeft = editorState.scrollLeft;
        }
    });

    const dispatch = createEventDispatcher<{ 'create-channel': void }>();
    // Emit a create-channel event for parent handlers
    const createChannel = () => {
        dispatch('create-channel');
    };

    // Render helpers
    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
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
        <Button size="icon" onclick={createChannel} aria-label="Create channel">
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
        <div class="relative h-full" style={`width:${editorState.contentWidth}px`}>
            <!-- Bars -->
            {#each range(editorState.totalBars) as barIdx}
                <div
                    class="absolute top-0 h-full border-r border-border"
                    style={`left:${barIdx * editorState.barWidth}px; width:${editorState.barWidth}px; ${barIdx % 2 === 1 ? 'background-color:hsl(var(--secondary)/0.25)' : ''}`}
                >
                    <!-- Bar label -->
                    <div
                        class="absolute top-1 left-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-none text-secondary-foreground"
                    >
                        {barIdx + 1}
                    </div>
                    <!-- Beat ticks -->
                    {#each range(editorState.beatsPerBar) as beatIdx}
                        {#if beatIdx > 0}
                            <div
                                class="absolute top-0 h-full border-l border-border/80"
                                style={`left:${beatIdx * editorState.pxPerBeat}px`}
                            ></div>
                        {/if}
                    {/each}
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .scrollbar-thin::-webkit-scrollbar {
        height: 8px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.25);
        border-radius: 8px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
</style>
