<script lang="ts">
	import type { GuideLine } from '$lib/engine/snap-guides';
	import { viewport } from '$lib/stores/viewportStore';

	interface Props {
		guides: GuideLine[];
	}

	const { guides }: Props = $props();

	// Transform flow coordinate to screen coordinate
	function toScreenX(flowX: number): number {
		return flowX * $viewport.zoom + $viewport.x;
	}
	function toScreenY(flowY: number): number {
		return flowY * $viewport.zoom + $viewport.y;
	}
</script>

{#if guides.length > 0}
	<svg class="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
		{#each guides as guide}
			{#if guide.orientation === 'vertical'}
				<line
					x1={toScreenX(guide.position)}
					y1="0"
					x2={toScreenX(guide.position)}
					y2="100%"
					stroke="var(--color-accent)"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{:else}
				<line
					x1="0"
					y1={toScreenY(guide.position)}
					x2="100%"
					y2={toScreenY(guide.position)}
					stroke="var(--color-accent)"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{/if}
		{/each}
	</svg>
{/if}
