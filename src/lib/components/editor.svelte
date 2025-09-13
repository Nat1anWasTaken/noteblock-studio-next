<script>
	import { test } from '$lib/playback';
	import Button from './ui/button/button.svelte';

	function handleClick() {
		test();
	}
</script>

<Button onclick={handleClick} />
