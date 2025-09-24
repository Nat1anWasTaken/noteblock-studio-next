<script lang="ts">
    import { editorMouse } from '$lib/editor-mouse.svelte';
</script>

<svelte:window
    onpointermove={editorMouse.handleWindowPointerMove}
    onpointerup={editorMouse.handleWindowPointerUp}
    onpointercancel={() => editorMouse.cancel()}
    onpointerleave={() => editorMouse.cancel()}
    onwheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                editorState.zoomIn();
            } else if (e.deltaY > 0) {
                editorState.zoomOut();
            }
        }
    }}
/>
