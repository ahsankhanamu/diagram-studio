<script lang="ts">
	import BaseNode from './BaseNode.svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();
</script>

<BaseNode {id} {data} {selected} color="var(--color-node-flowchart)" />
