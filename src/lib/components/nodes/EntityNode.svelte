<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import NodeHandles from './NodeHandles.svelte';
	import { updateNode } from '$lib/stores/diagramStore';
	import type { ErdField } from '$lib/types/diagram';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || '');
	const fields = $derived((data.fields as ErdField[]) || []);
	const color = 'var(--color-node-erd)';
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);

	const KEY_STYLE: Record<string, { bg: string; text: string }> = {
		pk: { bg: 'rgba(245,158,11,0.18)', text: '#b45309' },
		fk: { bg: 'rgba(59,130,246,0.18)',  text: '#1d4ed8' },
		uk: { bg: 'rgba(139,92,246,0.18)',   text: '#6d28d9' },
	};

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={140}
	minHeight={50}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="relative overflow-hidden rounded-lg border"
	style="
		background: var(--color-bg-surface);
		border-color: {selected ? color : 'var(--color-border-primary)'};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
	"
>
	<!-- Header -->
	<div
		class="flex items-center gap-1.5 border-b px-2.5 py-1.5"
		style="background: linear-gradient(135deg, color-mix(in srgb, {color} 10%, transparent), color-mix(in srgb, {color} 4%, transparent)); border-color: var(--color-border-subtle);"
	>
		<svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="color: {color}; flex-shrink: 0;">
			<rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
			<line x1="0.5" y1="4" x2="11.5" y2="4" stroke="currentColor" stroke-width="1.2"/>
			<line x1="4.5" y1="4" x2="4.5" y2="11.5" stroke="currentColor" stroke-width="1.2"/>
		</svg>
		<span class="text-sm font-semibold" style="color: {color};">{label}</span>
	</div>

	<!-- Fields table -->
	{#if fields.length > 0}
		<div>
			{#each fields as field, i}
				<div
					class="flex items-center gap-1 px-2"
					style="min-height: 22px; border-top: {i > 0 ? '1px solid var(--color-border-subtle)' : 'none'};"
				>
					<!-- Key badge (fixed 26px column) -->
					<div class="shrink-0" style="width: 26px;">
						{#if field.key && KEY_STYLE[field.key]}
							<span
								class="inline-block rounded px-1 text-[9px] font-bold uppercase leading-4"
								style="background: {KEY_STYLE[field.key].bg}; color: {KEY_STYLE[field.key].text};"
							>{field.key}</span>
						{/if}
					</div>
					<!-- Field name -->
					<span class="min-w-0 flex-1 truncate text-xs" style="color: var(--color-text-primary);">{field.name}</span>
					<!-- Field type -->
					<span class="shrink-0 text-[10px] font-mono" style="color: var(--color-text-muted); max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{field.type}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="px-2.5 py-1.5 text-xs" style="color: var(--color-text-muted);">No fields</div>
	{/if}

	<NodeHandles {ports} {color} nodeId={id} />
</div>
