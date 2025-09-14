<script>
    import Button from '$lib/components/ui/button/button.svelte';
    import { player } from '$lib/playback.svelte';
    import { onMount } from 'svelte';

    onMount(() => {
        player.setSong(sample);
    });
</script>

<Button onclick={() => (player.isPlaying ? player.pause() : player.resume())}
    >{player.isPlaying ? 'Pause' : 'Play'}</Button
>
<Button onclick={() => player.setMetronomeEnabled(!player.metronomeEnabled)}>Metronome</Button>
<label style="margin-left:12px; display:inline-flex; align-items:center; gap:6px;">
    <input
        type="checkbox"
        checked={player.metronomeEnabled}
        onchange={(e) => player.setMetronomeEnabled(e.currentTarget.checked)}
    />
    Metronome
</label>
<p>Current Tick{player.currentTick}</p>
<p>{player.currentBar} : {player.currentBeat}</p>
