<script>
    import { goto } from '$app/navigation';
    import Editor from '$lib/components/editor/editor.svelte';
    import { player } from '$lib/playback.svelte';
    import { onDestroy, onMount } from 'svelte';

    onMount(() => {
        if (!player.song) {
            goto('/');
        }
    });

    onDestroy(() => {
        player.reset();
    });
</script>

<Editor />
