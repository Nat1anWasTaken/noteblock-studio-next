<script lang="ts">
    import type { Channel } from '$lib/types';

    interface Props {
        channel: Channel;
    }

    let { channel }: Props = $props();
</script>
