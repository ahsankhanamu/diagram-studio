<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlow, SvelteFlowProvider } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { DiagramFile } from '$lib/types/diagram';
	import { nodeTypes } from '$lib/components/nodes';
	import { edgeTypes } from '$lib/components/edges';
	import {
		nodes,
		edges,
		nodeList,
		edgeList,
		diagramMeta
	} from '$lib/stores/diagramStore';
	import { toFlowNodes, toFlowEdges } from '$lib/engine/serializer';
	import { renderToCanvas } from '$lib/engine/canvas-renderer';
	import { ZOOM_MIN, ZOOM_MAX } from '$lib/constants';
	import { get } from 'svelte/store';
	import PreviewFitView from './PreviewFitView.svelte';

	type Mode = 'dropzone' | 'loading' | 'interactive' | 'export' | 'error';

	let mode = $state<Mode>('loading');
	let errorMsg = $state('');
	let diagramName = $state('');
	let dragOver = $state(false);
	let exportPngSrc = $state('');
	let currentDiagram = $state<DiagramFile | null>(null);

	const flowNodes = $derived(toFlowNodes($nodeList));
	const flowEdges = $derived(toFlowEdges($edgeList));
	const PRO_OPTIONS = { hideAttribution: true } as const;

	// Determine mode from query params
	// ?path=... → load from API (interactive preview or export)
	// ?path=...&export=true → render canvas PNG export
	// no params → show drop zone
	let exportMode = false;
	let autoDownload = false;

	function loadDiagramStores(diagram: DiagramFile) {
		const nodeMap = new Map();
		for (const n of diagram.nodes) nodeMap.set(n.id, n);
		nodes.set(nodeMap);

		const edgeMap = new Map();
		for (const e of diagram.edges) edgeMap.set(e.id, e);
		edges.set(edgeMap);

		diagramMeta.set({
			id: diagram.id,
			name: diagram.name,
			description: diagram.description,
			diagramType: diagram.diagramType,
			version: diagram.version,
			metadata: diagram.metadata
		});

		diagramName = diagram.name;
		currentDiagram = diagram;
	}

	async function loadFromApi(filePath: string) {
		mode = 'loading';
		try {
			const res = await fetch(`/api/diagram?path=${encodeURIComponent(filePath)}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: res.statusText }));
				throw new Error(body.message || `HTTP ${res.status}`);
			}
			const diagram: DiagramFile = await res.json();
			loadDiagramStores(diagram);
			mode = exportMode ? 'export' : 'interactive';

			if (exportMode) {
				await renderExportPng(diagram);
			}
		} catch (err: any) {
			errorMsg = err.message || 'Failed to load diagram';
			mode = 'error';
		}
	}

	async function loadFromFile(file: File) {
		if (!file.name.endsWith('.json')) {
			errorMsg = 'Please drop a .json diagram file';
			mode = 'error';
			return;
		}

		try {
			const text = await file.text();
			const diagram: DiagramFile = JSON.parse(text);
			if (diagram.$schema !== 'diagram-studio/diagram-v1') {
				errorMsg = 'Not a valid Diagram Studio file (missing $schema)';
				mode = 'error';
				return;
			}
			loadDiagramStores(diagram);
			mode = 'export';
			await renderExportPng(diagram);
		} catch (err: any) {
			errorMsg = err.message || 'Failed to parse diagram';
			mode = 'error';
		}
	}

	async function renderExportPng(diagram: DiagramFile) {
		await new Promise((r) => setTimeout(r, 50));
		try {
			const canvas = renderToCanvas(diagram.nodes, diagram.edges, { scale: 2, padding: 60 });
			exportPngSrc = canvas.toDataURL('image/png');

			// Expose for Playwright automation
			(window as any).__EXPORT_PNG__ = exportPngSrc;
			(window as any).__DIAGRAM_PNG__ = exportPngSrc;
			document.body.setAttribute('data-diagram-ready', 'true');
			document.body.setAttribute('data-export-ready', 'true');

			if (autoDownload) downloadPng();
		} catch (err: any) {
			errorMsg = `Render failed: ${err.message}`;
			mode = 'error';
		}
	}

	function downloadPng() {
		if (!exportPngSrc) return;
		const a = document.createElement('a');
		a.href = exportPngSrc;
		a.download = `${diagramName || 'diagram'}.png`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function resetToDropzone() {
		mode = 'dropzone';
		exportPngSrc = '';
		diagramName = '';
		errorMsg = '';
		currentDiagram = null;
	}

	function handleDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
	function handleDragLeave() { dragOver = false; }

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		errorMsg = '';
		const file = e.dataTransfer?.files?.[0];
		if (file) await loadFromFile(file);
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) await loadFromFile(file);
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const filePath = params.get('path');
		exportMode = params.has('export') || params.has('download');
		autoDownload = params.get('download') === 'true';

		if (filePath) {
			await loadFromApi(filePath);
		} else {
			mode = 'dropzone';
		}
	});
</script>

<svelte:head>
	<title>{diagramName || 'Preview'} — Diagram Studio</title>
</svelte:head>

{#if mode === 'error'}
	<div class="flex h-screen flex-col items-center justify-center gap-4" style="background: var(--color-canvas-bg, #fafaf5);">
		<div class="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
			<h2 class="mb-1 text-lg font-semibold">Error</h2>
			<p class="text-sm">{errorMsg}</p>
		</div>
		<button
			onclick={resetToDropzone}
			class="text-sm underline"
			style="color: var(--color-text-muted, #94a3b8);"
		>
			Try another file
		</button>
	</div>

{:else if mode === 'loading'}
	<div class="flex h-screen items-center justify-center" style="background: var(--color-canvas-bg, #fafaf5);">
		<div class="flex items-center gap-3">
			<div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
			<p style="color: var(--color-text-muted, #94a3b8);">Loading diagram...</p>
		</div>
	</div>

{:else if mode === 'dropzone'}
	<!-- Drop zone UI -->
	<div class="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
		style="background: var(--color-canvas-bg, #fafaf5);">

		<div class="text-center">
			<h1 class="mb-2 text-2xl font-bold" style="color: var(--color-text-primary, #1e293b);">
				Preview & Export
			</h1>
			<p class="text-sm" style="color: var(--color-text-muted, #94a3b8);">
				Drop a diagram JSON file to preview or export as PNG
			</p>
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex h-64 w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all"
			style="border-color: {dragOver ? '#60a5fa' : 'var(--color-border-primary, #e2e8f0)'}; background: {dragOver ? '#eff6ff' : 'var(--color-bg-surface, #ffffff)'};"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			onclick={() => document.getElementById('file-input')?.click()}
			onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('file-input')?.click(); }}
			role="button"
			tabindex="0"
		>
			<svg class="h-10 w-10" style="color: var(--color-text-muted, #94a3b8);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
			</svg>
			<p class="text-sm font-medium" style="color: var(--color-text-secondary, #64748b);">
				Drop .json diagram here or click to browse
			</p>
			<p class="text-xs" style="color: var(--color-text-muted, #94a3b8);">
				Renders using the built-in canvas engine at 2x resolution
			</p>
		</div>

		<input id="file-input" type="file" accept=".json" class="hidden" onchange={handleFileSelect} />

		<p class="text-xs" style="color: var(--color-text-muted, #94a3b8);">
			Or use: <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/preview?path=/abs/path.json</code>
			&nbsp;·&nbsp;
			<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/preview?path=...&download=true</code>
		</p>
	</div>

{:else if mode === 'export'}
	<!-- Export view: canvas-rendered PNG preview + download -->
	<div class="flex min-h-screen flex-col items-center justify-center gap-5 p-8"
		style="background: var(--color-canvas-bg, #fafaf5);">

		<div class="flex items-center gap-4">
			<div class="text-center">
				<p class="text-lg font-semibold" style="color: var(--color-text-primary, #1e293b);">{diagramName}</p>
				<p class="text-xs" style="color: var(--color-text-muted, #94a3b8);">
					{currentDiagram?.nodes.length ?? 0} nodes, {currentDiagram?.edges.length ?? 0} edges · 2x resolution
				</p>
			</div>
		</div>

		<div class="flex gap-3">
			<button
				onclick={downloadPng}
				class="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
				style="background-color: #3b82f6;"
				onmouseenter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
				onmouseleave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				Download PNG
			</button>
			<button
				onclick={resetToDropzone}
				class="rounded-lg border px-4 py-2.5 text-sm transition-colors"
				style="border-color: var(--color-border-primary, #e2e8f0); color: var(--color-text-secondary, #64748b);"
				onmouseenter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover-overlay, #f1f5f9)')}
				onmouseleave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
			>
				Export another
			</button>
		</div>

		{#if exportPngSrc}
			<div class="overflow-auto rounded-lg border shadow-sm"
				style="border-color: var(--color-border-primary, #e2e8f0); background: white; max-height: 70vh;">
				<img src={exportPngSrc} alt={diagramName} class="max-w-full" />
			</div>
		{:else}
			<div class="flex items-center gap-3">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
				<p class="text-sm" style="color: var(--color-text-muted, #94a3b8);">Rendering...</p>
			</div>
		{/if}
	</div>

{:else if mode === 'interactive'}
	<!-- Interactive SvelteFlow preview (read-only, fit-to-screen) -->
	<div class="h-screen w-screen" style="background: var(--color-canvas-bg, #fafaf5);">
		<SvelteFlowProvider>
			<SvelteFlow
				nodes={flowNodes}
				edges={flowEdges}
				{nodeTypes}
				{edgeTypes}
				panOnScroll
				panOnDrag={false}
				snapToGrid={false}
				minZoom={ZOOM_MIN}
				maxZoom={ZOOM_MAX}
				zoomOnDoubleClick={false}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				proOptions={PRO_OPTIONS}
				style="background-color: var(--color-canvas-bg, #fafaf5);"
			/>
			<PreviewFitView />
		</SvelteFlowProvider>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
