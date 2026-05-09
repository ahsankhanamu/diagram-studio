<script lang="ts">
	import { ChevronDown, ChevronRight, FolderPlus, Trash2, FilePlus, FolderOpen, ExternalLink, Globe } from 'lucide-svelte';
	import FileExplorer from './FileExplorer.svelte';
	import ImportExplorer from './ImportExplorer.svelte';
	import { folderRoots, addFolderRoot, removeFolderRoot, type FolderRoot } from '$lib/stores/workspaceStore';

	interface Props {
		/** 'imports' | folder root index | null */
		activeSource: 'imports' | number | null;
		activeImportId: string;
		activeFile: string;
		activeFolderHandle: FileSystemDirectoryHandle | null;
		hasImports: boolean;
		importCount?: number;
		onOpenImport: (id: string) => void;
		onDeleteImport: (id: string) => void;
		onLinkImportToFile: (id: string) => void;
		onOpenFolderFile: (handle: FileSystemDirectoryHandle, path: string) => void;
		onFileCreated: (handle: FileSystemDirectoryHandle, path: string) => void;
		onFileDeleted: (handle: FileSystemDirectoryHandle, path: string) => void;
		onOpenImportFolder: () => void;
	}

	let {
		activeSource,
		activeImportId,
		activeFile,
		activeFolderHandle,
		hasImports,
		importCount = 0,
		onOpenImport,
		onDeleteImport,
		onLinkImportToFile,
		onOpenFolderFile,
		onFileCreated,
		onFileDeleted,
		onOpenImportFolder
	}: Props = $props();

	let importExplorerRef: ImportExplorer | undefined = $state();
	let fileExplorers = $state<(FileExplorer | undefined)[]>([]);
	let importsExpanded = $state(true);
	let foldersExpanded = $state<boolean[]>([]);

	// Keep foldersExpanded in sync with folderRoots length
	$effect(() => {
		const len = $folderRoots.length;
		if (foldersExpanded.length !== len) {
			foldersExpanded = Array.from({ length: len }, (_, i) =>
				i < foldersExpanded.length ? foldersExpanded[i] : true
			);
		}
	});

	export function refreshImports() {
		importExplorerRef?.refresh();
	}

	export function refreshFolder(rootIndex: number) {
		fileExplorers[rootIndex]?.refresh();
	}

	async function handleAddFolder() {
		const added = await addFolderRoot();
		if (added) {
			foldersExpanded = [...foldersExpanded, true];
		}
	}

	async function handleRemoveFolder(index: number, root: FolderRoot) {
		// If we're removing the folder that has the active file, parent must reset
		await removeFolderRoot(index);
	}

	function isFileActive(root: FolderRoot, path: string): boolean {
		return (
			activeSource !== 'imports' &&
			activeFolderHandle === root.handle &&
			activeFile === path
		);
	}
</script>

<div class="flex flex-col overflow-hidden" style="flex: 1;">
	<!-- Panel header -->
	<div
		class="flex items-center justify-between border-b px-3 py-2"
		style="border-color: var(--color-border-subtle);"
	>
		<span class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--color-text-muted);">
			Workspaces
		</span>
		<button
			onclick={handleAddFolder}
			class="flex h-5 w-5 items-center justify-center rounded transition-colors"
			style="color: var(--color-text-muted);"
			title="Add folder workspace"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			<FolderPlus size={12} />
		</button>
	</div>

	<div class="flex-1 overflow-y-auto">

		<!-- ── Browser Imports section ──────────────────────────────── -->
		{#if hasImports || activeSource === 'imports'}
			<!-- Section header -->
			<button
				onclick={() => (importsExpanded = !importsExpanded)}
				class="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors"
				style="color: var(--color-text-muted);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				{#if importsExpanded}
					<ChevronDown size={10} />
				{:else}
					<ChevronRight size={10} />
				{/if}
				<Globe size={10} class="flex-shrink-0 opacity-70" />
				<span class="text-[10px] font-medium uppercase tracking-wider">Browser Imports</span>
				{#if importCount > 0}
					<span
						class="ml-1 rounded-full px-1.5 py-px text-[9px] font-semibold leading-none"
						style="background: var(--color-accent-light); color: var(--color-accent);"
					>{importCount}</span>
				{/if}
			</button>

			{#if importsExpanded}
				<div class="border-b" style="border-color: var(--color-border-subtle);">
					<ImportExplorer
						bind:this={importExplorerRef}
						activeImportId={activeImportId}
						embedded={true}
						onSwitch={onOpenImport}
						onDelete={onDeleteImport}
						onLinkToFile={onLinkImportToFile}
						onOpenFolder={onOpenImportFolder}
					/>
				</div>
			{/if}
		{/if}

		<!-- ── Folder sections ─────────────────────────────────────── -->
		{#each $folderRoots as root, i (root.handle.name + i)}
			<!-- Section header -->
			<div
				class="group flex items-center border-b"
				style="border-color: {foldersExpanded[i] ? 'transparent' : 'var(--color-border-subtle)'};"
			>
				<button
					onclick={() => (foldersExpanded[i] = !foldersExpanded[i])}
					class="flex flex-1 items-center gap-1.5 px-2 py-1.5 text-left transition-colors"
					style="color: var(--color-text-muted);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
					{#if foldersExpanded[i]}
						<ChevronDown size={10} />
					{:else}
						<ChevronRight size={10} />
					{/if}
					<span class="truncate text-[10px] font-medium uppercase tracking-wider">{root.name}</span>
				</button>

				<!-- Per-folder actions (on hover) -->
				<div class="flex flex-shrink-0 items-center gap-0.5 pr-1 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						onclick={() => fileExplorers[i]?.refresh()}
						class="flex h-5 w-5 items-center justify-center rounded"
						style="color: var(--color-text-muted);"
						title="Refresh"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					>
						<ExternalLink size={10} />
					</button>
					<button
						onclick={() => handleRemoveFolder(i, root)}
						class="flex h-5 w-5 items-center justify-center rounded"
						style="color: var(--color-text-muted);"
						title="Remove folder from workspace"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
					>
						<Trash2 size={10} />
					</button>
				</div>
			</div>

			{#if foldersExpanded[i]}
				<div class="border-b" style="border-color: var(--color-border-subtle);">
					<FileExplorer
						bind:this={fileExplorers[i]}
						handle={root.handle}
						embedded={true}
						activeFile={activeFolderHandle === root.handle ? activeFile : ''}
						onFileSelect={(name) => onOpenFolderFile(root.handle, name)}
						onFileCreated={(name) => onFileCreated(root.handle, name)}
						onFileDeleted={(name) => onFileDeleted(root.handle, name)}
					/>
				</div>
			{/if}
		{/each}

		{#if !hasImports && $folderRoots.length === 0}
			<div class="px-3 py-8 text-center">
				<p class="mb-3 text-[11px]" style="color: var(--color-text-muted);">No workspaces open</p>
				<button
					onclick={handleAddFolder}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
					style="background: var(--color-accent); color: #fff;"
				>
					<FolderPlus size={12} />
					Open Folder
				</button>
			</div>
		{/if}
	</div>

	<!-- Footer: add folder -->
	{#if $folderRoots.length > 0 || hasImports}
		<div class="border-t px-3 py-2" style="border-color: var(--color-border-subtle);">
			<button
				onclick={handleAddFolder}
				class="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
				style="border: 1px solid var(--color-border-subtle); color: var(--color-text-muted); background: transparent;"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<FolderPlus size={12} />
				Add Folder
			</button>
		</div>
	{/if}
</div>
