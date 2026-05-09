<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import type { DiagramFile } from '$lib/types/diagram';
	import DiagramEditor from '$lib/components/editor/DiagramEditor.svelte';
	import EditorToolbar from '$lib/components/editor/EditorToolbar.svelte';
	import NodePalette from '$lib/components/editor/NodePalette.svelte';
	import FileExplorer from '$lib/components/editor/FileExplorer.svelte';
	import PropertiesPanel from '$lib/components/editor/PropertiesPanel.svelte';
	import ShapeLibrary from '$lib/components/editor/ShapeLibrary.svelte';
	import { FolderOpen, HardDrive, Files, Shapes, BookOpen } from 'lucide-svelte';
	import {
		addNode,
		updateNode,
		updateNodesBatch,
		removeNodes,
		removeEdges,
		groupNodes,
		ungroupNodes,
		nodeList,
		edgeList,
		diagramMeta,
		isDirty,
		saveStatus,
		nodes,
		edges,
		registerOnMutation,
		unregisterOnMutation,
		notifyMutation
	} from '$lib/stores/diagramStore';
	import {
		selectedNodeIds,
		selectedEdgeIds,
		selectNodes,
		clearSelection
	} from '$lib/stores/selectionStore';
	import { viewport, setViewport } from '$lib/stores/viewportStore';
	import { pushHistory, pushSnapshot, undo, redo, clearHistory, registerOnHistoryChange, unregisterOnHistoryChange } from '$lib/stores/historyStore';
	import { copySelected, paste } from '$lib/stores/clipboardStore';
	import { editingNodeId } from '$lib/stores/editStore';
	import { autoLayout, type LayoutDirection } from '$lib/engine/layout';
	import { exportJson, importDiagramFile, exportHtml, exportMultiHtml, generateDiagramHtml, generateMultiDiagramHtml, type HtmlExportItem } from '$lib/engine/export';
	import { exportCanvasPng, copyCanvasToClipboard, renderToCanvas } from '$lib/engine/canvas-renderer';
	import {
		readDiagramFile,
		writeDiagramFile,
		createEmptyDiagram,
		watchFile,
		watchDirectory,
		isFileSystemAccessSupported,
		withWriteLock,
		type FileWatcher,
		type DirectoryWatcher
	} from '$lib/engine/fs-access';
	import { cacheDiagram, getCachedDiagram, markFsSynced } from '$lib/engine/idb-cache';
	import { buildCanonicalSnapshot } from '$lib/engine/content-hash';
	import {
		directoryHandle,
		workspaceReady,
		workspaceName,
		restoreWorkspace,
		openWorkspace
	} from '$lib/stores/workspaceStore';
	import { leftPanelOpen, leftPanelWidth, rightPanelOpen, rightPanelWidth, activeTab } from '$lib/stores/sidebarStore';
	import { startLinter } from '$lib/stores/linterStore';
	import { isVSCodeWebview, postToExtension, onExtensionMessage } from '$lib/engine/vscode-bridge';
	import ResizeHandle from '$lib/components/editor/ResizeHandle.svelte';
	import JsonEditor from '$lib/components/editor/JsonEditor.svelte';
	import LintPanel from '$lib/components/editor/LintPanel.svelte';
	import ExportHtmlDialog from '$lib/components/editor/ExportHtmlDialog.svelte';

	let loading = $state(true);
	let vscodeMode = $state(false);
	let activeFile = $state<string>('');
	let syncStatus = $state<'connected' | 'disconnected' | 'syncing'>('disconnected');
	let externalChangeToast = $state(false);
	let fileWatcher: FileWatcher | null = null;
	let dirWatcher: DirectoryWatcher | null = null;
	let fileExplorerRef: FileExplorer | undefined = $state();
	let editorRef: DiagramEditor | undefined = $state();
	let savePending = false;
	let suppressDimensionChanges = false;
	let stopLinterFn: (() => void) | null = null;
	// Snapshot tracking for safe saves
	let lastWrittenSnapshot = '';  // canonical JSON of what we last wrote to disk
	let lastDiskSnapshot = '';     // canonical JSON of what we last read from disk
	let createdAt = $state('');
	let showJsonEditor = $state(false);
	let showExportDialog = $state(false);
	let exportDialogFiles = $state<Array<{ name: string; fileName: string; diagramType: string; diagram: DiagramFile; checked: boolean }>>([]);
	let importMode = $state(false);

	// ── Autosave: direct callback from mutations ──────────────────────
	// No $effect, no subscriptions, no reactivity.
	// diagramStore mutation functions call scheduleSave() directly.

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const SAVE_DEBOUNCE = 800;

	function scheduleSave() {
		if (!activeFile) return;
		savePending = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(performSave, SAVE_DEBOUNCE);
	}

	// ── Lifecycle ──────────────────────────────────────────────────────

	let removeVscodeListener: (() => void) | null = null;

	onMount(async () => {
		registerOnMutation(scheduleSave);
		registerOnHistoryChange(scheduleSave);
		stopLinterFn = startLinter();

		if (isVSCodeWebview()) {
			vscodeMode = true;
			// In VS Code mode, skip workspace picker — wait for diagram data via postMessage
			removeVscodeListener = onExtensionMessage((msg) => {
				if (msg.type === 'update' && msg.data) {
					const diagram = msg.data as DiagramFile;
					suppressDimensionChanges = true;
					loadDiagramFlat(diagram);
					requestAnimationFrame(() => {
						if (diagram.viewport && (diagram.viewport.x !== 0 || diagram.viewport.y !== 0 || diagram.viewport.zoom !== 1)) {
							setViewport(diagram.viewport);
							requestAnimationFrame(() => editorRef?.restoreViewport(diagram.viewport));
						} else {
							requestAnimationFrame(() => editorRef?.fitView());
						}
						setTimeout(() => { suppressDimensionChanges = false; }, 500);
					});
				} else if (msg.type === 'exportAll' && msg.data) {
					const { diagrams, title } = msg.data as { diagrams: DiagramFile[]; title: string };
					const items: HtmlExportItem[] = diagrams.map((d) => ({
						diagram: d,
						nodes: d.nodes,
						edges: d.edges
					}));
					const html = generateMultiDiagramHtml(items, title);
					postToExtension('exportAllResult', { content: html });
				}
			});
			// Tell the extension we're ready
			postToExtension('ready');
			loading = false;
		} else if (location.hash.startsWith('#import=')) {
			try {
				const encoded = location.hash.slice('#import='.length);
				const binary = atob(encoded);
				const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
				const json = new TextDecoder().decode(bytes);
				const diagram = JSON.parse(json) as DiagramFile;
				loadDiagramFlat(diagram);
				importMode = true;
				history.replaceState(null, '', location.pathname);
			} catch {
				// malformed hash — fall through to normal workspace flow
				await restoreWorkspace(false);
			}
			loading = false;
		} else {
			await restoreWorkspace(false);
			loading = false;
		}
	});

	onDestroy(() => {
		unregisterOnMutation();
		unregisterOnHistoryChange();
		stopLinterFn?.();
		clearTimeout(saveTimer);
		fileWatcher?.stop();
		dirWatcher?.stop();
		removeVscodeListener?.();
	});

	// When workspace becomes ready, auto-open first file or create Untitled
	$effect(() => {
		if (!vscodeMode && $workspaceReady && $directoryHandle && !activeFile) {
			autoOpenFile();
		}
	});

	// Directory watcher: auto-refresh file explorer on external file additions/deletions
	$effect(() => {
		if (!vscodeMode && $workspaceReady && $directoryHandle) {
			dirWatcher?.stop();
			let debounceTimer: ReturnType<typeof setTimeout>;
			dirWatcher = watchDirectory($directoryHandle, () => {
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => fileExplorerRef?.refresh(), 300);
			});
		}
	});

	async function autoOpenFile() {
		if (!$directoryHandle) return;
		const { listEntries } = await import('$lib/engine/fs-access');
		const entries = await listEntries($directoryHandle);

		// Try to restore the last opened file
		const lastFile = localStorage.getItem('diagram-studio-active-file');
		if (lastFile) {
			const found = entries.find((e) => e.kind === 'file' && e.name === lastFile);
			if (found) {
				await openFile(found.name);
				return;
			}
		}

		const firstFile = entries.find((e) => e.kind === 'file');
		if (firstFile) {
			await openFile(firstFile.name);
		} else {
			const diagram = createEmptyDiagram('Untitled');
			const fileName = 'Untitled.json';
			await writeDiagramFile($directoryHandle, fileName, diagram);
			fileExplorerRef?.refresh();
			await openFile(fileName);
		}
	}

	// ── File open / load ───────────────────────────────────────────────

	async function openFile(fileName: string) {
		if (!$directoryHandle) return;

		fileWatcher?.stop();
		fileWatcher = null;
		syncStatus = 'disconnected';

		let dirHandle = $directoryHandle;
		let actualFileName = fileName;
		if (fileName.includes('/')) {
			const parts = fileName.split('/');
			actualFileName = parts.pop()!;
			for (const part of parts) {
				dirHandle = await dirHandle.getDirectoryHandle(part);
			}
		}

		let diagram = await readDiagramFile(dirHandle, actualFileName);

		// Crash recovery: check if IDB has unsaved data newer than last FS sync
		const cached = await getCachedDiagram(fileName);
		if (cached && cached.modifiedAt > cached.fsSyncedAt && diagram) {
			if (cached.diagram.version > diagram.version) {
				diagram = cached.diagram;
				// Flush recovered IDB data to filesystem
				flushToFs(fileName, diagram, dirHandle);
			}
		}

		if (!diagram) return;

		activeFile = fileName;
		localStorage.setItem('diagram-studio-active-file', fileName);
		loadDiagramFlat(diagram);
		clearHistory();
		await cacheDiagram(fileName, diagram);
		console.log(`[DiagramStudio] Opened: ${fileName} — ${diagram.nodes.length} nodes`);
		// Restore saved viewport — also update the store so future saves don't overwrite it
		if (diagram.viewport && (diagram.viewport.x !== 0 || diagram.viewport.y !== 0 || diagram.viewport.zoom !== 1)) {
			setViewport(diagram.viewport);
			requestAnimationFrame(() => editorRef?.restoreViewport(diagram.viewport));
		} else {
			requestAnimationFrame(() => editorRef?.fitView());
		}

		// Start file watcher
		fileWatcher = watchFile(
			dirHandle,
			actualFileName,
			(updated) => {
				if (savePending) return;
				if (fileWatcher?.isSelfWrittenVersion(updated.version)) return;
				// Cancel any pending save so it doesn't overwrite the external change
				clearTimeout(saveTimer);
				syncStatus = 'syncing';
				// Suppress SvelteFlow dimension re-measurements that would overwrite external sizes
				suppressDimensionChanges = true;
				// Preserve undo history: push current state so the user can undo the external change
				pushHistory();
				loadDiagramFlat(updated);
				cacheDiagram(fileName, updated);
				// Allow dimension changes again after SvelteFlow has settled
				requestAnimationFrame(() => { setTimeout(() => { suppressDimensionChanges = false; }, 500); });
				syncStatus = 'connected';
				showExternalChangeToast();
				console.log(`[DiagramStudio] External change: ${fileName}`);
			},
			1000
		);
		syncStatus = 'connected';
	}

	function loadDiagramFlat(diagram: DiagramFile) {
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

		// Capture snapshot of loaded content for comparison
		const snapshot = buildCanonicalSnapshot(nodeMap, edgeMap);
		lastWrittenSnapshot = snapshot;
		lastDiskSnapshot = snapshot;

		createdAt = diagram.createdAt || '';
		isDirty.set(false);
		savePending = false;
		saveStatus.set('saved');
	}

	function showExternalChangeToast() {
		externalChangeToast = true;
		setTimeout(() => (externalChangeToast = false), 3000);
	}

	// ── Workspace ──────────────────────────────────────────────────────

	async function handleOpenWorkspace() {
		const opened = await openWorkspace();
		if (opened) handleWorkspaceChanged();
	}

	function handleWorkspaceChanged() {
		activeFile = '';
		fileWatcher?.stop();
		fileWatcher = null;
		dirWatcher?.stop();
		dirWatcher = null;
		syncStatus = 'disconnected';
		nodes.set(new Map());
		edges.set(new Map());
		diagramMeta.set(null);
	}

	// ── Save pipeline ──────────────────────────────────────────────────

	function buildDiagramFile(): DiagramFile | null {
		const meta = get(diagramMeta);
		const currentNodes = Array.from(get(nodes).values());
		const currentEdges = Array.from(get(edges).values());
		const vp = get(viewport);

		if (!meta) return null;

		return {
			$schema: 'diagram-studio/diagram-v1',
			id: meta.id,
			name: meta.name,
			description: meta.description,
			diagramType: meta.diagramType,
			version: meta.version + 1,
			createdAt: createdAt || new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
			viewport: vp,
			nodes: currentNodes,
			edges: currentEdges,
			metadata: meta.metadata
		};
	}

	async function performSave() {
		// VS Code mode: send diagram to extension host
		if (vscodeMode) {
			const currentSnapshot = buildCanonicalSnapshot(get(nodes), get(edges));
			if (currentSnapshot === lastWrittenSnapshot) {
				savePending = false;
				return;
			}
			saveStatus.set('saving');
			const diagram = buildDiagramFile();
			if (!diagram) { savePending = false; return; }
			diagramMeta.update((m) => m ? { ...m, version: diagram.version } : m);
			postToExtension('save', diagram);
			lastWrittenSnapshot = currentSnapshot;
			lastDiskSnapshot = currentSnapshot;
			isDirty.set(false);
			saveStatus.set('saved');
			savePending = false;
			return;
		}

		const file = activeFile;
		const dirHandleVal = get(directoryHandle);

		if (!file || !dirHandleVal) {
			savePending = false;
			return;
		}

		// Snapshot comparison: skip save if nothing meaningful changed
		const currentSnapshot = buildCanonicalSnapshot(get(nodes), get(edges));
		if (currentSnapshot === lastWrittenSnapshot) {
			savePending = false;
			return;
		}

		saveStatus.set('saving');
		const diagram = buildDiagramFile();
		if (!diagram) { savePending = false; return; }

		// Update diagramMeta version and mark as self-written so watcher skips it
		diagramMeta.update((m) => m ? { ...m, version: diagram.version } : m);
		fileWatcher?.markSelfWriteVersion(diagram.version);

		// Phase 1: IDB write (~1-3ms)
		try {
			await cacheDiagram(file, diagram);
		} catch {
			// IDB failure is non-fatal
		}

		// Phase 2: Filesystem write — savePending stays true until this completes
		const written = await flushToFs(file, diagram, dirHandleVal);
		if (written) {
			lastWrittenSnapshot = currentSnapshot;
			lastDiskSnapshot = currentSnapshot;
			isDirty.set(false);
			saveStatus.set('saved');
		} else {
			// FS write failed but IDB succeeded — mark as dirty so we retry
			saveStatus.set('unsaved');
		}
		savePending = false;
	}

	async function flushToFs(file: string, diagram: DiagramFile, dirHandleVal: FileSystemDirectoryHandle): Promise<boolean> {
		try {
			await withWriteLock(async () => {
				fileWatcher?.markSelfWrite();

				let dirHandle = dirHandleVal;
				let actualFileName = file;
				if (file.includes('/')) {
					const parts = file.split('/');
					actualFileName = parts.pop()!;
					for (const part of parts) {
						dirHandle = await dirHandle.getDirectoryHandle(part);
					}
				}

				await writeDiagramFile(dirHandle, actualFileName, diagram);
			});
			await markFsSynced(file);
			return true;
		} catch {
			// Retry once after 2s
			savePending = true;
			setTimeout(async () => {
				try {
					fileWatcher?.markSelfWrite();
					await writeDiagramFile(dirHandleVal, file, diagram);
					await markFsSynced(file);
				} catch { /* give up */ }
				savePending = false;
			}, 2000);
			return false;
		}
	}

	async function handleSave() {
		savePending = true;
		clearTimeout(saveTimer);
		await performSave();
	}

	// ── Editor actions ─────────────────────────────────────────────────

	function handleDrop(type: string, position: { x: number; y: number }) {
		// Capture pre-mutation state synchronously, then add the node immediately.
		// Defer the undo-stack push to after the frame so the node renders first.
		const snap = {
			nodes: new Map(get(nodes)),
			edges: new Map(get(edges))
		};
		addNode(type, position);
		requestAnimationFrame(() => pushSnapshot(snap));
	}

	function handleAutoLayout(direction: LayoutDirection) {
		if ($nodeList.length === 0) return;
		pushHistory();
		const laid = autoLayout($nodeList, $edgeList, direction);
		const nodeMap = new Map<string, import('$lib/types/diagram').DiagramNode>();
		for (const n of laid) nodeMap.set(n.id, n);
		nodes.set(nodeMap);
		notifyMutation();
	}

	async function handleImport() {
		const imported = await importDiagramFile();
		if (!imported || !$diagramMeta) return;
		pushHistory();
		const nodeMap = new Map<string, import('$lib/types/diagram').DiagramNode>();
		for (const n of imported.nodes) nodeMap.set(n.id, n);
		nodes.set(nodeMap);

		const edgeMap = new Map<string, import('$lib/types/diagram').DiagramEdge>();
		for (const e of imported.edges) edgeMap.set(e.id, e);
		edges.set(edgeMap);
		notifyMutation();
	}

	function handleExportJson() {
		const diagram = buildDiagramFile();
		if (diagram) exportJson(diagram);
	}

	async function handleExportPng() {
		const currentNodes = Array.from(get(nodes).values());
		const currentEdges = Array.from(get(edges).values());
		if (currentNodes.length === 0) return;
		const meta = get(diagramMeta);
		const name = meta?.name || 'diagram';

		if (vscodeMode) {
			const canvas = renderToCanvas(currentNodes, currentEdges, { scale: 2, padding: 40 });
			const base64 = canvas.toDataURL('image/png').split(',')[1];
			postToExtension('exportPng', { data: base64, filename: name });
			return;
		}

		await exportCanvasPng(currentNodes, currentEdges, name, { scale: 2, padding: 40 });
	}

	async function handleExportHtml() {
		const currentNodes = Array.from(get(nodes).values());
		const currentEdges = Array.from(get(edges).values());
		const diagram = buildDiagramFile();
		if (!diagram) return;

		if (vscodeMode) {
			const html = generateDiagramHtml(diagram, currentNodes, currentEdges);
			postToExtension('exportHtml', { content: html, filename: diagram.name });
			return;
		}

		await exportHtml(diagram, currentNodes, currentEdges);
	}

	async function handleExportAllHtml() {
		const dirHandleVal = get(directoryHandle);
		if (!dirHandleVal) return;

		const { listEntries, readDiagramFile } = await import('$lib/engine/fs-access');

		async function collectFiles(
			dh: FileSystemDirectoryHandle,
			prefix = ''
		): Promise<Array<{ name: string; fileName: string; diagramType: string; diagram: DiagramFile }>> {
			const result: Array<{ name: string; fileName: string; diagramType: string; diagram: DiagramFile }> = [];
			const entries = await listEntries(dh);
			for (const entry of entries) {
				if (entry.kind === 'file') {
					const d = await readDiagramFile(dh, entry.name);
					if (d) result.push({
						name: d.name || entry.name,
						fileName: prefix ? `${prefix}/${entry.name}` : entry.name,
						diagramType: d.diagramType || 'flowchart',
						diagram: d
					});
				} else if (entry.kind === 'directory') {
					const subDh = await dh.getDirectoryHandle(entry.name);
					result.push(...(await collectFiles(subDh, prefix ? `${prefix}/${entry.name}` : entry.name)));
				}
			}
			return result;
		}

		const fileList = await collectFiles(dirHandleVal);
		if (fileList.length === 0) return;

		exportDialogFiles = fileList.map((f) => ({ ...f, checked: true }));
		showExportDialog = true;
	}

	async function handleDialogExport(selected: DiagramFile[]) {
		showExportDialog = false;
		const items: HtmlExportItem[] = selected.map((d) => ({ diagram: d, nodes: d.nodes, edges: d.edges }));
		const wsName = get(workspaceName) || 'Diagrams';
		await exportMultiHtml(items, wsName);
	}

	async function handleCopyImage() {
		const currentNodes = Array.from(get(nodes).values());
		const currentEdges = Array.from(get(edges).values());
		if (currentNodes.length === 0) return;
		const ok = await copyCanvasToClipboard(currentNodes, currentEdges, { scale: 2, padding: 40 });
		if (ok) {
			// Brief toast-like feedback via save status
			saveStatus.set('saved');
			console.log('[DiagramStudio] Diagram copied to clipboard');
		}
	}

	function handleDeleteSelected() {
		const nodeIds = Array.from($selectedNodeIds);
		const edgeIds = Array.from($selectedEdgeIds);
		if (nodeIds.length === 0 && edgeIds.length === 0) return;
		pushHistory();
		if (nodeIds.length > 0) removeNodes(nodeIds);
		if (edgeIds.length > 0) removeEdges(edgeIds);
		clearSelection();
	}

	function handleSelectAll() {
		selectNodes($nodeList.map((n) => n.id));
	}

	function handleGroup() {
		const ids = Array.from(get(selectedNodeIds));
		console.log('[DiagramStudio] Group requested:', ids.length, 'nodes selected');
		if (ids.length < 2) return;
		pushHistory();
		const groupId = groupNodes(ids);
		if (groupId) {
			clearSelection();
			console.log('[DiagramStudio] Grouped into:', groupId);
		}
	}

	function handleUngroup() {
		const ids = Array.from(get(selectedNodeIds));
		const currentNodes = get(nodes);
		// Find group nodes among selection, or find parent group of selected child
		for (const id of ids) {
			const node = currentNodes.get(id);
			if (node?.type === 'group') {
				pushHistory();
				ungroupNodes(id);
				clearSelection();
				return;
			}
			// If a child node is selected, ungroup its parent
			if (node?.parentId) {
				pushHistory();
				ungroupNodes(node.parentId);
				clearSelection();
				return;
			}
		}
	}

	function getJsonEditorValue(): string {
		const diagram = buildDiagramFile();
		if (!diagram) return '{}';
		return JSON.stringify(diagram, null, 2);
	}

	function handleJsonEditorSave(jsonStr: string) {
		try {
			const diagram = JSON.parse(jsonStr) as DiagramFile;
			loadDiagramFlat(diagram);
			notifyMutation();
		} catch {
			// Invalid JSON, ignore
		}
	}

	function handleFileSelect(fileName: string) {
		showJsonEditor = false;
		openFile(fileName);
	}

	function handleFileCreated(fileName: string) {
		openFile(fileName);
	}

	function handleFileDeleted(fileName: string) {
		if (activeFile === fileName) {
			activeFile = '';
			nodes.set(new Map());
			edges.set(new Map());
			diagramMeta.set(null);
			fileWatcher?.stop();
			fileWatcher = null;
			syncStatus = 'disconnected';
			autoOpenFile();
		}
	}

	let arrowKeyHistoryPushed = false;
	let arrowKeyTimer: ReturnType<typeof setTimeout> | undefined;
	let arrowKeyDelta = { x: 0, y: 0 };
	let arrowKeyNodeIds: string[] = [];

	function handleKeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		const tag = (e.target as HTMLElement)?.tagName;
		const isEditable = (e.target as HTMLElement)?.isContentEditable;
		const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable;

		// Allow modifier shortcuts (Cmd+S, Cmd+G, etc.) even when an input has focus.
		// Only block non-modifier keys (Delete, Backspace, Escape) inside inputs.
		if (inInput && !mod) return;

		if (mod && e.key === 's') {
			e.preventDefault();
			handleSave();
		} else if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
			e.preventDefault();
			redo();
		} else if (mod && e.key === 'z') {
			e.preventDefault();
			undo();
		} else if (mod && e.key === 'y') {
			e.preventDefault();
			redo();
		} else if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
			e.preventDefault();
			handleCopyImage();
		} else if (mod && e.key === 'c') {
			e.preventDefault();
			copySelected();
		} else if (mod && e.key === 'v') {
			e.preventDefault();
			paste();
		} else if (mod && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
			e.preventDefault();
			handleUngroup();
		} else if (mod && e.key === 'g') {
			e.preventDefault();
			handleGroup();
		} else if (mod && e.key === 'a') {
			e.preventDefault();
			handleSelectAll();
		} else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !mod) {
			// SvelteFlow moves nodes internally via moveSelectedNodes, but bypasses
			// onnodeschange — so we accumulate delta and commit once after keys stop.
			const ids = get(selectedNodeIds);
			if (ids.size === 0) return;
			const step = e.shiftKey ? 20 : 5;
			const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
			const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
			if (!arrowKeyHistoryPushed) {
				pushHistory();
				arrowKeyHistoryPushed = true;
				arrowKeyDelta = { x: 0, y: 0 };
				arrowKeyNodeIds = [...ids];
			}
			arrowKeyDelta.x += dx;
			arrowKeyDelta.y += dy;
			// Commit all accumulated movement once after keys stop
			clearTimeout(arrowKeyTimer);
			arrowKeyTimer = setTimeout(() => {
				// Single batch store write + one save trigger
				const batch = new Map<string, { position: { x: number; y: number } }>();
				for (const id of arrowKeyNodeIds) {
					const node = get(nodes).get(id);
					if (node) {
						batch.set(id, {
							position: { x: node.position.x + arrowKeyDelta.x, y: node.position.y + arrowKeyDelta.y }
						});
					}
				}
				if (batch.size > 0) {
					updateNodesBatch(batch);
					notifyMutation();
				}
				arrowKeyHistoryPushed = false;
				arrowKeyDelta = { x: 0, y: 0 };
				arrowKeyNodeIds = [];
			}, 300);
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			handleDeleteSelected();
		} else if (e.key === 'Escape') {
			clearSelection();
		} else if (e.key === 'Enter' && !mod && !e.shiftKey) {
			// Enter-to-rename: like macOS Finder, press Enter on a selected node to edit its label
			const ids = get(selectedNodeIds);
			if (ids.size === 1) {
				e.preventDefault();
				const nodeId = ids.values().next().value as string;
				if (nodeId) editingNodeId.set(nodeId);
			}
		}
	}
