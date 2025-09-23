<script lang="ts">
    import { Toaster } from '$lib/components/ui/sonner';
    import { ModeWatcher } from 'mode-watcher';
    import '../app.css';

    let { children } = $props();
</script>

<ModeWatcher />
<Toaster />

<svelte:head>
    <link rel="icon" href="/noteblock.png" />
    <title>Noteblock Studio Next</title>
    <meta
        name="description"
        content="A modern, web-based music editor for Minecraft Note Block musics."
    />

    <!-- OpenGraph meta tags -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Noteblock Studio Next" />
    <meta
        property="og:description"
        content="A modern, web-based music editor for Minecraft Note Block musics."
    />
    <meta property="og:site_name" content="noteblock-studio-next.vercel.app" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card meta tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Noteblock Studio Next" />
    <meta
        name="twitter:description"
        content="A modern, web-based music editor for Minecraft Note Block musics."
    />
    <meta name="twitter:url" content="https://ns.nath.tw" />
    <meta name="twitter:site" content="@noteblock-studio-next" />
</svelte:head>

{@render children?.()}
