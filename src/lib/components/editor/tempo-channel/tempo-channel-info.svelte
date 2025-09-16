<script lang="ts">
    import ChannelInfoContextMenu from '$lib/components/editor/channel-info-context-menu.svelte';
    import Input from '$lib/components/ui/input/input.svelte';
    import { player } from '$lib/playback.svelte';
    import type { TempoChannel } from '$lib/types';
    import { tick } from 'svelte';
    import { toast } from 'svelte-sonner';
    import ChannelDeletionDialog from '../channel-deletion-dialog.svelte';

    interface Props {
        channel: TempoChannel;
        index: number;
        height: number;
    }

    let { channel, index = 0, height = 72 }: Props = $props();

    let editingName = $state(false);
    let inputElement = $state<HTMLInputElement | null>(null);

    async function startEditing() {
        editingName = true;
        await tick();
        inputElement?.focus();
        inputElement?.select();
    }

    function saveNameChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const newName = target.value.trim();
        if (newName && newName !== channel.name) {
            player.updateTempoChannel(index, { name: newName });
        }
        editingName = false;
    }

    function cancelNameChange() {
        editingName = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            saveNameChange(event);
        } else if (event.key === 'Escape') {
            cancelNameChange();
        }
    }

    let deletionDialogOpen = $state(false);

    function handleDeleteChannel() {
        player.removeChannel(index);
        toast.info(`${channel.name} deleted`);
    }
</script>

<ChannelDeletionDialog
    channelName={channel.name}
    bind:open={deletionDialogOpen}
    onDelete={handleDeleteChannel}
    onCancel={() => {}}
/>

<ChannelInfoContextMenu onRename={startEditing} onDelete={() => (deletionDialogOpen = true)}>
    <div
        class="flex w-full items-stretch border-b border-border text-sm"
        style={`min-height:${height}px; max-height:${height}px`}
    >
        <div class="flex w-10 flex-col items-center justify-center gap-1 border-r border-border/70">
            <div class="text-muted-foreground">{index + 1}</div>
            <div class="size-1.5 rounded-full bg-muted-foreground/40"></div>
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between px-3 py-2">
            {#if editingName}
                <Input
                    bind:ref={inputElement}
                    value={channel.name}
                    class="h-auto border-none bg-transparent p-0 text-base/5 font-medium shadow-none focus-visible:ring-0"
                    onkeydown={handleKeydown}
                    onblur={cancelNameChange}
                />
            {:else}
                <div
                    class="w-full cursor-text truncate border-1 border-transparent text-base/5 font-medium hover:border-current/20"
                    ondblclick={startEditing}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && startEditing()}
                >
                    {channel.name}
                </div>
            {/if}
        </div>
    </div>
</ChannelInfoContextMenu>
