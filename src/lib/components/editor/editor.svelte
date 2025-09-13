<script>
    import { player } from '$lib/playback.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import EditorHeader from './editor-controls.svelte';

    onMount(() => {
        player.setSong(sample);
    });
</script>

<div class="fixed top-0 w-full">
    <EditorHeader />
</div>
