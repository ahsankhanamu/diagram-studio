<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { updateNode } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || 'Group');

	let editing = $state(false);
	let editValue = $state('');

	function startEdit() {
		editValue = label;
		editing = true;
	}

	function commitEdit() {
		editing = false;
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== label) {
			pushHistory();
			updateNode(id, { label: trimmed });
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
		if (e.key === 'Escape') { editing = false; }
	}

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={200}
	minHeight={150}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: var(--color-accent);"
	handleStyle="width: 8px; height: 8px; background: var(--color-accent); border: 2px solid var(--color-bg-surface); border-radius: 50%;"
/>

<div
	class="h-full w-full rounded-lg border-2"
	style="
		pointer-events: none;
		border-style: dashed;
		border-color: {selected ? 'var(--color-accent)' : 'var(--color-text-muted)'};
		background: color-mix(in srgb, var(--color-accent) 5%, transparent);
	"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="group-drag-handle flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold"
		style="pointer-events: auto; color: {selected ? 'var(--color-accent)' : 'var(--color-text-secondary)'}; background: color-mix(in srgb, var(--color-accent) 8%, transparent);"
		class:cursor-text={editing}
		class:cursor-grab={!editing}
		ondblclick={startEdit}
	>
		{#if editing}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				autofocus
				class="group-name-input"
				value={editValue}
				oninput={(e) => (editValue = (e.target as HTMLInputElement).value)}
				onblur={commitEdit}
				onkeydown={handleKeydown}
			/>
		{:else}
			{label}
		{/if}
	</div>
</div>

<style>
	/* The group body has pointer-events:none so clicks pass through to children.
	   Restore pointer-events on resize handles and the resize control lines. */
	:global(.svelte-flow__node-group .svelte-flow__resize-control) {
		pointer-events: auto !important;
	}
	:global(.svelte-flow__node-group .svelte-flow__resize-control.line) {
		pointer-events: auto !important;
	}

	.group-name-input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--color-accent);
		outline: none;
		font: inherit;
		color: inherit;
		padding: 0;
		margin: 0;
		width: 100%;
		min-width: 60px;
	}
</style>
