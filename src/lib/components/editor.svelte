<script>
    import { Player } from '$lib/playback.svelte';
    import { sample } from '$lib/sample-song';
    import { onMount } from 'svelte';
    import Button from './ui/button/button.svelte';

    const player = new Player();

    function handleClick() {
        if (player.isPlaying) {
            player.pause();
        } else {
            player.resume();
            console.log('resumed');
        }
    }

    onMount(() => {
        player.setSong(sample);
    });
</script>

<Button onclick={handleClick} />
<p>Current Tick: {player.currentTick}</p>
