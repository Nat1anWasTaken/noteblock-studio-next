<script lang="ts">
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '$lib/components/ui/dropdown-menu';
    import ChevronDown from '~icons/lucide/chevron-down';

    interface Props {
        class?: string;
        children: any;
    }

    let { class: className, children }: Props = $props();

    function handleSave() {
        // TODO: Implement save functionality
        console.log('Save clicked');
    }

    function handleSaveAs() {
        // TODO: Implement save as functionality
        console.log('Save As clicked');
    }
</script>

<DropdownMenu>
    <DropdownMenuTrigger class={`flex min-w-0 items-center gap-1 ${className || ''}`}>
        {@render children()}
        <ChevronDown class="size-4 text-muted-foreground" />
    </DropdownMenuTrigger>
    <DropdownMenuContent>
        <DropdownMenuItem onclick={handleSave}>Save</DropdownMenuItem>
        <DropdownMenuItem onclick={handleSaveAs}>Save As</DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
