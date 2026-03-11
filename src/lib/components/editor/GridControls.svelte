<script lang="ts">
	import { Magnet, Grid3x3 } from 'lucide-svelte';
	import { snapSettings } from '$lib/stores/snapStore';
	import { gridVisible } from '$lib/stores/gridStore';

	const anySnapActive = $derived(
		$snapSettings.gridSnap || $snapSettings.alignmentSnap || $snapSettings.connectorSnap || $snapSettings.geometricSnap
	);

	function toggleAllSnap() {
		const turnOn = !anySnapActive;
		snapSettings.update((s) => ({
			...s,
			gridSnap: turnOn,
			alignmentSnap: turnOn,
			connectorSnap: turnOn,
			geometricSnap: false
		}));
	}

	function toggleGrid() {
		gridVisible.update((v) => !v);
	}
</script>

<div
	class="flex items-center gap-0.5 rounded-lg border p-0.5 opacity-50 shadow-sm transition-opacity duration-200 hover:opacity-100"
	style="background: color-mix(in srgb, var(--color-bg-surface) 85%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: var(--color-border-primary);"
>
	<button
		onclick={toggleAllSnap}
		class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
		style="color: {anySnapActive ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
		title="Toggle snap ({anySnapActive ? 'on' : 'off'})"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Magnet size={14} />
	</button>
	<button
		onclick={toggleGrid}
		class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
		style="color: {$gridVisible ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
		title="Toggle grid ({$gridVisible ? 'on' : 'off'})"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Grid3x3 size={14} />
	</button>
</div>
