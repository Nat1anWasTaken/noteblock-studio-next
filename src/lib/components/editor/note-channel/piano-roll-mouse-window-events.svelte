<script lang="ts">
    import { pianoRollMouse } from '$lib/piano-roll-mouse.svelte';
</script>

<svelte:window
    onpointermove={pianoRollMouse.handleWindowPointerMove}
    onpointerup={pianoRollMouse.handleWindowPointerUp}
    onpointercancel={pianoRollMouse.handleWindowPointerCancel}
    onkeydown={pianoRollMouse.handleWindowKeyDown}
/>
