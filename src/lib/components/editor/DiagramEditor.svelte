<script lang="ts">
	import {
		SvelteFlow,
		SvelteFlowProvider,
		MiniMap,
		type NodeChange,
		type EdgeChange,
		type Connection,
		type Viewport,
		type Node
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import { nodeTypes } from '$lib/components/nodes';
	import { edgeTypes } from '$lib/components/edges';
	import {
		nodeList,
		edgeList,
		addEdge as addEdgeToStore,
		updateNode,
		updateNodeSilent,
		removeNodes,
		removeEdges,
		insertNodeOnEdge,
		groupNodes,
		ungroupNodes,
		notifyMutation
	} from '$lib/stores/diagramStore';
	import { selectedNodeIds, selectedEdgeIds, selectNodes, selectEdges, clearSelection } from '$lib/stores/selectionStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import { setViewport } from '$lib/stores/viewportStore';
	import { toFlowNodes, toFlowEdges } from '$lib/engine/serializer';
	import { ZOOM_MIN, ZOOM_MAX } from '$lib/constants';
	import EditorControls from './EditorControls.svelte';
	import DropHandler from './DropHandler.svelte';
	import ContextMenu from './ContextMenu.svelte';
	import type { MenuItem } from './ContextMenu.svelte';
	import AlignmentToolbar from './AlignmentToolbar.svelte';
	import SnapGuides from './SnapGuides.svelte';
	import { computeSnap, type GuideLine } from '$lib/engine/snap-guides';
	import { snapSettings } from '$lib/stores/snapStore';
	import { saveShape } from '$lib/stores/shapeLibraryStore';
	import { defaultEdgeType } from '$lib/stores/edgePrefsStore';
	import CanvasToolbar from './CanvasToolbar.svelte';
	import { addNode } from '$lib/stores/diagramStore';

	// Hoist static objects so SvelteFlow doesn't see new references every render
	let defaultEdgeOptions = $derived({ type: $defaultEdgeType, animated: false });
	const PRO_OPTIONS = { hideAttribution: true } as const;

	interface Props {
		onDrop?: (type: string, position: { x: number; y: number }) => void;
	}

	let { onDrop }: Props = $props();

	let showMinimap = $state(true);
	let flowNodes = $derived(toFlowNodes($nodeList));
	let flowEdges = $derived(toFlowEdges($edgeList));

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

	// Snap guides state
	let snapGuides = $state<GuideLine[]>([]);

	// Canvas tool state
	let activeTool = $state<'select' | 'rectangle' | 'circle' | 'diamond' | 'text' | 'note'>('select');

	function handleToolbarAddShape(nodeType: string) {
		// Add shape to center of visible canvas
		if (screenToFlow) {
			const el = document.querySelector('.svelte-flow');
			const rect = el?.getBoundingClientRect();
			if (rect) {
				const center = screenToFlow({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
				addNode(nodeType, center);
			}
		}
	}

	let screenToFlow: ((pos: { x: number; y: number }) => { x: number; y: number }) | null = null;
	let fitViewFn: (() => void) | null = null;
	let setViewportFn: ((vp: import('@xyflow/svelte').Viewport) => void) | null = null;

	export function fitView() {
		if (fitViewFn) requestAnimationFrame(() => fitViewFn?.());
	}

	export function restoreViewport(vp: { x: number; y: number; zoom: number }) {
		if (setViewportFn) {
			requestAnimationFrame(() => setViewportFn?.(vp));
		}
	}

	// ── Node drag handlers ──────────────────────────────────────────
	// SvelteFlow recalculates drag positions from the initial grab offset each
	// frame, so setting targetNode.position in onnodedrag gets overwritten.
	// We track the snap-corrected position and apply it on drag stop.
	// Hold Alt/Option during drag to temporarily disable all snapping.

	let dragSnapPositions = new Map<string, { x: number; y: number }>();

	function handleNodeDrag({ targetNode, nodes: draggedNodes, event }: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
		if (!targetNode) return;
		const draggingNode = $nodeList.find((n) => n.id === targetNode.id);
		if (!draggingNode) return;

		// Alt/Option held = free movement, no snapping
		const altHeld = event instanceof MouseEvent && event.altKey;

		const settings = $snapSettings;
		const hasAnySnap = settings.alignmentSnap || settings.connectorSnap || settings.geometricSnap;

		if (altHeld || (!hasAnySnap && !settings.gridSnap)) {
			snapGuides = [];
			dragSnapPositions.delete(targetNode.id);
			return;
		}

		const others = $nodeList.filter((n) => n.id !== targetNode.id);
		const result = computeSnap(draggingNode, targetNode.position, others, settings);

		snapGuides = result.guides;

		const cx = result.correctedPosition.x;
		const cy = result.correctedPosition.y;

		// Store snapped position — applied on drag stop
		dragSnapPositions.set(targetNode.id, { x: cx, y: cy });

		// Also try direct property mutation (works with some xyflow versions)
		if (cx !== targetNode.position.x || cy !== targetNode.position.y) {
			targetNode.position.x = cx;
			targetNode.position.y = cy;
		}
	}

	// Track whether we already captured history for the current drag gesture
	let dragHistoryPushed = false;

	function handleNodeDragStart() {
		if (!dragHistoryPushed) {
			pushHistory();
			dragHistoryPushed = true;
		}
	}

	function handleNodeDragStop({ targetNode, nodes: draggedNodes, event }: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
		snapGuides = [];
		dragHistoryPushed = false;

		const altHeld = event instanceof MouseEvent && event.altKey;
		const settings = $snapSettings;
		const hasAnySnap = !altHeld && (settings.alignmentSnap || settings.connectorSnap || settings.geometricSnap || settings.gridSnap);

		for (const node of draggedNodes) {
			let pos = { x: node.position.x, y: node.position.y };

			// Final snap calculation on the drop position for accuracy
			if (hasAnySnap) {
				const diagramNode = $nodeList.find((n) => n.id === node.id);
				if (diagramNode) {
					const others = $nodeList.filter((n) => n.id !== node.id);
					const result = computeSnap(diagramNode, pos, others, settings);
					pos = result.correctedPosition;
				}
			}

			updateNode(node.id, { position: pos });
		}
		dragSnapPositions.clear();
	}

	function handleNodesChange(changes: NodeChange[]) {
		for (const change of changes) {
			if (change.type === 'remove') {
				removeNodes([change.id]);
			} else if (change.type === 'dimensions' && change.dimensions) {
				// Silent update — dimension auto-measurements are not user edits
				// and should not trigger the save pipeline or pollute undo history
				updateNodeSilent(change.id, {
					size: {
						width: Math.round(change.dimensions.width),
						height: Math.round(change.dimensions.height)
					}
				});
			}
		}
	}

	function handleEdgesChange(changes: EdgeChange[]) {
		for (const change of changes) {
			if (change.type === 'remove') {
				removeEdges([change.id]);
			}
		}
	}

	function handleSelectionChange({ nodes: selNodes, edges: selEdges }: { nodes: any[]; edges: any[] }) {
		const selIds = new Set(selNodes.map((n: any) => n.id));
		// Only include a group if ALL its children are selected
		const filtered = selNodes.filter((n: any) => {
			if (n.type !== 'group') return true;
			const children = $nodeList.filter((c) => c.parentId === n.id);
			return children.length > 0 && children.every((c) => selIds.has(c.id));
		});
		selectNodes(filtered.map((n: any) => n.id));
		selectEdges(selEdges.map((e: any) => e.id));
	}

	function handleConnect(connection: Connection) {
		pushHistory();
		addEdgeToStore(connection.source, connection.target, connection.sourceHandle || 'bottom', connection.targetHandle || 'top');
	}

	function handleDelete({ nodes: deletedNodes, edges: deletedEdges }: { nodes: any[]; edges: any[] }) {
		if (deletedNodes.length > 0 || deletedEdges.length > 0) pushHistory();
		if (deletedNodes.length > 0) removeNodes(deletedNodes.map((n: any) => n.id));
		if (deletedEdges.length > 0) removeEdges(deletedEdges.map((e: any) => e.id));
	}

	function handleMoveEnd(_event: MouseEvent | TouchEvent, vp: Viewport) {
		setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	function handleNodeContextMenu({ node, event: e }: { node: any; event: MouseEvent }) {
		e.preventDefault();
		const diagramNode = $nodeList.find((n) => n.id === node.id);
		const selectedIds = Array.from($selectedNodeIds);
		const isGroup = diagramNode?.type === 'group';
		const canGroup = selectedIds.length >= 2;

		const items: MenuItem[] = [
			{
				label: 'Save to Library',
				action: () => {
					if (diagramNode) {
						saveShape({
							name: diagramNode.label || diagramNode.type,
							nodeType: diagramNode.type,
							label: diagramNode.label,
							size: diagramNode.size,
							data: diagramNode.data,
							style: diagramNode.style
						});
					}
				}
			},
			{ label: '', action: () => {}, separator: true },
		];

		if (canGroup) {
			items.push({
				label: `Group ${selectedIds.length} Nodes`,
				action: () => {
					pushHistory();
					groupNodes(selectedIds);
					clearSelection();
				}
			});
		}

		if (isGroup) {
			items.push({
				label: 'Ungroup',
				action: () => {
					pushHistory();
					ungroupNodes(node.id);
					clearSelection();
				}
			});
		}

		items.push({ label: '', action: () => {}, separator: true });
		items.push({ label: 'Delete Node', action: () => { pushHistory(); removeNodes([node.id]); } });

		contextMenu = { x: e.clientX, y: e.clientY, items };
	}

	function handleEdgeContextMenu({ edge, event: e }: { edge: any; event: MouseEvent }) {
		e.preventDefault();
		contextMenu = {
			x: e.clientX,
			y: e.clientY,
			items: [
				{
					label: 'Insert Node Here',
					action: () => {
						const pos = screenToFlow
							? screenToFlow({ x: e.clientX, y: e.clientY })
							: { x: e.clientX, y: e.clientY };
						pushHistory();
					insertNodeOnEdge(edge.id, 'process', pos);
					}
				},
				{ label: '', action: () => {}, separator: true },
				{ label: 'Delete Edge', action: () => { pushHistory(); removeEdges([edge.id]); } }
			]
		};
	}

	function handlePaneContextMenu({ event }: { event: MouseEvent }) {
		event.preventDefault();
		const selectedIds = Array.from($selectedNodeIds);
		if (selectedIds.length >= 2) {
			contextMenu = {
				x: event.clientX,
				y: event.clientY,
				items: [
					{
						label: `Group ${selectedIds.length} Nodes`,
						action: () => {
							pushHistory();
							groupNodes(selectedIds);
							clearSelection();
						}
					}
				]
			};
		} else {
			contextMenu = null;
		}
	}

	let dropProcessed = false;

	function handleDropOnCanvas(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Guard against duplicate fires from bubbling
		if (dropProcessed) return;
		dropProcessed = true;
		requestAnimationFrame(() => { dropProcessed = false; });

		const type = event.dataTransfer?.getData('application/diagram-node-type');
		if (!type || !onDrop || !screenToFlow) return;

		const position = screenToFlow({ x: event.clientX, y: event.clientY });
		onDrop(type, position);
	}
</script>

<div
	class="relative h-full w-full"
	role="application"
	ondragover={handleDragOver}
	ondrop={handleDropOnCanvas}
>
	<SvelteFlowProvider>
		<SvelteFlow
			nodes={flowNodes}
			edges={flowEdges}
			{nodeTypes}
			{edgeTypes}
			onnodeschange={handleNodesChange}
			onedgeschange={handleEdgesChange}
			onconnect={handleConnect}
			ondelete={handleDelete}
			onselectionchange={handleSelectionChange}
			onmoveend={handleMoveEnd}
			onnodedragstart={handleNodeDragStart}
			onnodedrag={handleNodeDrag}
			onnodedragstop={handleNodeDragStop}
			onnodecontextmenu={handleNodeContextMenu}
			onedgecontextmenu={handleEdgeContextMenu}
			onpanecontextmenu={handlePaneContextMenu}
			selectionOnDrag
			panOnScroll
			panOnDrag={false}
			snapToGrid={false}
			minZoom={ZOOM_MIN}
			maxZoom={ZOOM_MAX}
			zoomOnDoubleClick={false}
			defaultEdgeOptions={defaultEdgeOptions}
			style="background-color: var(--color-canvas-bg);"
			proOptions={PRO_OPTIONS}
		>
			{#if showMinimap}
				<MiniMap
					position="bottom-right"
					style="background: var(--color-bg-surface); border: 1px solid var(--color-border-primary); border-radius: 8px; margin-bottom: 12px; margin-right: 12px;"
					maskColor="var(--color-minimap-mask)"
					nodeColor="var(--color-accent)"
				/>
			{/if}

			<EditorControls bind:showMinimap />
			<DropHandler onReady={(helpers) => {
				screenToFlow = helpers.screenToFlow;
				fitViewFn = helpers.fitView;
				setViewportFn = helpers.setViewport;
			}} />
		</SvelteFlow>
	</SvelteFlowProvider>

	<!-- Alignment Toolbar -->
	<AlignmentToolbar />


	<!-- Canvas Toolbar (shapes + edge type) -->
	<CanvasToolbar
		{activeTool}
		onToolChange={(t) => { activeTool = t; }}
		onAddShape={handleToolbarAddShape}
	/>

	<!-- Snap Guides -->
	<SnapGuides guides={snapGuides} />

	<!-- Context Menu -->
	{#if contextMenu}
		<ContextMenu
			x={contextMenu.x}
			y={contextMenu.y}
			items={contextMenu.items}
			onClose={() => (contextMenu = null)}
		/>
	{/if}

	<!-- Empty state -->
	{#if $nodeList.length === 0}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<div class="pointer-events-auto text-center">
				<p class="mb-2 text-sm" style="color: var(--color-text-muted);">
					Drag nodes from the left panel to start building your diagram
				</p>
			</div>
		</div>
	{/if}
</div>
