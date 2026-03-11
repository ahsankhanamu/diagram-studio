<script lang="ts">
	import { addNode, addEdge } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';

	interface PickerState {
		x: number;
		y: number;
		canvasX: number;
		canvasY: number;
		sourceNodeId: string;
		sourceHandleId: string;
	}

	interface Props {
		picker: PickerState | null;
		onClose: () => void;
	}

	const { picker, onClose }: Props = $props();

	const shapeOptions = [
		{ type: 'process', label: 'Process', icon: 'rect' },
		{ type: 'decision', label: 'Decision', icon: 'diamond' },
		{ type: 'terminal', label: 'Terminal', icon: 'circle' },
		{ type: 'service', label: 'Service', icon: 'rect-fill' },
		{ type: 'database', label: 'Database', icon: 'db' },
		{ type: 'shape-rect', label: 'Rectangle', icon: 'rect-plain' },
		{ type: 'shape-circle', label: 'Circle', icon: 'circle-plain' },
		{ type: 'shape-diamond', label: 'Diamond', icon: 'diamond-plain' },
		{ type: 'io', label: 'I/O', icon: 'parallelogram' }
	];

	function selectShape(type: string) {
		if (!picker) return;
		pushHistory();
		const newId = addNode(type, { x: picker.canvasX - 90, y: picker.canvasY - 30 });
		// Determine target handle based on source handle direction
		const targetHandle = getOppositeHandle(picker.sourceHandleId);
		addEdge(picker.sourceNodeId, newId, picker.sourceHandleId, targetHandle);
		onClose();
	}

	function getOppositeHandle(sourceHandle: string): string {
		// Strip "-add" suffix from quick-add handles
		const clean = sourceHandle.replace('-add', '');
		switch (clean) {
			case 'top': return 'bottom';
			case 'bottom': return 'top';
			case 'left': return 'right';
			case 'right': return 'left';
			default: return 'top';
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('picker-backdrop')) {
			onClose();
		}
	}
</script>

{#if picker}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="picker-backdrop" onclick={handleBackdropClick}>
		<div
			class="picker-grid"
			style="left: {picker.x}px; top: {picker.y}px;"
		>
			{#each shapeOptions as opt}
				<button
					class="picker-item"
					onclick={() => selectShape(opt.type)}
					title={opt.label}
				>
					<svg width="28" height="28" viewBox="0 0 28 28" fill="none">
						{#if opt.icon === 'rect'}
							<rect x="4" y="6" width="20" height="16" rx="2" fill="var(--color-accent)" opacity="0.2" stroke="var(--color-accent)" stroke-width="1.5" />
						{:else if opt.icon === 'rect-fill'}
							<rect x="4" y="6" width="20" height="16" rx="2" fill="var(--color-node-architecture)" opacity="0.3" stroke="var(--color-node-architecture)" stroke-width="1.5" />
						{:else if opt.icon === 'rect-plain'}
							<rect x="4" y="6" width="20" height="16" rx="1" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" stroke-width="1.5" />
						{:else if opt.icon === 'diamond'}
							<rect x="6" y="6" width="16" height="16" rx="1" fill="var(--color-accent)" opacity="0.2" stroke="var(--color-accent)" stroke-width="1.5" transform="rotate(45 14 14)" />
						{:else if opt.icon === 'diamond-plain'}
							<rect x="6" y="6" width="16" height="16" rx="1" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" stroke-width="1.5" transform="rotate(45 14 14)" />
						{:else if opt.icon === 'circle'}
							<circle cx="14" cy="14" r="9" fill="var(--color-accent)" opacity="0.2" stroke="var(--color-accent)" stroke-width="1.5" />
						{:else if opt.icon === 'circle-plain'}
							<circle cx="14" cy="14" r="9" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" stroke-width="1.5" />
						{:else if opt.icon === 'db'}
							<ellipse cx="14" cy="10" rx="9" ry="4" fill="var(--color-node-architecture)" opacity="0.2" stroke="var(--color-node-architecture)" stroke-width="1.5" />
							<path d="M5 10v8c0 2.2 4 4 9 4s9-1.8 9-4v-8" fill="var(--color-node-architecture)" opacity="0.1" stroke="var(--color-node-architecture)" stroke-width="1.5" />
						{:else if opt.icon === 'parallelogram'}
							<polygon points="7,20 3,8 21,8 25,20" fill="var(--color-accent)" opacity="0.2" stroke="var(--color-accent)" stroke-width="1.5" />
						{/if}
					</svg>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.picker-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	.picker-grid {
		position: absolute;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		padding: 8px;
		background: color-mix(in srgb, var(--color-bg-surface) 92%, transparent);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--color-border-primary);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
		transform: translate(-50%, -50%);
		animation: picker-in 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes picker-in {
		from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
		to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	.picker-item {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 8px;
		border: none;
		background: var(--color-bg-surface-secondary);
		cursor: pointer;
		transition: background 0.12s ease, transform 0.12s ease;
	}

	.picker-item:hover {
		background: color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-surface));
		transform: scale(1.08);
	}

	.picker-item:active {
		transform: scale(0.96);
	}
</style>
