<script lang="ts">
	import { onMount } from 'svelte';
	import { Trash2, FolderOpen, Link, FileCode } from 'lucide-svelte';
	import type { DiagramFile } from '$lib/types/diagram';
	import { type ImportMeta, listImportMeta, loadAllImportHandleNames } from '$lib/engine/import-cache';

	interface Props {
		activeImportId: string;
		embedded?: boolean;
		onSwitch: (id: string) => void;
		onDelete: (id: string) => void;
		onLinkToFile: (id: string) => void;
		onOpenFolder: () => void;
	}

	let { activeImportId, embedded = false, onSwitch, onDelete, onLinkToFile, onOpenFolder }: Props = $props();

	let imports = $state<ImportMeta[]>([]);
	let linkedNames = $state<Map<string, string>>(new Map());

	export async function refresh() {
		const all = await listImportMeta();
		imports = all.sort((a, b) => (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''));
		linkedNames = await loadAllImportHandleNames(imports.map((d) => d.id));
	}

	onMount(refresh);

	function relTime(iso: string | undefined): string {
		if (!iso) return '';
		const ms = Date.now() - new Date(iso).getTime();
		const m = Math.floor(ms / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	const TYPE_DOT: Record<string, string> = {
		flowchart: '#3b82f6',
		architecture: '#8b5cf6',
		erd: '#10b981',
		workflow: '#f59e0b'
	};
</script>

<div class="flex flex-col overflow-hidden" style="flex: 1;">
	{#if !embedded}
	<!-- Header (standalone mode only) -->
	<div
		class="flex items-center justify-between border-b px-3 py-2"
		style="border-color: var(--color-border-subtle);"
	>
		<span class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--color-text-muted);">
			Browser Imports
			{#if imports.length > 0}
				<span
					class="ml-1 rounded-full px-1.5 py-0.5 text-[9px]"
					style="background: var(--color-accent-light); color: var(--color-accent);"
				>{imports.length}</span>
			{/if}
		</span>
		<button
			onclick={onOpenFolder}
			class="flex h-5 w-5 items-center justify-center rounded transition-colors"
			style="color: var(--color-text-muted);"
			title="Open folder workspace"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			<FolderOpen size={12} />
		</button>
	</div>
	{/if}

	<!-- Import list -->
	<div class="flex-1 overflow-y-auto py-1">
		{#each imports as d (d.id)}
			{@const isActive = d.id === activeImportId}
			{@const linkedFile = linkedNames.get(d.id)}
			<div
				onclick={() => onSwitch(d.id)}
				class="group flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors"
				style="background: {isActive ? 'var(--color-hover-overlay)' : 'transparent'};"
				onmouseenter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)'; }}
				onmouseleave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
				role="treeitem"
				tabindex="0"
				onkeydown={(e) => { if (e.key === 'Enter') onSwitch(d.id); }}
			>
				<!-- Type dot -->
				<div
					class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
					style="background: {TYPE_DOT[d.diagramType] ?? '#6b7280'};"
				></div>

				<!-- Name + meta -->
				<div class="min-w-0 flex-1">
					<div
						class="truncate text-xs font-medium"
						style="color: {isActive ? 'var(--color-accent)' : 'var(--color-text-primary)'};"
					>
						{d.name || 'Untitled'}
					</div>
					<div class="text-[10px]" style="color: var(--color-text-muted);">
						{d.diagramType} · {relTime(d.modifiedAt)}
					</div>
					{#if linkedFile}
						<div class="mt-0.5 flex items-center gap-1 text-[10px]" style="color: var(--color-accent);">
							<FileCode size={9} />
							<span class="truncate">{linkedFile}</span>
						</div>
					{/if}
				</div>

				<!-- Action buttons (visible on hover) -->
				<div class="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						onclick={(e) => { e.stopPropagation(); onLinkToFile(d.id); }}
						class="flex h-5 w-5 items-center justify-center rounded transition-colors"
						style="color: {linkedFile ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
						title={linkedFile ? `Linked to ${linkedFile} — click to re-link` : 'Link to HTML file'}
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-accent)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = linkedFile ? 'var(--color-accent)' : 'var(--color-text-muted)')}
					>
						<Link size={11} />
					</button>
					<button
						onclick={(e) => { e.stopPropagation(); onDelete(d.id); }}
						class="flex h-5 w-5 items-center justify-center rounded transition-colors"
						style="color: var(--color-text-muted);"
						title="Remove import"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
					>
						<Trash2 size={11} />
					</button>
				</div>
			</div>
		{/each}

		{#if imports.length === 0}
			<div class="px-3 py-8 text-center">
				<p class="text-[11px]" style="color: var(--color-text-muted);">No imported diagrams</p>
			</div>
		{/if}
	</div>

	{#if !embedded}
	<!-- Footer (standalone mode only) -->
	<div class="border-t px-3 py-2.5" style="border-color: var(--color-border-subtle);">
		<button
			onclick={onOpenFolder}
			class="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
			style="background: var(--color-accent); color: #fff;"
		>
			<FolderOpen size={12} />
			Open folder to save
		</button>
	</div>
	{/if}
</div>
