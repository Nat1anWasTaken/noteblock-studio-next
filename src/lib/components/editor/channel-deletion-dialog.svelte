<script lang="ts">
    import Button from '$lib/components//ui/button/button.svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';

    interface Props {
        open?: boolean;
        channelName: string;
        onDelete?: () => void;
        onCancel?: () => void;
    }

    let { open = $bindable(false), channelName, onDelete, onCancel }: Props = $props();

    function handleDelete() {
        open = false;
        onDelete?.();
    }

    function handleCancel() {
        open = false;
        onCancel?.();
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Are you sure you want to delete {channelName}?</Dialog.Title>
            <Dialog.Description>
                This action cannot be undone. This will permanently delete the channel and remove
                all associated data.
            </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="outline" onclick={handleCancel}>Cancel</Button>
            <Button variant="destructive" onclick={handleDelete}>Delete</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
