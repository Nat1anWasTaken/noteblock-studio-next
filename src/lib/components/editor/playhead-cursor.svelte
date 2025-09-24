<script lang="ts">
    import { editorState } from '$lib/editor-state.svelte';
    import { player } from '$lib/playback.svelte';

    interface Props {
        gutterWidth?: number;
        class?: string;
        scrollLeft?: number;
        pxPerTick?: number;
        currentTick?: number;
        tickOffset?: number;
        visible?: boolean;
    }

    let {
        gutterWidth = 0,
        class: className = '',
        scrollLeft: scrollLeftProp,
        pxPerTick: pxPerTickProp,
        currentTick: currentTickProp,
        tickOffset: tickOffsetProp = 0,
        visible: visibleProp
    }: Props = $props();

    const defaultPxPerTick = $derived(
        editorState.ticksPerBeat > 0 ? editorState.pxPerBeat / editorState.ticksPerBeat : 0
    );
    const pxPerTick = $derived(Math.max(0, pxPerTickProp ?? defaultPxPerTick));
    const scrollLeft = $derived(scrollLeftProp ?? editorState.scrollLeft);
    const currentTick = $derived(currentTickProp ?? player.currentTick);
    const tickOffset = $derived(tickOffsetProp ?? 0);
    const visible = $derived(visibleProp ?? true);

    let animatedViewportX = $state(0);
    let animationId: number | null = null;
    let lastAnimationTime = $state(performance.now());

    // Calculate velocity in pixels per millisecond based on tempo
    const velocityPxPerMs = $derived(() => {
        if (!player.isPlaying || player.tempo <= 0) return 0;
        // Convert tempo (ticks per minute) to pixels per millisecond
        const ticksPerMs = player.tempo / (60 * 1000);
        return ticksPerMs * pxPerTick;
    });

    $effect(() => {
        const animate = (currentTime: number) => {
            const deltaTime = currentTime - lastAnimationTime;
            lastAnimationTime = currentTime;

            if (player.isPlaying && velocityPxPerMs() > 0) {
                // Move at constant velocity based on tempo
                const targetContentX = Math.max(0, (currentTick - tickOffset) * pxPerTick);
                const targetViewportX = targetContentX - scrollLeft;

                // Smooth interpolation toward target (handles seeking/jumping)
                const diff = targetViewportX - animatedViewportX;
                if (Math.abs(diff) > 2) {
                    // Large jump - likely a seek, snap closer
                    animatedViewportX += diff * 0.3;
                } else {
                    // Small difference - use tempo-based movement
                    animatedViewportX += velocityPxPerMs() * deltaTime;
                }
            } else {
                // Not playing - snap to exact position
                const targetContentX = Math.max(0, (currentTick - tickOffset) * pxPerTick);
                animatedViewportX = targetContentX - scrollLeft;
            }

            animationId = requestAnimationFrame(animate);
        };

        // Start animation loop
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
        }

        lastAnimationTime = performance.now();
        animationId = requestAnimationFrame(animate);

        // Cleanup on effect destruction
        return () => {
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        };
    });
</script>

<!-- Absolute overlay that spans the parent relative container -->
<div
    class={`pointer-events-none absolute inset-y-0 right-0 z-30 ${className}`}
    style={`left:${gutterWidth}px`}
>
    {#if visible}
        <div
            class="absolute top-0 bottom-0"
            style={`transform:translateX(${animatedViewportX}px);`}
        >
            <div class="h-full w-[2px] bg-primary shadow-[0_0_0_1px_hsl(var(--background))]"></div>
        </div>
    {/if}
</div>
