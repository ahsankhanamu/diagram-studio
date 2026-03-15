<script lang="ts">
	import { addNode, addEdge } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';

	interface Props {
		id: string;
		selected: boolean;
		ports: { top: boolean; bottom: boolean; left: boolean; right: boolean };
	}

	const { id, selected, ports }: Props = $props();

	const sides = ['top', 'bottom', 'left', 'right'] as const;

	const arrowPaths: Record<string, string> = {
		top: 'M5 8V2M2.5 4.5L5 2l2.5 2.5',
		bottom: 'M5 2V8M2.5 5.5L5 8l2.5-2.5',
		left: 'M8 5H2M4.5 2.5L2 5l2.5 2.5',
		right: 'M2 5H8M5.5 2.5L8 5l-2.5 2.5'
	};

	let downPos = { x: 0, y: 0 };
	let didDrag = false;

	function onMouseDown(side: string, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		downPos = { x: e.clientX, y: e.clientY };
		didDrag = false;

		// Find the real source handle for this side on this node and dispatch mousedown on it
		const nodeEl = document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
		const handle = nodeEl?.querySelector(
			`.svelte-flow__handle.source[data-handleid="${side}"]`
		) as HTMLElement;

		if (handle) {
			// Dispatch a synthetic mousedown at the handle's center so SvelteFlow starts a connection
			const rect = handle.getBoundingClientRect();
			const syntheticEvent = new MouseEvent('mousedown', {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
				bubbles: false,
				cancelable: true,
				button: 0
			});
			didDrag = true;
			handle.dispatchEvent(syntheticEvent);
		}

		// Also listen for mouseup to detect click (no drag)
		function onMouseUp(upEvent: MouseEvent) {
			document.removeEventListener('mouseup', onMouseUp);
			const dx = upEvent.clientX - downPos.x;
			const dy = upEvent.clientY - downPos.y;
			if (Math.sqrt(dx * dx + dy * dy) < 6) {
				// It was a click, not a drag — create a new node
				quickAdd(side as 'top' | 'bottom' | 'left' | 'right');
			}
		}
		document.addEventListener('mouseup', onMouseUp);
	}

	function quickAdd(side: 'top' | 'bottom' | 'left' | 'right') {
		const el = document.querySelector(`[data-id="${id}"]`);
		const transform = el?.getAttribute('style')?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const baseX = transform ? parseFloat(transform[1]) : 0;
		const baseY = transform ? parseFloat(transform[2]) : 0;
		const nodeWidth = el?.clientWidth || 200;
		const nodeHeight = el?.clientHeight || 80;
		const gap = 80;

		let pos: { x: number; y: number };
		let sourceHandle: string;
		let targetHandle: string;

		switch (side) {
			case 'top':
				pos = { x: baseX, y: baseY - nodeHeight - gap };
				sourceHandle = 'top';
				targetHandle = 'bottom';
				break;
			case 'bottom':
				pos = { x: baseX, y: baseY + nodeHeight + gap };
				sourceHandle = 'bottom';
				targetHandle = 'top';
				break;
			case 'left':
				pos = { x: baseX - nodeWidth - gap, y: baseY };
				sourceHandle = 'left';
				targetHandle = 'right';
				break;
			case 'right':
				pos = { x: baseX + nodeWidth + gap, y: baseY };
				sourceHandle = 'right';
				targetHandle = 'left';
				break;
		}

		pushHistory();
		const newId = addNode('process', pos);
		addEdge(id, newId, sourceHandle, targetHandle);
	}
</script>

{#each sides as side}
	{#if ports[side]}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="quick-add-btn quick-add-{side}"
			onmousedown={(e) => onMouseDown(side, e)}
		>
			<svg
				width="10"
				height="10"
				viewBox="0 0 10 10"
				fill="none"
				stroke="var(--color-accent)"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d={arrowPaths[side]} />
			</svg>
		</div>
	{/if}
{/each}

<style>
	.quick-add-btn {
		position: absolute;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--color-bg-surface);
		border: 1.5px solid color-mix(in srgb, var(--color-accent) 40%, var(--color-border-primary));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: crosshair;
		z-index: 10;
		pointer-events: all;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 6px rgba(0, 0, 0, 0.05);
		transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
		opacity: 0;
		transform: scale(0.7);
		pointer-events: none;
	}

	.quick-add-btn:hover {
		background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-surface));
		border-color: var(--color-accent);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent);
	}

	.quick-add-top { top: -26px; left: 50%; margin-left: -11px; }
	.quick-add-bottom { bottom: -26px; left: 50%; margin-left: -11px; }
	.quick-add-left { left: -26px; top: 50%; margin-top: -11px; }
	.quick-add-right { right: -26px; top: 50%; margin-top: -11px; }
</style>
