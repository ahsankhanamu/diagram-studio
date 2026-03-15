<script lang="ts">
	import { AlertTriangle, AlertCircle, Info, X, ChevronRight } from 'lucide-svelte';
	import { lintResults, lintPanelOpen, lintErrorCount, lintWarningCount } from '$lib/stores/linterStore';
	import { selectNodes, clearSelection } from '$lib/stores/selectionStore';
	import { nodes } from '$lib/stores/diagramStore';

	const severityIcon = {
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info
	} as const;

	const severityColor = {
		error: 'var(--color-error-text)',
		warning: 'var(--color-status-unsaved)',
		info: 'var(--color-text-muted)'
	} as const;

	const severityBg = {
		error: 'color-mix(in srgb, var(--color-error-text) 10%, transparent)',
		warning: 'color-mix(in srgb, var(--color-status-unsaved) 10%, transparent)',
		info: 'color-mix(in srgb, var(--color-text-muted) 8%, transparent)'
	} as const;

	function handleResultClick(result: { nodeId?: string; edgeId?: string }) {
		if (result.nodeId) {
			// Check if the node actually exists
			let exists = false;
			const unsub = nodes.subscribe(($n) => (exists = $n.has(result.nodeId!)));
			unsub();
			if (exists) {
				selectNodes([result.nodeId]);
			}
		} else {
			clearSelection();
		}
	}

	function close() {
		lintPanelOpen.set(false);
	}
</script>

{#if $lintPanelOpen}
	<div
		class="absolute bottom-0 left-0 right-0 z-40 flex max-h-[240px] flex-col border-t shadow-lg"
		style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
			style="border-color: var(--color-border-subtle);"
		>
			<span class="text-[11px] font-semibold" style="color: var(--color-text-primary);">
				Problems
			</span>

			{#if $lintErrorCount > 0}
				<span
					class="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
					style="background: {severityBg.error}; color: {severityColor.error};"
				>
					<AlertCircle size={10} />
					{$lintErrorCount}
				</span>
			{/if}

			{#if $lintWarningCount > 0}
				<span
					class="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
					style="background: {severityBg.warning}; color: {severityColor.warning};"
				>
					<AlertTriangle size={10} />
					{$lintWarningCount}
				</span>
			{/if}

			{#if $lintResults.length === 0}
				<span class="text-[10px]" style="color: var(--color-text-muted);">No issues</span>
			{/if}

			<div class="flex-1"></div>

			<button
				onclick={close}
				class="flex h-5 w-5 items-center justify-center rounded transition-colors"
				style="color: var(--color-text-muted);"
				title="Close problems panel"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<X size={12} />
			</button>
		</div>

		<!-- Results list -->
		<div class="flex-1 overflow-y-auto">
			{#if $lintResults.length === 0}
				<div class="flex items-center justify-center py-6">
					<span class="text-xs" style="color: var(--color-text-muted);">
						No problems found in this diagram
					</span>
				</div>
			{:else}
				{#each $lintResults as result}
					{@const Icon = severityIcon[result.severity]}
					<button
						onclick={() => handleResultClick(result)}
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
						style="color: var(--color-text-secondary);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					>
						<Icon size={13} style="color: {severityColor[result.severity]}; flex-shrink: 0;" />
						<span class="min-w-0 flex-1 truncate text-[11px]">
							{result.message}
						</span>
						{#if result.nodeId || result.edgeId}
							<ChevronRight size={10} style="color: var(--color-text-muted); flex-shrink: 0;" />
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}
