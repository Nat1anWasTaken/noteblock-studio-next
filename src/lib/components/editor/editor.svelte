<script lang="ts">
    import * as Resizable from '$lib/components/ui/resizable';
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import NoteChannelInfo from './note-channel-info.svelte';
    import TempoChannelInfo from './tempo-channel-info.svelte';
    import EditorHeader from './editor-controls.svelte';
    import RulerRow from './ruler-row.svelte';
    import NoteSection from './note-section.svelte';

    onMount(() => {
        player.setSong(sample);
    });

    const gutterWidth = 240;
    const rowHeight = 72;

    let channelScroller: HTMLDivElement | null = null;
    const onChannelsScroll = () => editorState.setScrollLeft(channelScroller?.scrollLeft ?? 0);
    $effect(() => {
        if (!channelScroller) return;
        if (Math.abs(channelScroller.scrollLeft - editorState.scrollLeft) > 1) {
            channelScroller.scrollLeft = editorState.scrollLeft;
        }
    });

    const range = (n: number) => Array.from({ length: n }, (_, i) => i);
    const channels = $derived(player.song?.channels ?? []);
</script>

<div class="flex h-screen flex-col">
    <EditorHeader />

    <Resizable.PaneGroup direction="horizontal">
        <Resizable.Pane class="bg-accent" defaultSize={32} />
        <Resizable.Handle />
        <Resizable.Pane>
            <div class="flex h-full w-full flex-col">
                <!-- Ruler / Controls Row -->
                <RulerRow {gutterWidth} />

                <!-- Channels area with ruler-matched background -->
                <div class="flex min-h-0 flex-1 select-none">
                    <!-- Left gutter: channel infos -->
                    <div
                        class="flex shrink-0 flex-col border-r border-border bg-secondary/40"
                        style={`width:${gutterWidth}px`}
                    >
                        {#if channels.length === 0}
                            <div class="px-3 py-2 text-sm text-muted-foreground">No channels</div>
                        {:else}
                            {#each channels as ch, i}
                                {#if ch.kind === 'note'}
                                    <NoteChannelInfo channel={ch} index={i} height={rowHeight} />
                                {:else}
                                    <TempoChannelInfo channel={ch} index={i} height={rowHeight} />
                                {/if}
                            {/each}
                        {/if}
                    </div>

                    <!-- Scrollable timeline region -->
                    <div
                        bind:this={channelScroller}
                        class="flex-1 overflow-auto bg-background"
                        onscroll={onChannelsScroll}
                    >
                        <div
                            class="relative"
                            style={`width:${editorState.contentWidth}px; min-height:${Math.max(1, channels.length) * rowHeight}px;`}
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

                            <!-- Channel row separators -->
                            {#each channels as _, i}
                                <div
                                    class="pointer-events-none absolute right-0 left-0 border-b border-border"
                                    style={`top:${(i + 1) * rowHeight}px; height:0`}
                                ></div>
                            {/each}

                            <!-- Render note sections for each channel -->
                            {#each channels as ch, chIdx}
                                {#if ch.kind === 'note'}
                                    {#each ch.sections as section}
                                        <NoteSection section={section} channelIndex={chIdx} rowHeight={rowHeight} />
                                    {/each}
                                {/if}
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </Resizable.Pane>
    </Resizable.PaneGroup>
</div>
