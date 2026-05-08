<script lang="ts">
	import { Globe, X, CheckSquare, Square } from 'lucide-svelte';
	import type { DiagramFile } from '$lib/types/diagram';

	interface FileOption {
		name: string;
		fileName: string;
		diagramType: string;
		diagram: DiagramFile;
		checked: boolean;
	}

	interface Props {
		files: FileOption[];
		onExport: (selected: DiagramFile[]) => void;
		onClose: () => void;
	}

	let { files, onExport, onClose }: Props = $props();

	let items = $state(files.map((f) => ({ ...f })));

	const allChecked = $derived(items.every((i) => i.checked));
	const someChecked = $derived(items.some((i) => i.checked));
	const checkedCount = $derived(items.filter((i) => i.checked).length);

	function toggleAll() {
		const next = !allChecked;
		items = items.map((i) => ({ ...i, checked: next }));
	}

	function toggle(idx: number) {
		items = items.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item));
	}

	function handleExport() {
		const selected = items.filter((i) => i.checked).map((i) => i.diagram);
		if (selected.length > 0) onExport(selected);
	}

	const TYPE_LABELS: Record<string, string> = {
		flowchart: 'Flowchart',
		architecture: 'Architecture',
		erd: 'ERD',
		workflow: 'Workflow'
	};
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center"
	style="background: rgba(0,0,0,0.4);"
	onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
>
	<div
		class="flex w-[480px] max-h-[80vh] flex-col rounded-xl border shadow-2xl"
		style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
	>
		<!-- Header -->
		<div
			class="flex items-center gap-3 border-b px-5 py-4"
			style="border-color: var(--color-border-primary);"
		>
			<Globe size={18} style="color: var(--color-accent);" />
			<div class="flex-1">
				<p class="text-sm font-semibold" style="color: var(--color-text-primary);">Export as HTML</p>
				<p class="text-xs" style="color: var(--color-text-muted);">
					Select diagrams to include · {checkedCount} of {items.length} selected
				</p>
			</div>
			<button
				onclick={onClose}
				class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
				style="color: var(--color-text-muted);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<X size={15} />
			</button>
		</div>

		<!-- Select all row -->
		<div
			class="flex items-center gap-2.5 border-b px-5 py-2.5"
			style="border-color: var(--color-border-subtle); background: var(--color-bg-surface-secondary);"
		>
			<button onclick={toggleAll} class="flex items-center gap-2 text-xs font-medium" style="color: var(--color-text-secondary);">
				{#if allChecked}
					<CheckSquare size={14} style="color: var(--color-accent);" />
				{:else}
					<Square size={14} />
				{/if}
				{allChecked ? 'Deselect all' : 'Select all'}
			</button>
		</div>

		<!-- File list -->
		<div class="flex-1 overflow-y-auto py-1">
			{#each items as item, idx}
				<button
					onclick={() => toggle(idx)}
					class="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					{#if item.checked}
						<CheckSquare size={15} style="color: var(--color-accent); flex-shrink: 0;" />
					{:else}
						<Square size={15} style="color: var(--color-text-muted); flex-shrink: 0;" />
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm" style="color: var(--color-text-primary);">{item.name}</p>
						<p class="text-[11px]" style="color: var(--color-text-muted);">{item.fileName}</p>
					</div>
					<span
						class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
						style="background: var(--color-accent-light); color: var(--color-accent);"
					>
						{TYPE_LABELS[item.diagramType] ?? item.diagramType}
					</span>
				</button>
			{/each}
		</div>

		<!-- Footer -->
		<div
			class="flex items-center justify-end gap-2 border-t px-5 py-3"
			style="border-color: var(--color-border-primary);"
		>
			<button
				onclick={onClose}
				class="rounded-lg px-4 py-1.5 text-sm transition-colors"
				style="color: var(--color-text-secondary);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				Cancel
			</button>
			<button
				onclick={handleExport}
				disabled={checkedCount === 0}
				class="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-40"
				style="background: var(--color-accent);"
			>
				Export {checkedCount > 0 ? `${checkedCount} diagram${checkedCount !== 1 ? 's' : ''}` : ''}
			</button>
		</div>
	</div>
</div>
