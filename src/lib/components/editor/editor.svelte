<script lang="ts">
    import * as Resizable from '$lib/components/ui/resizable';
    import { player } from '$lib/playback.svelte';
    import { editorState } from '$lib/editor-state.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import EditorHeader from './editor-controls.svelte';
    import RulerRow from './ruler-row.svelte';

    onMount(() => {
        player.setSong(sample);
    });

    // Use editorState's reactive values directly for geometry
    const gutterWidth = 240;

    // Sync scroll with ruler row
    let channelScroller: HTMLDivElement | null = null;
    const onChannelsScroll = () => editorState.setScrollLeft(channelScroller?.scrollLeft ?? 0);
    $effect(() => {
        if (!channelScroller) return;
        if (Math.abs(channelScroller.scrollLeft - editorState.scrollLeft) > 1) {
            channelScroller.scrollLeft = editorState.scrollLeft;
        }
    });

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<div class="flex h-screen flex-col">
    <EditorHeader />

    <Resizable.PaneGroup direction="horizontal">
        <Resizable.Pane
            class="flex flex-col items-center justify-center bg-accent"
            defaultSize={32}
        >
            <h1>Channel Control</h1>
            <p class="text-muted-foreground">Placeholder for channel control...</p>
        </Resizable.Pane>
        <Resizable.Handle />
        <Resizable.Pane>
            <div class="flex h-full w-full flex-col">
                <!-- Ruler / Controls Row -->
                <RulerRow gutterWidth={gutterWidth} />

                <!-- Channels area with ruler-matched background -->
                <div class="flex min-h-0 flex-1 select-none">
                    <!-- Left gutter for channels (placeholder content) -->
                    <div
                        class="flex shrink-0 flex-col border-r border-border bg-secondary/40"
                        style={`width:${gutterWidth}px`}
                    >
                        <div class="px-3 py-2 text-sm text-muted-foreground">Channels</div>
                    </div>

                    <!-- Scrollable timeline region -->
                    <div
                        bind:this={channelScroller}
                        class="relative flex-1 overflow-auto bg-background"
                        onscroll={onChannelsScroll}
                    >
                        <div
                            class="relative"
                            style={`width:${Math.max(0, editorState.contentWidth)}px; min-height: 100%;`}
                        >
                            {#each range(editorState.totalBars) as barIdx}
                                <div
                                    class="absolute inset-y-0 border-r border-border"
                                    style={`left:${barIdx * editorState.barWidth}px; width:${editorState.barWidth}px; ${barIdx % 2 === 1 ? 'background-color:hsl(var(--secondary)/0.25)' : ''}`}
                                >
                                    {#each range(editorState.beatsPerBar) as beatIdx}
                                        {#if beatIdx > 0}
                                            <div
                                                class="absolute inset-y-0 border-l border-border/80"
                                                style={`left:${beatIdx * editorState.pxPerBeat}px`}
                                            ></div>
                                        {/if}
                                    {/each}
                                </div>
                            {/each}

                            <!-- Future: channel rows content -->
                        </div>
                    </div>
                </div>
            </div>
        </Resizable.Pane>
    </Resizable.PaneGroup>
</div>
