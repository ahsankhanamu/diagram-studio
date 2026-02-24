<script lang="ts">
	import BaseNode from './BaseNode.svelte';
	import { Globe } from 'lucide-svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();
	const color = 'var(--color-node-architecture)';
</script>

<BaseNode {id} {data} {selected} {color}>
	{#snippet children()}
		<div class="flex items-center gap-2 rounded-t-lg border-b px-3 py-2" style="background: color-mix(in srgb, {color} 8%, var(--color-bg-surface)); border-color: var(--color-border-subtle);">
			<div class="flex h-5 w-5 items-center justify-center rounded" style="background: color-mix(in srgb, {color} 20%, transparent); color: {color};">
				<Globe size={11} />
			</div>
			<span class="flex-1 truncate text-xs font-medium" style="color: var(--color-text-primary);">{data.label}</span>
		</div>
		<div class="px-3 py-1.5">
			<p class="text-[10px]" style="color: var(--color-text-muted);">{data.description || 'API'}</p>
		</div>
	{/snippet}
</BaseNode>
