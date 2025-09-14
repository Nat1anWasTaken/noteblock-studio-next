<script>
    import * as Resizable from '$lib/components/ui/resizable';
    import { player } from '$lib/playback.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import EditorHeader from './editor-controls.svelte';
    import RulerRow from './ruler-row.svelte';

    onMount(() => {
        player.setSong(sample);
    });
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
                <RulerRow gutterWidth={240} />

                <!-- Channels rows placeholder (to be implemented) -->
                <div class="flex-1 overflow-auto bg-background/60">
                    <div class="p-4 text-sm text-muted-foreground">Channel rows will appear here…</div>
                </div>
            </div>
        </Resizable.Pane>
    </Resizable.PaneGroup>
</div>
