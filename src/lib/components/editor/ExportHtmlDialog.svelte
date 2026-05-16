<script lang="ts">
	import { Globe, X, CheckSquare, Square, GripVertical } from 'lucide-svelte';
	import type { DiagramFile } from '$lib/types/diagram';
	import { generatePreviewHtml } from '$lib/engine/export';

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

	const TYPE_COLORS: Record<string, string> = {
		flowchart: '#3b82f6',
		architecture: '#6366f1',
		erd: '#f59e0b',
		workflow: '#10b981'
	};

	// ── Preview pane ──────────────────────────────────────────────────────
	let selectedIndex = $state<number | null>(null);

	function selectDiagram(idx: number) {
		selectedIndex = selectedIndex === idx ? null : idx;
	}

	const previewItem = $derived(selectedIndex !== null ? items[selectedIndex] : null);

	const previewSrcdoc = $derived(
		previewItem !== null ? generatePreviewHtml(previewItem.diagram) : ''
	);
</script>

<!-- Full-screen overlay -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex"
	style="background: rgba(0,0,0,0.55);"
	onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
>
	<!-- Panel — fills most of the screen -->
	<div
		class="m-auto flex w-[92vw] max-w-[1400px] flex-col overflow-hidden rounded-xl shadow-2xl"
		style="height: 90vh; background: var(--color-bg-surface); border: 1px solid var(--color-border-primary);"
	>
		<!-- Header bar -->
		<div
			class="flex shrink-0 items-center gap-3 border-b px-5 py-3"
			style="border-color: var(--color-border-primary); background: var(--color-bg-surface);"
		>
			<Globe size={16} style="color: var(--color-accent); flex-shrink: 0;" />
			<span class="text-sm font-semibold" style="color: var(--color-text-primary);">Export as HTML</span>
			<span class="text-xs" style="color: var(--color-text-muted);">·</span>
			<span class="text-xs" style="color: var(--color-text-muted);">
				{checkedCount} of {items.length} diagram{items.length !== 1 ? 's' : ''} selected
			</span>
			<div class="flex-1"></div>
			<button
				onclick={onClose}
				class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
				style="color: var(--color-text-muted);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				title="Close"
			>
				<X size={15} />
			</button>
		</div>

		<!-- Body: sidebar + viewer -->
		<div class="flex min-h-0 flex-1">
			<!-- ── Left sidebar ───────────────────────────────────────── -->
			<div
				class="flex w-64 shrink-0 flex-col border-r"
				style="border-color: var(--color-border-primary); background: var(--color-bg-surface-secondary);"
			>
				<!-- Select-all row -->
				<div
					class="flex shrink-0 items-center gap-2 border-b px-3 py-2"
					style="border-color: var(--color-border-subtle);"
				>
					<button
						onclick={toggleAll}
						class="flex items-center gap-2 text-[11px] font-medium transition-colors"
						style="color: var(--color-text-muted);"
					>
						{#if allChecked}
							<CheckSquare size={13} style="color: var(--color-accent);" />
						{:else}
							<Square size={13} />
						{/if}
						{allChecked ? 'Deselect all' : 'Select all'}
					</button>
					<div class="flex-1"></div>
					<span class="text-[11px] tabular-nums" style="color: var(--color-text-muted);">{items.length}</span>
				</div>

				<!-- Diagram list -->
				<div class="min-h-0 flex-1 overflow-y-auto py-0.5">
					{#each items as item, idx}
						{@const isActive = selectedIndex === idx}
						{@const isDragging = dragIndex === idx}
						{@const isDragOver = dragOverIndex === idx && dragIndex !== idx}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="group flex w-full items-center gap-1.5 px-2 py-2 select-none"
							draggable={items.length > 1}
							ondragstart={(e) => handleDragStart(e, idx)}
							ondragover={(e) => handleDragOver(e, idx)}
							ondrop={(e) => handleDrop(e, idx)}
							ondragend={handleDragEnd}
							role="button"
							tabindex="0"
							style="
								opacity: {isDragging ? 0.35 : 1};
								{isDragOver ? 'border-top: 2px solid var(--color-accent);' : ''}
								{isActive ? 'background: var(--color-accent-light);' : ''}
								cursor: pointer;
							"
							onclick={() => selectDiagram(idx)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDiagram(idx); } }}
							onmouseenter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)'; }}
							onmouseleave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
						>
							<!-- Drag handle -->
							<div
								class="shrink-0 cursor-grab active:cursor-grabbing"
								style="color: var(--color-text-muted); opacity: {items.length > 1 ? 0.35 : 0.1};"
								onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => e.stopPropagation()}
							role="button"
							tabindex="-1"
							aria-label="Drag to reorder"
							>
								<GripVertical size={13} />
							</div>

							<!-- Checkbox -->
							<button
								class="shrink-0"
								onclick={(e) => { e.stopPropagation(); toggle(idx); }}
							>
								{#if item.checked}
									<CheckSquare size={14} style="color: var(--color-accent);" />
								{:else}
									<Square size={14} style="color: var(--color-text-muted); opacity: 0.5;" />
								{/if}
							</button>

							<!-- Type color dot -->
							<div
								class="shrink-0 rounded-full"
								style="width: 7px; height: 7px; background: {TYPE_COLORS[item.diagramType] ?? 'var(--color-accent)'};"
							></div>

							<!-- Name + filename -->
							<div class="min-w-0 flex-1">
								<p
									class="truncate text-xs font-medium leading-tight"
									style="color: {isActive ? 'var(--color-accent)' : 'var(--color-text-primary)'};"
								>{item.name}</p>
								<p class="truncate text-[10px] leading-tight mt-0.5" style="color: var(--color-text-muted);">{item.fileName}</p>
							</div>

							<!-- Type badge -->
							<span
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
								style="background: color-mix(in srgb, {TYPE_COLORS[item.diagramType] ?? 'var(--color-accent)'} 12%, transparent); color: {TYPE_COLORS[item.diagramType] ?? 'var(--color-accent)'};"
							>
								{TYPE_LABELS[item.diagramType] ?? item.diagramType}
							</span>
						</div>
					{/each}
				</div>

				<!-- Footer actions -->
				<div
					class="flex shrink-0 items-center gap-2 border-t px-3 py-3"
					style="border-color: var(--color-border-primary);"
				>
					<button
						onclick={onClose}
						class="rounded-lg px-3 py-1.5 text-xs transition-colors"
						style="color: var(--color-text-secondary);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					>
						Cancel
					</button>
					<button
						onclick={handleExport}
						disabled={checkedCount === 0}
						class="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
						style="background: var(--color-accent);"
					>
						Export {checkedCount > 0 ? `${checkedCount} diagram${checkedCount !== 1 ? 's' : ''}` : ''}
					</button>
				</div>
			</div>

			<!-- ── Right viewer pane ──────────────────────────────────── -->
			<div class="relative flex min-h-0 flex-1 flex-col" style="background: var(--color-bg-canvas, #f7f6f3);">
				{#if previewItem !== null}
					<!-- Pane header -->
					<div
						class="flex shrink-0 items-center gap-2 border-b px-4 py-2"
						style="border-color: var(--color-border-subtle); background: var(--color-bg-surface);"
					>
						<div
							class="shrink-0 rounded-full"
							style="width: 8px; height: 8px; background: {TYPE_COLORS[previewItem.diagramType] ?? 'var(--color-accent)'};"
						></div>
						<span class="text-xs font-medium truncate" style="color: var(--color-text-primary);">{previewItem.name}</span>
						<span
							class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
							style="background: color-mix(in srgb, {TYPE_COLORS[previewItem.diagramType] ?? 'var(--color-accent)'} 12%, transparent); color: {TYPE_COLORS[previewItem.diagramType] ?? 'var(--color-accent)'};"
						>
							{TYPE_LABELS[previewItem.diagramType] ?? previewItem.diagramType}
						</span>
					</div>

					<!-- Iframe viewer — real renderer + viewer scripts -->
					{#key selectedIndex}
						<iframe
							srcdoc={previewSrcdoc}
							class="min-h-0 flex-1 w-full border-none"
							title="Diagram preview"
							sandbox="allow-scripts"
						></iframe>
					{/key}
				{:else}
					<!-- Empty state -->
					<div class="flex flex-1 items-center justify-center">
						<div class="text-center">
							<Globe size={36} style="color: var(--color-text-muted); opacity: 0.2; margin: 0 auto 10px;" />
							<p class="text-sm font-medium" style="color: var(--color-text-muted); opacity: 0.5;">Click a diagram to preview</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
