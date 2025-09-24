<script lang="ts">
    import { createEventDispatcher, type Snippet } from 'svelte';
    import { cn } from '$lib/utils';

    interface Props {
        class?: string;
        gutterWidth?: number;
        gutterClass?: string;
        timelineClass?: string;
        contentClass?: string;
        contentWidth?: number;
        scrollLeft?: number;
        pointerDownHandler?: (container: HTMLElement, event: PointerEvent) => void;
    }

    const dispatch = createEventDispatcher<{ scrollLeftChange: number }>();

    let {
        class: className,
        gutterWidth = 240,
        gutterClass = 'flex items-center gap-2 border-r border-border px-3 py-2',
        timelineClass = 'scrollbar-thin relative h-full flex-1 overflow-x-auto overflow-y-hidden bg-background',
        contentClass = 'relative h-full cursor-crosshair',
        contentWidth,
        scrollLeft = 0,
        pointerDownHandler,
        gutter,
        children
    }: Props & {
        gutter?: Snippet;
        children?: Snippet;
    } = $props();

    let scroller: HTMLDivElement | null = null;
    let contentEl: HTMLDivElement | null = null;

    // Throttle scroll events to prevent excessive updates during resize
    let scrollThrottled = false;

    // Keep the internal scroller aligned with the provided scrollLeft prop
    // Use $effect.pre to prevent cascading updates during scroll sync
    $effect.pre(() => {
        const el = scroller;
        if (!el) return;
        if (Math.abs(el.scrollLeft - scrollLeft) > 1) {
            el.scrollLeft = scrollLeft;
        }
    });

    function handleScroll() {
        if (scrollThrottled) return;
        scrollThrottled = true;

        requestAnimationFrame(() => {
            const el = scroller;
            if (!el) {
                scrollThrottled = false;
                return;
            }
            const left = el.scrollLeft;
            dispatch('scrollLeftChange', left);
            scrollThrottled = false;
        });
    }

    function handlePointerDown(event: PointerEvent) {
        if (!pointerDownHandler) return;
        pointerDownHandler(contentEl ?? (event.currentTarget as HTMLElement), event);
    }
</script>

<div class={cn('flex w-full select-none', className)}>
    <div class={cn('flex-shrink-0', gutterClass)} style={`width:${gutterWidth}px`}>
        {@render gutter?.()}
    </div>
    <div bind:this={scroller} class={cn(timelineClass)} onscroll={handleScroll}>
        <div
            bind:this={contentEl}
            class={cn(contentClass)}
            style={contentWidth != null ? `width:${contentWidth}px` : undefined}
            onpointerdown={handlePointerDown}
        >
            {@render children?.()}
        </div>
    </div>
</div>

<style>
    .scrollbar-thin::-webkit-scrollbar {
        height: 0px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.25);
        border-radius: 8px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
</style>