</script>

<svelte:head>
	<title>{$diagramMeta?.name ?? 'Diagram Studio'}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if loading}
	<!-- Loading -->
{:else}
	<!-- Editor -->

	<div class="flex h-screen flex-col">
		<EditorToolbar
			diagramName={$diagramMeta?.name ?? 'Untitled'}
			diagramType={$diagramMeta?.diagramType ?? 'flowchart'}
			{syncStatus}
			{showJsonEditor}
			isVSCode={vscodeMode}
			onSave={handleSave}
			onImport={handleImport}
			onExportJson={handleExportJson}
			onExportPng={handleExportPng}
			onExportHtml={handleExportHtml}
			onExportAllHtml={handleExportAllHtml}
			onCopyImage={handleCopyImage}
			onAutoLayout={handleAutoLayout}
			onUndo={() => undo()}
			onRedo={() => redo()}
			onWorkspaceChanged={handleWorkspaceChanged}
			onToggleJsonEditor={() => { showJsonEditor = !showJsonEditor; }}
		/>

		<div class="flex flex-1 overflow-hidden">
			<!-- Left sidebar with tabs -->
			{#if $leftPanelOpen}
				<div
					data-panel="left"
					class="flex shrink-0 flex-col overflow-hidden"
					style="width: {$leftPanelWidth}px; background: color-mix(in srgb, var(--color-bg-surface) 92%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-right: 1px solid var(--color-border-primary);"
				>
					<!-- Tab bar -->
					<div class="flex border-b" style="border-color: var(--color-border-subtle);">
						<button
							onclick={() => activeTab.set('files')}
							class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors"
							style="
								color: {$activeTab === 'files' ? 'var(--color-accent)' : 'var(--color-text-muted)'};
								border-bottom: 2px solid {$activeTab === 'files' ? 'var(--color-accent)' : 'transparent'};
							"
						>
							<Files size={12} />
							Files
						</button>
						<button
							onclick={() => activeTab.set('nodes')}
							class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors"
							style="
								color: {$activeTab === 'nodes' ? 'var(--color-accent)' : 'var(--color-text-muted)'};
								border-bottom: 2px solid {$activeTab === 'nodes' ? 'var(--color-accent)' : 'transparent'};
							"
						>
							<Shapes size={12} />
							Nodes
						</button>
						<button
							onclick={() => activeTab.set('library')}
							class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors"
							style="
								color: {$activeTab === 'library' ? 'var(--color-accent)' : 'var(--color-text-muted)'};
								border-bottom: 2px solid {$activeTab === 'library' ? 'var(--color-accent)' : 'transparent'};
							"
						>
							<BookOpen size={12} />
							Library
						</button>
					</div>

					<!-- Tab content -->
					{#if $activeTab === 'files'}
						<FileExplorer
							bind:this={fileExplorerRef}
							{activeFile}
							onFileSelect={handleFileSelect}
							onFileCreated={handleFileCreated}
							onFileDeleted={handleFileDeleted}
						/>
					{:else if $activeTab === 'nodes'}
						<NodePalette />
					{:else}
						<ShapeLibrary />
					{/if}
				</div>

				<!-- Left resize handle -->
				<ResizeHandle side="left" width={$leftPanelWidth} onResize={(w) => leftPanelWidth.set(w)} />
			{/if}

			<div class="relative flex-1 overflow-hidden">
				{#if showJsonEditor}
					<JsonEditor
						value={getJsonEditorValue()}
						fileName={activeFile}
						onSave={handleJsonEditorSave}
						onClose={() => { showJsonEditor = false; }}
					/>
				{:else}
					<DiagramEditor bind:this={editorRef} onDrop={handleDrop} {suppressDimensionChanges} />
				{/if}
				<LintPanel />
			</div>

			<!-- Right resize handle -->
			{#if $rightPanelOpen}
				<ResizeHandle side="right" width={$rightPanelWidth} onResize={(w) => rightPanelWidth.set(w)} />
			{/if}

			<PropertiesPanel />
		</div>

		<!-- External change toast -->
		{#if externalChangeToast}
			<div
				class="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg"
				style="background: var(--color-bg-surface); border-color: var(--color-accent); color: var(--color-text-primary);"
			>
				<div class="h-2 w-2 rounded-full" style="background: var(--color-accent);"></div>
				Diagram updated from external changes
			</div>
		{/if}
	</div>

	<!-- HTML export selection dialog -->
	{#if showExportDialog}
		<ExportHtmlDialog
			files={exportDialogFiles}
			onExport={handleDialogExport}
			onClose={() => { showExportDialog = false; }}
		/>
	{/if}

	<!-- Import mode banner — shown when diagram was opened from exported HTML -->
	{#if importMode}
		<div
			class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg"
			style="background: var(--color-bg-surface); border-color: var(--color-border-primary); color: var(--color-text-secondary);"
		>
			<span>Viewing imported diagram · changes won't be saved</span>
			<button
				onclick={async () => { const ok = await openWorkspace(); if (ok) { importMode = false; handleWorkspaceChanged(); } }}
				class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
				style="background: var(--color-accent); color: #fff;"
			>
				Open folder to save
			</button>
			<button
				onclick={() => { importMode = false; }}
				class="rounded-md px-2 py-1 text-xs transition-colors hover:opacity-70"
				style="color: var(--color-text-muted);"
			>
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Workspace picker modal — shown when no folder is open, overlays the app -->
	{#if !vscodeMode && !$workspaceReady && !importMode}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center"
			style="background: rgba(0,0,0,0.25); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);"
		>
			<div
				class="w-full max-w-lg rounded-2xl p-10 text-center shadow-2xl"
				style="background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle);"
			>
				<div
					class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
					style="background: var(--color-accent-light); color: var(--color-accent);"
				>
					<HardDrive size={32} />
				</div>
				<h1 class="mb-2 text-2xl font-bold" style="color: var(--color-text-primary);">
					Diagram Studio
				</h1>
				<p class="mb-8 text-sm leading-relaxed" style="color: var(--color-text-tertiary);">
					Choose a folder to store your diagrams. The app reads and writes JSON files directly — AI tools can edit the same files and changes sync automatically.
				</p>
				<button
					onclick={handleOpenWorkspace}
					class="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors"
					style="background: var(--color-accent);"
				>
					<FolderOpen size={18} />
					Open Folder
				</button>
				{#if !isFileSystemAccessSupported()}
					<p class="mt-4 text-xs" style="color: var(--color-error-text);">
						Your browser doesn't support the File System Access API. Use Chrome, Edge, or Opera.
					</p>
				{/if}
			</div>
		</div>
	{/if}
{/if}
