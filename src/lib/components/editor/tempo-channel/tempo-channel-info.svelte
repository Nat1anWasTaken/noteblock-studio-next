<script lang="ts">
    import type { TempoChannel } from '$lib/types';

    interface Props {
        channel: TempoChannel;
        index?: number;
        height?: number;
    }

    let { channel, index = 0, height = 72 }: Props = $props();
</script>

<div
    class="flex w-full items-stretch border-b border-border text-sm"
    style={`min-height:${height}px; max-height:${height}px`}
>
    <div class="flex w-10 flex-col items-center justify-center gap-1 border-r border-border/70">
        <div class="text-muted-foreground">{index + 1}</div>
        <div class="size-1.5 rounded-full bg-muted-foreground/40"></div>
    </div>
    <div class="flex min-w-0 flex-1 items-center justify-between px-3 py-2">
        <div class="truncate text-base/5 font-medium">{channel.name}</div>
    </div>
</div>
