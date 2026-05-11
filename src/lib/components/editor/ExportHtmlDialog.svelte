<script lang="ts">
	import { Globe, X, CheckSquare, Square, GripVertical, Maximize2 } from 'lucide-svelte';
	import type { DiagramFile, DiagramNode, DiagramEdge } from '$lib/types/diagram';

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

	const NODE_FILL: Record<string, string> = {
		process: 'var(--color-node-flowchart, #3b82f6)',
		decision: 'var(--color-node-decision, #f59e0b)',
		terminal: 'var(--color-node-terminal, #6b7280)',
		io: 'var(--color-node-io, #8b5cf6)',
		document: 'var(--color-node-document, #ef4444)',
		service: 'var(--color-node-service, #6366f1)',
		database: 'var(--color-node-database, #10b981)',
		queue: 'var(--color-node-queue, #f97316)',
		api: 'var(--color-node-api, #ec4899)',
		user: 'var(--color-node-user, #14b8a6)',
		entity: 'var(--color-node-erd, #3b82f6)',
		workflow: 'var(--color-node-workflow, #06b6d4)',
	};

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
		if (!isFinite(minX)) return '<svg width="120" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="50" rx="3" fill="var(--color-bg-surface-secondary, #f3f4f6)"/><text x="60" y="28" text-anchor="middle" fill="var(--color-text-muted, #9ca3af)" font-size="10" font-family="sans-serif">No nodes</text></svg>';

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
			const fill = NODE_FILL[n.type] || 'var(--color-accent, #2563eb)';
			svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="2" fill="${fill}" opacity="0.8"/>`;
		}
		svg += '</svg>';
		return svg;
	}

	// ── Split-pane preview ──────────────────────────────────────────

	let selectedIndex = $state<number | null>(null);
	let previewZoom = $state(1);
	let previewPx = $state(0);
	let previewPy = $state(0);
	let previewSvgW = $state(0);
	let previewSvgH = $state(0);
	let panning = $state(false);
	let panStartX = 0;
	let panStartY = 0;
	let panInitPx = 0;
	let panInitPy = 0;

	function selectDiagram(idx: number) {
		if (selectedIndex === idx) { selectedIndex = null; return; }
		selectedIndex = idx;
		previewZoom = 1;
		previewPx = 0;
		previewPy = 0;
	}

	function fitPreview(w: number, h: number) {
		const container = document.getElementById('ds-preview-pane');
		if (!container) return;
		const cw = container.clientWidth - 16;
		const ch = container.clientHeight - 16;
		const s = Math.min(cw / previewSvgW, ch / previewSvgH) * 0.92;
		previewZoom = s;
		previewPx = (cw - previewSvgW * s) / 2;
		previewPy = (ch - previewSvgH * s) / 2;
	}

	function handlePreviewWheel(e: WheelEvent) {
		e.preventDefault();
		const container = document.getElementById('ds-preview-pane');
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
		const ns = Math.min(Math.max(previewZoom * delta, 0.1), 6);
		previewPx = mx - (mx - previewPx) * (ns / previewZoom);
		previewPy = my - (my - previewPy) * (ns / previewZoom);
		previewZoom = ns;
	}

	function handlePreviewMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		panning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panInitPx = previewPx;
		panInitPy = previewPy;
		document.addEventListener('mousemove', handlePanMove);
		document.addEventListener('mouseup', handlePanUp);
	}

	function handlePanMove(e: MouseEvent) {
		if (!panning) return;
		previewPx = panInitPx + (e.clientX - panStartX);
		previewPy = panInitPy + (e.clientY - panStartY);
	}

	function handlePanUp() {
		panning = false;
		document.removeEventListener('mousemove', handlePanMove);
		document.removeEventListener('mouseup', handlePanUp);
	}

	const previewDiagram = $derived(selectedIndex !== null ? items[selectedIndex] : null);

	function renderLargePreview(diagram: DiagramFile): string {
		const nodes = diagram.nodes;
		const edges = diagram.edges;
		if (!nodes || nodes.length === 0) return '';

		const PAD = 20;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		const nodeMap = new Map<string, DiagramNode>();
		for (const n of nodes) {
			nodeMap.set(n.id, n);
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
		const W = previewSvgW || 600;
		const H = previewSvgH || 400;
		const scale = Math.min((W - PAD * 2) / bbW, (H - PAD * 2) / bbH);

		function tx(x: number) { return PAD + (x - minX) * scale; }
		function ty(y: number) { return PAD + (y - minY) * scale; }

		let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
		svg += `<rect width="${W}" height="${H}" fill="var(--color-bg-canvas, #f9fafb)"/>`;

		// Edges
		for (const e of edges) {
			const src = nodeMap.get(e.source);
			const tgt = nodeMap.get(e.target);
			if (!src || !tgt) continue;
			const sw = src.size?.width ?? 160;
			const sh = src.size?.height ?? 50;
			const tw = tgt.size?.width ?? 160;
			const th = tgt.size?.height ?? 50;
			const x1 = tx(src.position.x + sw / 2);
			const y1 = ty(src.position.y + sh / 2);
			const x2 = tx(tgt.position.x + tw / 2);
			const y2 = ty(tgt.position.y + th / 2);
			svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--color-edge, #94a3b8)" stroke-width="1.5"/>`;
		}

		// Nodes
		for (const n of nodes) {
			if (n.type === 'group') continue;
			const w = n.size?.width ?? 160;
			const h = n.size?.height ?? 50;
			const x = tx(n.position.x);
			const y = ty(n.position.y);
			const rw = Math.max(w * scale, 6);
			const rh = Math.max(h * scale, 4);
			const fill = NODE_FILL[n.type] || 'var(--color-accent, #2563eb)';
			svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="${(3*scale).toFixed(1)}" fill="${fill}" opacity="0.85"/>`;
			// Label — render if text would be at least 6px
			if (rh > 10 && rw > 20) {
				const fs = Math.min(rh * 0.4, rw * 0.08, 12);
				if (fs > 4) {
					const label = (n.label || n.type || '').slice(0, Math.floor(rw / (fs * 0.6)));
					svg += `<text x="${(x + rw/2).toFixed(1)}" y="${(y + rh/2 + fs/3).toFixed(1)}" text-anchor="middle" fill="white" font-size="${fs.toFixed(1)}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="500">${escapeXml(label)}</text>`;
				}
			}
		}
		svg += '</svg>';
		return svg;
	}

	function escapeXml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	// Determine dialog width based on selection
	const dialogWidth = $derived(selectedIndex !== null ? 'w-[960px]' : 'w-[720px]');
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
		class="flex max-h-[85vh] flex-col rounded-xl border shadow-2xl transition-all duration-200 {dialogWidth}"
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

		<!-- Body: split if preview active -->
		<div class="flex flex-1 min-h-0">
			<!-- Left: list -->
			<div class="flex flex-col min-h-0 {selectedIndex !== null ? 'w-[360px] border-r' : 'flex-1'}" style="border-color: var(--color-border-subtle);">
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
						{@const isSelected = selectedIndex === idx}
						{@const isDragging = dragIndex === idx}
						{@const isDragOver = dragOverIndex === idx && dragIndex !== idx}
						<div
							class="flex w-full items-center gap-2.5 px-5 py-2.5 transition-colors select-none"
							class:ring-1={isSelected}
							class:ring-inset={isSelected}
							draggable={items.length > 1}
							ondragstart={(e) => handleDragStart(e, idx)}
							ondragover={(e) => handleDragOver(e, idx)}
							ondrop={(e) => handleDrop(e, idx)}
							ondragend={handleDragEnd}
							role="listitem"
							style="opacity: {isDragging ? 0.4 : 1}; {isDragOver ? 'border-top: 2px solid var(--color-accent);' : ''}{isSelected ? '--tw-ring-color: var(--color-accent); background: var(--color-accent-light);' : ''}"
							onmouseenter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? 'var(--color-accent-light)' : 'var(--color-hover-overlay)'; }}
							onmouseleave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
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

							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="min-w-0 flex-1 cursor-pointer"
								onclick={() => selectDiagram(idx)}
								onkeydown={(e) => { if (e.key === 'Enter') selectDiagram(idx); }}
							>
								<p class="truncate text-sm" style="color: var(--color-text-primary);">{item.name}</p>
								<p class="text-[11px]" style="color: var(--color-text-muted);">{item.fileName}</p>
							</div>
							{#if item.diagram.nodes.length > 0}
								<div class="shrink-0 rounded border overflow-hidden" style="border-color: var(--color-border-subtle); height: 50px;">
									{@html renderThumbnail(item.diagram.nodes)}
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
			</div>

			<!-- Right: preview pane -->
			{#if previewDiagram !== null}
				<div class="flex-1 flex flex-col min-h-0">
					<div
						class="flex items-center gap-2 border-b px-4 py-2"
						style="border-color: var(--color-border-subtle); background: var(--color-bg-surface-secondary);"
					>
						<span class="text-xs font-medium truncate" style="color: var(--color-text-primary);">{previewDiagram.name}</span>
						<span class="text-[10px]" style="color: var(--color-text-muted);">{TYPE_LABELS[previewDiagram.diagramType] ?? previewDiagram.diagramType}</span>
						<div class="flex-1"></div>
						<button
							onclick={() => fitPreview(0, 0)}
							class="flex h-6 w-6 items-center justify-center rounded transition-colors"
							style="color: var(--color-text-muted);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
							onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
							title="Fit to view"
						>
							<Maximize2 size={13} />
						</button>
					</div>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						id="ds-preview-pane"
						class="flex-1 overflow-hidden"
						class:cursor-grab={!panning}
						class:cursor-grabbing={panning}
						style="background: var(--color-bg-canvas, #f9fafb);"
						onwheel={handlePreviewWheel}
						onmousedown={handlePreviewMouseDown}
					>
						{#key selectedIndex}
							{@const svgHtml = renderLargePreview(previewDiagram.diagram)}
							{#if svgHtml}
								<div
									style="transform-origin: 0 0; transform: translate({previewPx}px, {previewPy}px) scale({previewZoom});"
								>
									{@html svgHtml}
								</div>
							{/if}
						{/key}
					</div>
				</div>
			{:else}
				<!-- Empty preview state -->
				<div class="flex-1 flex items-center justify-center" style="background: var(--color-bg-canvas, #f9fafb);">
					<div class="text-center">
						<Globe size={32} style="color: var(--color-text-muted); opacity: 0.3;" class="mx-auto mb-2" />
						<p class="text-xs" style="color: var(--color-text-muted);">Click a diagram to preview</p>
					</div>
				</div>
			{/if}
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