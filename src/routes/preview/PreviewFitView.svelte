<script lang="ts">
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { nodeList, edgeList } from '$lib/stores/diagramStore';
	import { renderToCanvas } from '$lib/engine/canvas-renderer';
	import { get } from 'svelte/store';

	const { fitView } = useSvelteFlow();

	onMount(() => {
		// Fit view after the flow has rendered nodes
		requestAnimationFrame(() => {
			setTimeout(() => {
				fitView({ padding: 0.12, maxZoom: 1.5, duration: 0 });

				// Render a high-quality canvas PNG and expose it for Playwright extraction
				try {
					const currentNodes = get(nodeList);
					const currentEdges = get(edgeList);
					if (currentNodes.length > 0) {
						const canvas = renderToCanvas(currentNodes, currentEdges, { scale: 2, padding: 60 });
						// Store the data URL on window for Playwright to extract
						(window as any).__DIAGRAM_PNG__ = canvas.toDataURL('image/png');
						// Also store canvas dimensions for defect analysis
						(window as any).__DIAGRAM_CANVAS__ = {
							width: canvas.width,
							height: canvas.height
						};
					}
				} catch (e) {
					console.warn('[preview] Canvas render failed:', e);
				}

				// Signal to Playwright that rendering is complete
				document.body.setAttribute('data-diagram-ready', 'true');
			}, 500);
		});
	});
</script>
