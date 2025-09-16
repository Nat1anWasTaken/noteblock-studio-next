<script lang="ts">
    import * as Popover from '$lib/components/ui/popover';
    import type { Instrument } from '$lib/types';
    import { INSTRUMENT_NAMES, INSTRUMENT_ICONS, ALL_INSTRUMENTS } from '$lib/types';
    import { cn } from '$lib/utils';

    interface Props {
        selectedInstrument: Instrument;
        onSelect: (instrument: Instrument) => void;
        open?: boolean;
        triggerClass?: string;
        contentClass?: string;
        align?: 'start' | 'center' | 'end';
        side?: 'top' | 'right' | 'bottom' | 'left';
        children?: any;
    }

    let {
        selectedInstrument,
        onSelect,
        open = $bindable(false),
        triggerClass,
        contentClass,
        align = 'end',
        side = 'bottom',
        children
    }: Props = $props();

    function handleSelect(instrument: Instrument) {
        onSelect(instrument);
        open = false;
    }
</script>

<Popover.Root bind:open>
    <Popover.Trigger
        class={cn(
            'flex items-center justify-center rounded-sm p-1 transition-colors hover:bg-muted/50',
            triggerClass
        )}
        aria-label="Select instrument"
    >
        {#if children}
            {@render children()}
        {:else}
            <img
                src={INSTRUMENT_ICONS[selectedInstrument]}
                alt={INSTRUMENT_NAMES[selectedInstrument]}
                class="h-10 w-10 rounded-sm object-contain"
            />
        {/if}
    </Popover.Trigger>
    <Popover.Content class={cn('w-80 p-4', contentClass)} {align} {side}>
        <h4 class="mb-2 text-sm font-semibold">Select Instrument</h4>
        <div class="grid max-h-60 grid-cols-4 gap-1 overflow-y-auto">
            {#each ALL_INSTRUMENTS as instrument}
                <button
                    class={cn(
                        'flex flex-col items-center gap-1 rounded-sm p-2 text-xs transition-colors hover:bg-muted',
                        selectedInstrument === instrument ? 'bg-muted' : ''
                    )}
                    onclick={() => handleSelect(instrument)}
                    aria-label={`Select ${INSTRUMENT_NAMES[instrument]}`}
                >
                    <img
                        src={INSTRUMENT_ICONS[instrument]}
                        alt={INSTRUMENT_NAMES[instrument]}
                        class="h-8 w-8 rounded-sm object-contain"
                    />
                    <span class="text-center leading-tight">
                        {INSTRUMENT_NAMES[instrument]}
                    </span>
                </button>
            {/each}
        </div>
    </Popover.Content>
</Popover.Root>
