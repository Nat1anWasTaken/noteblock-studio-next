<script lang="ts">
    import * as ContextMenu from '$lib/components/ui/context-menu';

    import type { Snippet } from 'svelte';
    import PenLine from '~icons/lucide/pen-line';
    import Piano from '~icons/lucide/piano';
    import Trash from '~icons/lucide/trash-2';

    interface Props {
        children: Snippet;
        onRename?: () => void;
        onChangeInstrument?: () => void;
        onDelete?: () => void;
    }

    let { children, onRename, onChangeInstrument, onDelete }: Props = $props();
</script>

<ContextMenu.Root>
    <ContextMenu.Trigger>
        {@render children()}
    </ContextMenu.Trigger>
    <ContextMenu.Content class="w-48">
        <ContextMenu.Item onSelect={onRename} class="flex items-center justify-between">
            Rename
            <PenLine />
        </ContextMenu.Item>
        <ContextMenu.Item onSelect={onChangeInstrument} class="flex items-center justify-between">
            Change Instrument
            <Piano />
        </ContextMenu.Item>
        <ContextMenu.Item
            onSelect={onDelete}
            class="flex items-center justify-between text-destructive"
        >
            Delete Channel
            <Trash class="text-destructive" />
        </ContextMenu.Item>
    </ContextMenu.Content>
</ContextMenu.Root>
