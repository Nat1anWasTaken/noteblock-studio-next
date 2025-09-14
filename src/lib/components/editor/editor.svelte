<script>
    import { player } from '$lib/playback.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import EditorHeader from './editor-controls.svelte';

    onMount(() => {
        player.setSong(sample);
    });
</script>

<div class="flex h-screen flex-col">
    <EditorHeader />

    <div class="flex-1 overflow-scroll">
        {#each { length: 200 } as a}
            <p>a</p>
        {/each}
    </div>
</div>
