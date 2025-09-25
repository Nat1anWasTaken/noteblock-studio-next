<script lang="ts">
    import { goto } from '$app/navigation';
    import Editor from '$lib/components/editor/editor.svelte';
    import ResumeSavedSongDialog from '$lib/components/editor/resume-saved-song-dialog.svelte';
    import { player } from '$lib/playback.svelte';
    import { clearStoredSong, loadSongFromStorage, type StoredSongPayload } from '$lib/song-storage';
    import { onDestroy, onMount } from 'svelte';
    import { toast } from 'svelte-sonner';

    let resumeDialogOpen = $state(false);
    let storedSong = $state<StoredSongPayload | null>(null);

    onMount(() => {
        if (player.song) return;
        const stored = loadSongFromStorage();
        if (stored) {
            storedSong = stored;
            resumeDialogOpen = true;
        } else {
            goto('/');
        }
    });

    onDestroy(() => {
        player.reset();
    });

    function handleResumeStoredSong() {
        if (!storedSong) return;
        player.setSong(storedSong.song);
        resumeDialogOpen = false;
        toast.success(`Resumed "${storedSong.song.name || 'Untitled Song'}"`);
    }

    function handleDiscardStoredSong() {
        clearStoredSong();
        storedSong = null;
        resumeDialogOpen = false;
        goto('/');
    }
</script>

<Editor />

{#if storedSong}
    <ResumeSavedSongDialog
        bind:open={resumeDialogOpen}
        song={storedSong.song}
        savedAt={storedSong.savedAt}
        onResume={handleResumeStoredSong}
        onDiscard={handleDiscardStoredSong}
    />
{/if}
