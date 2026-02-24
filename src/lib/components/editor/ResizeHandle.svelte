<script lang="ts">
	import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '$lib/stores/sidebarStore';

	interface Props {
		/** 'left' = handle on right edge of left panel, 'right' = handle on left edge of right panel */
		side: 'left' | 'right';
		width: number;
		onResize: (newWidth: number) => void;
	}

	let { side, width, onResize }: Props = $props();

	let dragging = $state(false);
	let startX = 0;
	let startWidth = 0;

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		startX = e.clientX;
		startWidth = width;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
		const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
		onResize(newWidth);
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="resize-handle group"
	class:resize-handle--left={side === 'left'}
	class:resize-handle--right={side === 'right'}
	class:resize-handle--active={dragging}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	<!-- Visible thumb pill -->
	<div class="resize-thumb" class:resize-thumb--active={dragging}></div>
</div>

<style>
	.resize-handle {
		position: relative;
		width: 6px;
		flex-shrink: 0;
		cursor: ew-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		user-select: none;
		touch-action: none;
	}

	/* Wider hit area */
	.resize-handle::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 12px;
	}

	.resize-handle--left::before {
		right: -3px;
	}

	.resize-handle--right::before {
		left: -3px;
	}

	/* The visible thumb pill */
	.resize-thumb {
		width: 3px;
		height: 32px;
		border-radius: 3px;
		background: var(--color-border-secondary);
		opacity: 0;
		transition: opacity 0.15s ease, background-color 0.15s ease, height 0.15s ease;
	}

	.resize-handle:hover .resize-thumb,
	.resize-thumb--active {
		opacity: 1;
	}

	.resize-handle:hover .resize-thumb {
		background: var(--color-border-strong);
		height: 40px;
	}

	.resize-thumb--active {
		background: var(--color-accent) !important;
		opacity: 1 !important;
		height: 48px !important;
	}

	.resize-handle--active {
		cursor: ew-resize;
	}
</style>
