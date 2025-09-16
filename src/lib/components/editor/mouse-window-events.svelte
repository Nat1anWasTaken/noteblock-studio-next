<script lang="ts">
    import { editorMouse } from '$lib/editor-mouse.svelte';
</script>

<svelte:window
    onpointermove={editorMouse.handleWindowPointerMove}
    onpointerup={editorMouse.handleWindowPointerUp}
/>
