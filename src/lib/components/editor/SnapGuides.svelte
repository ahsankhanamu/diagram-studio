<script lang="ts">
	import type { GuideLine } from '$lib/engine/snap-guides';

	interface Props {
		guides: GuideLine[];
	}

	const { guides }: Props = $props();
</script>

{#if guides.length > 0}
	<svg class="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
		{#each guides as guide}
			{#if guide.orientation === 'vertical'}
				<line
					x1={guide.position}
					y1="-10000"
					x2={guide.position}
					y2="10000"
					stroke="var(--color-accent)"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.5"
				/>
			{:else}
				<line
					x1="-10000"
					y1={guide.position}
					x2="10000"
					y2={guide.position}
					stroke="var(--color-accent)"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.5"
				/>
			{/if}
		{/each}
	</svg>
{/if}
