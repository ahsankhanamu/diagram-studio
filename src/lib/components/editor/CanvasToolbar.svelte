<script lang="ts">
	import {
		MousePointer2,
		Square,
		Circle,
		Diamond,
		Type,
		Minus,
		Spline,
		StickyNote
	} from 'lucide-svelte';
	import { defaultEdgeType, type EdgeTypePreference } from '$lib/stores/edgePrefsStore';

	type CanvasTool = 'select' | 'rectangle' | 'circle' | 'diamond' | 'text' | 'note';

	interface Props {
		activeTool?: CanvasTool;
		onToolChange?: (tool: CanvasTool) => void;
		onAddShape?: (type: string, position?: { x: number; y: number }) => void;
	}

	let { activeTool = 'select', onToolChange, onAddShape }: Props = $props();

	let showEdgeMenu = $state(false);
	let activeEdgePreview = $derived(edgeOptions.find((o) => o.id === $defaultEdgeType)?.preview ?? edgeOptions[0].preview);

	const tools: { id: CanvasTool; icon: any; label: string; nodeType?: string }[] = [
		{ id: 'select', icon: MousePointer2, label: 'Select' },
		{ id: 'rectangle', icon: Square, label: 'Rectangle', nodeType: 'shape-rect' },
		{ id: 'circle', icon: Circle, label: 'Circle', nodeType: 'shape-circle' },
		{ id: 'diamond', icon: Diamond, label: 'Diamond', nodeType: 'shape-diamond' },
		{ id: 'text', icon: Type, label: 'Text', nodeType: 'text' },
		{ id: 'note', icon: StickyNote, label: 'Note', nodeType: 'io' }
	];

	const edgeOptions: { id: EdgeTypePreference; label: string; icon: any; preview: string }[] = [
		{ id: 'bezier', label: 'Bezier', icon: Spline, preview: 'M 4 12 C 10 4, 18 20, 24 12' },
		{ id: 'smoothstep', label: 'Smooth Step', icon: Minus, preview: 'M 4 12 L 10 12 L 10 6 L 18 6 L 18 12 L 24 12' },
		{ id: 'straight', label: 'Straight', icon: Minus, preview: 'M 4 12 L 24 12' },
		{ id: 'step', label: 'Step', icon: Minus, preview: 'M 4 12 L 14 12 L 14 6 L 24 6' }
	];

	function selectTool(tool: CanvasTool) {
		onToolChange?.(tool);
		const t = tools.find((tt) => tt.id === tool);
		if (t?.nodeType) {
			onAddShape?.(t.nodeType);
			requestAnimationFrame(() => onToolChange?.('select'));
		}
	}

	function setEdgeType(type: EdgeTypePreference) {
		defaultEdgeType.set(type);
		showEdgeMenu = false;
	}
</script>

<svelte:window onclick={() => { showEdgeMenu = false; }} />

<div class="canvas-toolbar">
	<!-- Shape tools -->
	<div class="toolbar-section">
		{#each tools as tool}
			<button
				class="toolbar-btn"
				class:toolbar-btn--active={activeTool === tool.id}
				onclick={() => selectTool(tool.id)}
				title={tool.label}
			>
				<tool.icon size={16} />
			</button>
		{/each}
	</div>

	<!-- Divider -->
	<div class="toolbar-divider"></div>

	<!-- Edge type selector -->
	<div class="toolbar-section">
		<span class="toolbar-header">Edge</span>
		<div class="relative">
			<button
				class="toolbar-btn"
				class:toolbar-btn--active={showEdgeMenu}
				title="Connection style: {$defaultEdgeType}"
				onclick={(e) => { e.stopPropagation(); showEdgeMenu = !showEdgeMenu; }}
			>
				<svg viewBox="0 0 28 18" width="20" height="14">
					<path d={activeEdgePreview} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					<polygon points="22,9 26,12 22,15" fill="currentColor" transform="translate(-1, -3)" />
				</svg>
			</button>

			{#if showEdgeMenu}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="edge-menu"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="edge-menu-header">Connection Style</div>
					{#each edgeOptions as opt}
						<button
							class="edge-menu-item"
							class:edge-menu-item--active={$defaultEdgeType === opt.id}
							onclick={() => setEdgeType(opt.id)}
						>
							<svg viewBox="0 0 28 18" class="edge-preview">
								<path d={opt.preview} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								<polygon points="22,9 26,12 22,15" fill="currentColor" transform="translate(-1, -3)" />
							</svg>
							<span>{opt.label}</span>
							{#if $defaultEdgeType === opt.id}
								<span class="edge-check">✓</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.canvas-toolbar {
		position: absolute;
		bottom: 48px;
		left: 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px;
		border-radius: 10px;
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		box-shadow: 0 2px 8px var(--color-shadow);
		z-index: 20;
	}

	.toolbar-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toolbar-header {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-text-muted);
		padding: 2px 4px 0;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background-color 0.1s, color 0.1s;
	}

	.toolbar-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.toolbar-btn--active {
		background: var(--color-accent-light) !important;
		color: var(--color-accent) !important;
	}

	.toolbar-divider {
		height: 1px;
		margin: 2px 4px;
		background: var(--color-border-primary);
	}

	.edge-menu {
		position: absolute;
		left: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
		min-width: 180px;
		padding: 4px;
		border-radius: 10px;
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		box-shadow: 0 4px 16px var(--color-shadow-strong);
		z-index: 50;
	}

	.edge-menu-header {
		padding: 6px 10px 4px;
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.edge-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.edge-menu-item:hover {
		background: var(--color-hover-overlay);
	}

	.edge-menu-item--active {
		background: var(--color-accent-light);
		color: var(--color-accent);
	}

	.edge-preview {
		width: 28px;
		height: 18px;
		flex-shrink: 0;
	}

	.edge-check {
		margin-left: auto;
		color: var(--color-accent);
		font-size: 13px;
		font-weight: 600;
	}
</style>
