<script lang="ts">
	import { Magnet } from 'lucide-svelte';
	import { snapSettings } from '$lib/stores/snapStore';

	let open = $state(false);

	function toggle(key: 'gridSnap' | 'alignmentSnap' | 'connectorSnap' | 'geometricSnap' | 'showGuides') {
		snapSettings.update((s) => ({ ...s, [key]: !s[key] }));
	}

	function setThreshold(value: number) {
		snapSettings.update((s) => ({ ...s, threshold: value }));
	}

	const anyActive = $derived(
		$snapSettings.gridSnap || $snapSettings.alignmentSnap || $snapSettings.connectorSnap || $snapSettings.geometricSnap
	);
</script>

<div class="relative">
	<button
		onclick={() => (open = !open)}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: {anyActive ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
		title="Snap settings"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Magnet size={14} />
	</button>

	{#if open}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-40"
			onclick={() => (open = false)}
			aria-label="Close snap settings"
			style="background: transparent; border: none; cursor: default;"
		></button>

		<!-- Popover -->
		<div
			class="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border py-2 shadow-lg"
			style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
		>
			<div class="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style="color: var(--color-text-tertiary);">
				Snapping
			</div>

			<label class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover-overlay)]" style="color: var(--color-text-secondary);">
				Grid
				<input
					type="checkbox"
					checked={$snapSettings.gridSnap}
					onchange={() => toggle('gridSnap')}
					class="accent-[var(--color-accent)]"
				/>
			</label>

			<label class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover-overlay)]" style="color: var(--color-text-secondary);">
				Alignment
				<input
					type="checkbox"
					checked={$snapSettings.alignmentSnap}
					onchange={() => toggle('alignmentSnap')}
					class="accent-[var(--color-accent)]"
				/>
			</label>

			<label class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover-overlay)]" style="color: var(--color-text-secondary);">
				Connector
				<input
					type="checkbox"
					checked={$snapSettings.connectorSnap}
					onchange={() => toggle('connectorSnap')}
					class="accent-[var(--color-accent)]"
				/>
			</label>

			<label class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover-overlay)]" style="color: var(--color-text-secondary);">
				Geometric
				<input
					type="checkbox"
					checked={$snapSettings.geometricSnap}
					onchange={() => toggle('geometricSnap')}
					class="accent-[var(--color-accent)]"
				/>
			</label>

			<div class="my-1 border-t" style="border-color: var(--color-border-primary);"></div>

			<label class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover-overlay)]" style="color: var(--color-text-secondary);">
				Show Guides
				<input
					type="checkbox"
					checked={$snapSettings.showGuides}
					onchange={() => toggle('showGuides')}
					class="accent-[var(--color-accent)]"
				/>
			</label>

			<div class="my-1 border-t" style="border-color: var(--color-border-primary);"></div>

			<div class="px-3 py-1.5">
				<div class="flex items-center justify-between text-xs" style="color: var(--color-text-secondary);">
					<span>Threshold</span>
					<span class="tabular-nums">{$snapSettings.threshold}px</span>
				</div>
				<input
					type="range"
					min="4"
					max="16"
					step="1"
					value={$snapSettings.threshold}
					oninput={(e) => setThreshold(Number((e.currentTarget as HTMLInputElement).value))}
					class="mt-1 w-full accent-[var(--color-accent)]"
				/>
			</div>
		</div>
	{/if}
</div>
