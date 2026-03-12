<script lang="ts">
	import BaseNode from './BaseNode.svelte';
	import EditableLabel from './EditableLabel.svelte';
	import { ListOrdered } from 'lucide-svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();
	const color = 'var(--color-node-queue)';
</script>

<BaseNode {id} {data} {selected} {color}>
	{#snippet children()}
		<div class="flex items-center gap-2 rounded-t-lg border-b px-3 py-2" style="background: linear-gradient(135deg, color-mix(in srgb, {color} 12%, var(--color-bg-surface)), color-mix(in srgb, {color} 4%, var(--color-bg-surface))); border-color: var(--color-border-subtle);">
			<div class="flex h-5 w-5 items-center justify-center rounded" style="background: color-mix(in srgb, {color} 25%, transparent); color: {color};">
				<ListOrdered size={11} />
			</div>
			<EditableLabel {id} label={data.label as string || ''} class="flex-1 min-w-0 text-sm font-semibold leading-snug" style="color: var(--color-text-primary); overflow-wrap: break-word;" />
		</div>
		{#if data.description}
		<div class="px-3 py-1.5">
			<p class="text-xs leading-snug" style="color: var(--color-text-muted);">{data.description}</p>
		</div>
		{/if}
	{/snippet}
</BaseNode>
