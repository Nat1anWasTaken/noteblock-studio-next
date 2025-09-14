<script lang="ts">
    import { Instrument, type Channel } from '$lib/types';

    interface Props {
        channel: Channel;
        index?: number;
        height?: number;
    }

    let { channel, index = 0, height = 72 }: Props = $props();

    const instrumentIcon: Record<Instrument, string> = {
        [Instrument.Piano]: '/instruments/harp.png',
        [Instrument.DoubleBass]: '/instruments/bass.png',
        [Instrument.BassDrum]: '/instruments/bassdrum.png',
        [Instrument.SnareDrum]: '/instruments/snare.png',
        [Instrument.Click]: '/instruments/hat.png',
        [Instrument.Guitar]: '/instruments/guitar.png',
        [Instrument.Flute]: '/instruments/flute.png',
        [Instrument.Bell]: '/instruments/bell.png',
        [Instrument.Chime]: '/instruments/icechime.png',
        [Instrument.Xylophone]: '/instruments/xylobone.png',
        [Instrument.IronXylophone]: '/instruments/iron_xylophone.png',
        [Instrument.CowBell]: '/instruments/cow_bell.png',
        [Instrument.Didgeridoo]: '/instruments/didgeridoo.png',
        [Instrument.Bit]: '/instruments/bit.png',
        [Instrument.Banjo]: '/instruments/banjo.png',
        [Instrument.Pling]: '/instruments/pling.png'
    } as const;

    function getIcon(): string | null {
        if (channel.kind !== 'note') return null;
        return instrumentIcon[channel.instrument] ?? null;
    }
</script>

<div class="flex w-full items-stretch border-b border-border text-sm" style={`height:${height}px`}>
    <!-- Channel index + status column -->
    <div class="flex w-10 flex-col items-center justify-center gap-1 border-r border-border/70">
        <div class="text-muted-foreground">{index + 1}</div>
        <div class="size-1.5 rounded-full bg-muted-foreground/40"></div>
    </div>

    <!-- Channel title + icon -->
    <div class="flex min-w-0 flex-1 items-center justify-between px-3 py-2">
        <div class="min-w-0">
            <div class="truncate text-base/5 font-medium">{channel.name}</div>
        </div>
        {#if channel.kind === 'note'}
            {#if getIcon()}
                <img src={getIcon()!} alt="instrument" class="w-aut h-10 rounded-sm" />
            {/if}
        {:else}
            <div
                class="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground select-none"
            >
                Tempo
            </div>
        {/if}
    </div>
</div>
