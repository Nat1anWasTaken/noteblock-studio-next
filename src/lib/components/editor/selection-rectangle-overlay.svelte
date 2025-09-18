<script lang="ts">
    export interface OverlayRect {
        left: number;
        top: number;
        width: number;
        height: number;
    }

    interface Props {
        rect: OverlayRect | null;
        gutterWidth?: number;
        scrollLeft?: number;
        scrollTop?: number;
        class?: string;
        stretchY?: boolean;
        overlayClass?: string;
    }

    let {
        rect,
        gutterWidth = 0,
        scrollLeft = 0,
        scrollTop = 0,
        class: className = '',
        stretchY = false,
        overlayClass = 'rounded-sm border-2 border-indigo-400/70 bg-indigo-500/10'
    }: Props = $props();

    const visible = $derived(Boolean(rect));
    const viewportLeft = $derived(visible && rect ? Math.round(rect.left - scrollLeft) : 0);
    const viewportTop = $derived(visible && rect ? Math.round(rect.top - scrollTop) : 0);
    const width = $derived(visible && rect ? Math.max(1, Math.round(rect.width)) : 0);
    const height = $derived(visible && rect ? Math.max(1, Math.round(rect.height)) : 0);
</script>

{#if visible && rect}
    <div
        class={`pointer-events-none absolute inset-y-0 right-0 z-20 ${className}`}
        style={`left:${gutterWidth}px;`}
    >
        <div
            class={`absolute ${overlayClass}`}
            style={`left:${viewportLeft}px; ${stretchY ? 'top:0; bottom:0;' : `top:${viewportTop}px; height:${height}px;`} width:${width}px;`}
        ></div>
    </div>
{/if}
