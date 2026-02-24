<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import type { Viewport } from '@xyflow/svelte';
	import { onMount } from 'svelte';

	interface FlowHelpers {
		screenToFlow: (pos: { x: number; y: number }) => { x: number; y: number };
		fitView: () => void;
		setViewport: (vp: Viewport) => void;
	}

	interface Props {
		onReady?: (helpers: FlowHelpers) => void;
	}

	let { onReady }: Props = $props();

	const { screenToFlowPosition, fitView, setViewport } = useSvelteFlow();

	onMount(() => {
		onReady?.({
			screenToFlow: screenToFlowPosition,
			fitView: () => fitView({ maxZoom: 1 }),
			setViewport: (vp) => setViewport(vp)
		});
	});
</script>
