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
		updateEdge,
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
	import GridControls from './GridControls.svelte';
	import FloatingNodeToolbar from './FloatingNodeToolbar.svelte';
	import ConnectionDropPicker from './ConnectionDropPicker.svelte';
	import { gridVisible } from '$lib/stores/gridStore';
	import { addNode } from '$lib/stores/diagramStore';

	// Hoist static objects so SvelteFlow doesn't see new references every render
	let defaultEdgeOptions = $derived({ type: $defaultEdgeType, animated: false });
	const PRO_OPTIONS = { hideAttribution: true } as const;

	interface Props {
		onDrop?: (type: string, position: { x: number; y: number }) => void;
		suppressDimensionChanges?: boolean;
	}

	let { onDrop, suppressDimensionChanges = false }: Props = $props();

	let showMinimap = $state(true);
	let flowNodes = $derived(toFlowNodes($nodeList, $selectedNodeIds));
	let flowEdges = $derived(toFlowEdges($edgeList));

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

	// Connection drop picker state
	let connectionPicker = $state<{
		x: number;
		y: number;
		canvasX: number;
		canvasY: number;
		sourceNodeId: string;
		sourceHandleId: string;
	} | null>(null);

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
			let pos = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
			const storeNode = $nodeList.find((n) => n.id === node.id);

			// Final snap calculation on the drop position for accuracy
			if (hasAnySnap) {
				if (storeNode) {
					const others = $nodeList.filter((n) => n.id !== node.id);
					const result = computeSnap(storeNode, pos, others, settings);
					pos = result.correctedPosition;
				}
			}

			updateNode(node.id, { position: pos });
		}
		dragSnapPositions.clear();
	}

	const GROUP_PADDING = 20;
	const GROUP_HEADER = 32;

	function handleNodesChange(changes: NodeChange[]) {
		let groupExpanded = false;
		const expandedGroupIds = new Set<string>();

		for (const change of changes) {
			if (change.type === 'remove') {
				removeNodes([change.id]);
			} else if (change.type === 'dimensions' && change.dimensions) {
				if (suppressDimensionChanges) continue;
				const storeNode = $nodeList.find((n) => n.id === change.id);
				if (storeNode?.type === 'group') {
					const newW = Math.round(change.dimensions.width);
					const newH = Math.round(change.dimensions.height);
					if (newW !== storeNode.size.width || newH !== storeNode.size.height) {
						updateNodeSilent(change.id, { size: { width: newW, height: newH } });
						groupExpanded = true;
						expandedGroupIds.add(change.id);
					}
				} else {
					updateNodeSilent(change.id, {
						size: {
							width: Math.round(change.dimensions.width),
							height: Math.round(change.dimensions.height)
						}
					});
				}
			} else if (change.type === 'position' && change.position) {
				const storeNode = $nodeList.find((n) => n.id === change.id);
				if (storeNode) {
					const newX = Math.round(change.position.x);
					const newY = Math.round(change.position.y);
					if (newX !== Math.round(storeNode.position.x) || newY !== Math.round(storeNode.position.y)) {
						updateNodeSilent(change.id, { position: { x: newX, y: newY } });
						// Track group expansion for padding enforcement only — don't trigger saves
						// Position saves are handled by handleNodeDragStop
						if (storeNode.type === 'group') expandedGroupIds.add(change.id);
					}
				}
			}
		}

		// Enforce minimum padding around children in expanded groups
		if (expandedGroupIds.size > 0) {
			enforceGroupPadding(expandedGroupIds);
		}

		if (groupExpanded) notifyMutation();
	}

	/** Ensure children have at least GROUP_PADDING from every group edge. */
	function enforceGroupPadding(groupIds: Set<string>) {
		const currentNodes = $nodeList;
		for (const groupId of groupIds) {
			const group = currentNodes.find((n) => n.id === groupId);
			if (!group) continue;
			const children = currentNodes.filter((n) => n.parentId === groupId);
			if (children.length === 0) continue;

			// Find the bounding box children occupy (positions are relative to group)
			let maxRight = 0;
			let maxBottom = 0;
			for (const child of children) {
				maxRight = Math.max(maxRight, child.position.x + child.size.width);
				maxBottom = Math.max(maxBottom, child.position.y + child.size.height);
			}

			// Expand group if children + padding exceed current size
			const neededW = maxRight + GROUP_PADDING;
			const neededH = maxBottom + GROUP_PADDING;
			if (neededW > group.size.width || neededH > group.size.height) {
				updateNodeSilent(groupId, {
					size: {
						width: Math.max(group.size.width, Math.round(neededW)),
						height: Math.max(group.size.height, Math.round(neededH))
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
		selectNodes(selNodes.map((n: any) => n.id));
		selectEdges(selEdges.map((e: any) => e.id));
	}

	let connectionJustMade = false;

	function handleConnect(connection: Connection) {
		pushHistory();
		addEdgeToStore(connection.source, connection.target, connection.sourceHandle || 'bottom', connection.targetHandle || 'top');
		connectionJustMade = true;
	}

	function handleReconnect(oldEdge: any, newConnection: Connection) {
		pushHistory();
		updateEdge(oldEdge.id, {
			source: newConnection.source,
			target: newConnection.target,
			sourceHandle: newConnection.sourceHandle || 'bottom',
			targetHandle: newConnection.targetHandle || 'top'
		});
	}

	function handleConnectEnd(event: MouseEvent | TouchEvent) {
		// If a connection was successfully made to a target, don't show the picker
		if (connectionJustMade) {
			connectionJustMade = false;
			return;
		}

		// Check if the connection was dropped on empty canvas (no target node)
		const target = event.target as HTMLElement;
		const isOnPane = target.classList.contains('svelte-flow__pane') ||
			target.closest('.svelte-flow__pane');

		if (!isOnPane || !screenToFlow) return;

		// Get the source info from the connecting class on the flow container
		const flowEl = document.querySelector('.svelte-flow');
		const connectingFrom = flowEl?.querySelector('.svelte-flow__handle.connecting');

		// Find the source node and handle from the active connection state
		const connectionLine = flowEl?.querySelector('.svelte-flow__connectionline');
		if (!connectionLine) return;

		// Get source node from the DOM — SvelteFlow adds data attributes
		const sourceHandle = flowEl?.querySelector('.svelte-flow__handle.connectingfrom') as HTMLElement;
		if (!sourceHandle) return;

		const sourceNodeId = sourceHandle.getAttribute('data-nodeid');
		const sourceHandleId = sourceHandle.getAttribute('data-handleid') || sourceHandle.getAttribute('data-handlepos') || 'bottom';

		if (!sourceNodeId) return;

		// Get screen position
		const clientX = 'touches' in event ? event.changedTouches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.changedTouches[0].clientY : event.clientY;
		const canvasPos = screenToFlow({ x: clientX, y: clientY });

		connectionPicker = {
			x: clientX,
			y: clientY,
			canvasX: canvasPos.x,
			canvasY: canvasPos.y,
			sourceNodeId,
			sourceHandleId
		};
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
			onconnectend={handleConnectEnd}
			onreconnect={handleReconnect}
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
			edgesFocusable
			edgesReconnectable
			minZoom={ZOOM_MIN}
			maxZoom={ZOOM_MAX}
			zoomOnDoubleClick={false}
			defaultEdgeOptions={defaultEdgeOptions}
			class={$gridVisible ? '' : 'hide-grid'}
			style="background-color: var(--color-canvas-bg);"
			proOptions={PRO_OPTIONS}
		>
			{#if showMinimap}
				<MiniMap
					position="bottom-right"
					style="background: color-mix(in srgb, var(--color-bg-surface) 85%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid var(--color-border-primary); border-radius: 8px; margin-bottom: 12px; margin-right: 12px;"
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

	<!-- Floating Node Toolbar (single selection) -->
	<FloatingNodeToolbar />


	<!-- Canvas Toolbar (shapes + edge type) -->
	<CanvasToolbar
		{activeTool}
		onToolChange={(t) => { activeTool = t; }}
		onAddShape={handleToolbarAddShape}
	/>

	<!-- Grid Controls (bottom-right, below minimap area) -->
	<div class="absolute bottom-3 right-3 z-20">
		<GridControls />
	</div>

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

	<!-- Connection drop picker — appears when a connection is dropped on empty canvas -->
	<ConnectionDropPicker
		picker={connectionPicker}
		onClose={() => (connectionPicker = null)}
	/>

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
