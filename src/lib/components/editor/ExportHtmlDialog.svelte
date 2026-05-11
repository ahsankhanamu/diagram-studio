<script lang="ts">
	import { Globe, X, CheckSquare, Square, GripVertical } from 'lucide-svelte';
	import type { DiagramFile, DiagramNode } from '$lib/types/diagram';

	interface FileOption {
		name: string;
		fileName: string;
		diagramType: string;
		diagram: DiagramFile;
		checked: boolean;
	}

	interface Props {
		files: FileOption[];
		onExport: (selected: DiagramFile[]) => void;
		onClose: () => void;
	}

	let { files, onExport, onClose }: Props = $props();

	let items = $state(files.map((f) => ({ ...f })));

	const allChecked = $derived(items.every((i) => i.checked));
	const someChecked = $derived(items.some((i) => i.checked));
	const checkedCount = $derived(items.filter((i) => i.checked).length);

	let dragIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, idx: number) {
		dragIndex = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(idx));
		}
	}

	function handleDragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverIndex = idx;
	}

	function handleDrop(e: DragEvent, targetIdx: number) {
		e.preventDefault();
		if (dragIndex === null || dragIndex === targetIdx) {
			dragIndex = null;
			dragOverIndex = null;
			return;
		}
		const reordered = [...items];
		const [moved] = reordered.splice(dragIndex, 1);
		reordered.splice(targetIdx, 0, moved);
		items = reordered;
		dragIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		dragIndex = null;
		dragOverIndex = null;
	}

	function toggleAll() {
		const next = !allChecked;
		items = items.map((i) => ({ ...i, checked: next }));
	}

	function toggle(idx: number) {
		items = items.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item));
	}

	function handleExport() {
		const selected = items.filter((i) => i.checked).map((i) => i.diagram);
		if (selected.length > 0) onExport(selected);
	}

	const TYPE_LABELS: Record<string, string> = {
		flowchart: 'Flowchart',
		architecture: 'Architecture',
		erd: 'ERD',
		workflow: 'Workflow'
	};

	// Simple inline SVG thumbnail showing node layout
	function renderThumbnail(nodes: DiagramNode[]): string {
		if (!nodes || nodes.length === 0) return '';
		const THUMB_W = 120;
		const THUMB_H = 50;
		const PAD = 6;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const n of nodes) {
			if (n.type === 'group') continue;
			const w = n.size?.width ?? 160;
			const h = n.size?.height ?? 50;
			minX = Math.min(minX, n.position.x);
			minY = Math.min(minY, n.position.y);
			maxX = Math.max(maxX, n.position.x + w);
			maxY = Math.max(maxY, n.position.y + h);
		}
		if (!isFinite(minX)) return '';

		const bbW = maxX - minX || 1;
		const bbH = maxY - minY || 1;
		const scale = Math.min((THUMB_W - PAD * 2) / bbW, (THUMB_H - PAD * 2) / bbH);

		let svg = `<svg width="${THUMB_W}" height="${THUMB_H}" xmlns="http://www.w3.org/2000/svg"><rect width="${THUMB_W}" height="${THUMB_H}" rx="3" fill="var(--color-bg-surface-secondary, #f3f4f6)"/>`;
		for (const n of nodes) {
			if (n.type === 'group') continue;
			const w = n.size?.width ?? 160;
			const h = n.size?.height ?? 50;
			const x = PAD + (n.position.x - minX) * scale;
			const y = PAD + (n.position.y - minY) * scale;
			const rw = Math.max(w * scale, 3);
			const rh = Math.max(h * scale, 2);
			svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="2" fill="var(--color-accent, #2563eb)" opacity="0.7"/>`;
		}
		svg += '</svg>';
		return svg;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center"
	style="background: rgba(0,0,0,0.4);"
	onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
>
	<div
		class="flex w-[720px] max-h-[85vh] flex-col rounded-xl border shadow-2xl"
		style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
	>
		<!-- Header -->
		<div
			class="flex items-center gap-3 border-b px-5 py-4"
			style="border-color: var(--color-border-primary);"
		>
			<Globe size={18} style="color: var(--color-accent);" />
			<div class="flex-1">
				<p class="text-sm font-semibold" style="color: var(--color-text-primary);">Export as HTML</p>
				<p class="text-xs" style="color: var(--color-text-muted);">
					Select &amp; reorder diagrams · {checkedCount} of {items.length} selected
				</p>
			</div>
			<button
				onclick={onClose}
				class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
				style="color: var(--color-text-muted);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<X size={15} />
			</button>
		</div>

		<!-- Select all row -->
		<div
			class="flex items-center gap-2.5 border-b px-5 py-2.5"
			style="border-color: var(--color-border-subtle); background: var(--color-bg-surface-secondary);"
		>
			<button onclick={toggleAll} class="flex items-center gap-2 text-xs font-medium" style="color: var(--color-text-secondary);">
				{#if allChecked}
					<CheckSquare size={14} style="color: var(--color-accent);" />
				{:else}
					<Square size={14} />
				{/if}
				{allChecked ? 'Deselect all' : 'Select all'}
			</button>
		</div>

		<!-- File list -->
		<div class="flex-1 overflow-y-auto py-1">
			{#each items as item, idx}
				{@const isDragging = dragIndex === idx}
				{@const isDragOver = dragOverIndex === idx && dragIndex !== idx}
				<div
					class="flex w-full items-center gap-2.5 px-5 py-2.5 transition-colors select-none"
					draggable={items.length > 1}
					ondragstart={(e) => handleDragStart(e, idx)}
					ondragover={(e) => handleDragOver(e, idx)}
					ondrop={(e) => handleDrop(e, idx)}
					ondragend={handleDragEnd}
					role="listitem"
					style="opacity: {isDragging ? 0.4 : 1}; {isDragOver ? 'border-top: 2px solid var(--color-accent);' : ''}"
					onmouseenter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)'; }}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					<div
						class="flex-shrink-0 cursor-grab active:cursor-grabbing"
						style="color: var(--color-text-muted); opacity: {items.length > 1 ? 0.4 : 0.15};"
					>
						<GripVertical size={14} />
					</div>

					<button onclick={() => toggle(idx)} class="flex-shrink-0">
						{#if item.checked}
							<CheckSquare size={15} style="color: var(--color-accent);" />
						{:else}
							<Square size={15} style="color: var(--color-text-muted);" />
						{/if}
					</button>

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm" style="color: var(--color-text-primary);">{item.name}</p>
						<p class="text-[11px]" style="color: var(--color-text-muted);">{item.fileName}</p>
					</div>
					{@const thumb = renderThumbnail(item.diagram.nodes)}
					{#if thumb}
						<div class="shrink-0 rounded border overflow-hidden" style="border-color: var(--color-border-subtle); height: 50px;">
							{@html thumb}
						</div>
					{/if}
					<span
						class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
						style="background: var(--color-accent-light); color: var(--color-accent);"
					>
						{TYPE_LABELS[item.diagramType] ?? item.diagramType}
					</span>
				</div>
			{/each}
		</div>

		<!-- Footer -->
		<div
			class="flex items-center justify-end gap-2 border-t px-5 py-3"
			style="border-color: var(--color-border-primary);"
		>
			<button
				onclick={onClose}
				class="rounded-lg px-4 py-1.5 text-sm transition-colors"
				style="color: var(--color-text-secondary);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				Cancel
			</button>
			<button
				onclick={handleExport}
				disabled={checkedCount === 0}
				class="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-40"
				style="background: var(--color-accent);"
			>
				Export {checkedCount > 0 ? `${checkedCount} diagram${checkedCount !== 1 ? 's' : ''}` : ''}
			</button>
		</div>
	</div>
</div>