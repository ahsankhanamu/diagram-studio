<script lang="ts">
	import {
		File,
		Folder,
		FolderPlus,
		FilePlus,
		Trash2,
		ChevronRight,
		ChevronDown,
		ExternalLink
	} from 'lucide-svelte';
	import type { FileEntry } from '$lib/engine/fs-access';
	import {
		listEntries,
		createEmptyDiagram,
		writeDiagramFile,
		deleteEntry,
		renameEntry,
		createFolder
	} from '$lib/engine/fs-access';
	import { directoryHandle, workspaceName } from '$lib/stores/workspaceStore';

	interface Props {
		activeFile: string;
		onFileSelect: (fileName: string) => void;
		onFileCreated: (fileName: string) => void;
		onFileDeleted: (fileName: string) => void;
	}

	let { activeFile, onFileSelect, onFileCreated, onFileDeleted }: Props = $props();

	let entries = $state<FileEntry[]>([]);
	let expandedFolders = $state<Set<string>>(new Set());
	let folderEntries = $state<Map<string, FileEntry[]>>(new Map());
	let renamingEntry = $state<string | null>(null);
	let renameValue = $state('');
	let creatingNew = $state<'file' | 'folder' | null>(null);
	let newName = $state('');

	export async function refresh() {
		if (!$directoryHandle) return;
		entries = await listEntries($directoryHandle);
	}

	$effect(() => {
		if ($directoryHandle) refresh();
	});

	async function toggleFolder(folderName: string) {
		const next = new Set(expandedFolders);
		if (next.has(folderName)) {
			next.delete(folderName);
		} else {
			next.add(folderName);
			// Load folder contents
			if ($directoryHandle) {
				try {
					const folderHandle = await $directoryHandle.getDirectoryHandle(folderName);
					const contents = await listEntries(folderHandle);
					folderEntries = new Map(folderEntries);
					folderEntries.set(folderName, contents);
				} catch {
					// ignore
				}
			}
		}
		expandedFolders = next;
	}

	function getNextUntitledName(): string {
		const existingNames = new Set(entries.filter((e) => e.kind === 'file').map((e) => e.baseName));
		if (!existingNames.has('Untitled')) return 'Untitled';
		let i = 2;
		while (existingNames.has(`Untitled ${i}`)) i++;
		return `Untitled ${i}`;
	}

	async function handleNewFile() {
		if (!$directoryHandle) return;
		const name = getNextUntitledName();
		const diagram = createEmptyDiagram(name);
		const fileName = `${name}.json`;
		await writeDiagramFile($directoryHandle, fileName, diagram);
		await refresh();
		onFileCreated(fileName);
	}

	async function handleNewFolder() {
		creatingNew = 'folder';
		newName = 'New Folder';
	}

	async function handleOpenInFinder() {
		// FSAA doesn't have a direct "reveal in Finder" API.
		// But we can prompt the user to re-pick the same directory,
		// which opens the system file picker at the workspace location.
		// As a workaround, we show the directory name as a hint.
		if (!$directoryHandle) return;
		try {
			// Try using the newer showDirectoryPicker with startIn
			await (window as any).showDirectoryPicker({
				mode: 'readwrite',
				startIn: $directoryHandle
			});
		} catch {
			// User cancelled — that's fine, they saw the folder in the picker
		}
	}

	async function commitNewFolder() {
		if (!$directoryHandle || !newName.trim()) {
			creatingNew = null;
			return;
		}
		try {
			await createFolder($directoryHandle, newName.trim());
			await refresh();
		} catch {
			// ignore
		}
		creatingNew = null;
		newName = '';
	}

	function startRename(entry: FileEntry) {
		renamingEntry = entry.name;
		renameValue = entry.kind === 'file' ? entry.baseName : entry.name;
	}

	async function commitRename(oldName: string, isFile: boolean) {
		if (!$directoryHandle || !renameValue.trim()) {
			renamingEntry = null;
			return;
		}
		const newFileName = isFile ? `${renameValue.trim()}.json` : renameValue.trim();
		if (newFileName !== oldName) {
			try {
				if (isFile) {
					// Also update the diagram name inside the JSON
					const diagram = await import('$lib/engine/fs-access').then((m) =>
						m.readDiagramFile($directoryHandle!, oldName)
					);
					if (diagram) {
						diagram.name = renameValue.trim();
						await writeDiagramFile($directoryHandle!, newFileName, diagram);
						await $directoryHandle!.removeEntry(oldName);
					} else {
						await renameEntry($directoryHandle!, oldName, newFileName);
					}
				} else {
					// Can't rename folders in FSAA — would need to recreate
				}
				await refresh();
				if (activeFile === oldName) {
					onFileSelect(newFileName);
				}
			} catch {
				// ignore
			}
		}
		renamingEntry = null;
	}

	async function handleDelete(entry: FileEntry) {
		if (!$directoryHandle) return;
		try {
			await deleteEntry($directoryHandle, entry.name);
			await refresh();
			if (activeFile === entry.name) {
				onFileDeleted(entry.name);
			}
		} catch {
			// ignore
		}
	}

	function handleRenameKeydown(e: KeyboardEvent, oldName: string, isFile: boolean) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename(oldName, isFile);
		} else if (e.key === 'Escape') {
			renamingEntry = null;
		}
	}

	function handleNewFolderKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitNewFolder();
		} else if (e.key === 'Escape') {
			creatingNew = null;
		}
	}
</script>

<div class="flex flex-col overflow-hidden" style="flex: 1;">
	<!-- Header -->
	<div
		class="flex items-center justify-between border-b px-3 py-2"
		style="border-color: var(--color-border-subtle);"
	>
		<span class="truncate text-[10px] font-semibold uppercase tracking-wider" style="color: var(--color-text-muted);">
			{$workspaceName || 'Files'}
		</span>
		<div class="flex items-center gap-0.5">
			<button
				onclick={handleOpenInFinder}
				class="flex h-5 w-5 items-center justify-center rounded transition-colors"
				style="color: var(--color-text-muted);"
				title="Open folder in system explorer"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<ExternalLink size={11} />
			</button>
			<button
				onclick={handleNewFile}
				class="flex h-5 w-5 items-center justify-center rounded transition-colors"
				style="color: var(--color-text-muted);"
				title="New diagram"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<FilePlus size={12} />
			</button>
			<button
				onclick={handleNewFolder}
				class="flex h-5 w-5 items-center justify-center rounded transition-colors"
				style="color: var(--color-text-muted);"
				title="New folder"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<FolderPlus size={12} />
			</button>
		</div>
	</div>

	<!-- File list -->
	<div class="flex-1 overflow-y-auto py-1">
		{#if creatingNew === 'folder'}
			<div class="flex items-center gap-1.5 px-3 py-1">
				<Folder size={13} style="color: var(--color-text-muted);" />
				<input
					bind:value={newName}
					onkeydown={handleNewFolderKeydown}
					onblur={commitNewFolder}
					class="min-w-0 flex-1 rounded border px-1.5 py-0.5 text-xs outline-none"
					style="background: var(--color-bg-surface-secondary); border-color: var(--color-accent); color: var(--color-text-primary);"
					autofocus
				/>
			</div>
		{/if}

		{#each entries as entry (entry.name)}
			{#if entry.kind === 'directory'}
				<!-- Folder -->
				<div
					class="group flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors cursor-pointer"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					onclick={() => toggleFolder(entry.name)}
					onkeydown={(e) => { if (e.key === 'Enter') toggleFolder(entry.name); }}
					role="treeitem"
					tabindex="0"
				>
					{#if expandedFolders.has(entry.name)}
						<ChevronDown size={11} style="color: var(--color-text-muted);" />
					{:else}
						<ChevronRight size={11} style="color: var(--color-text-muted);" />
					{/if}
					<Folder size={13} style="color: var(--color-text-muted);" />
					<span class="min-w-0 flex-1 truncate text-xs">{entry.name}</span>
					<button
						onclick={(e) => { e.stopPropagation(); handleDelete(entry); }}
						class="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
						style="color: var(--color-text-muted);"
						title="Delete folder"
					>
						<Trash2 size={10} />
					</button>
				</div>

				{#if expandedFolders.has(entry.name)}
					{#each folderEntries.get(entry.name) || [] as child (child.name)}
						<button
							onclick={() => onFileSelect(`${entry.name}/${child.name}`)}
							class="group flex w-full items-center gap-1.5 py-1 pl-8 pr-3 text-left transition-colors"
							style="color: var(--color-text-secondary); {activeFile === `${entry.name}/${child.name}` ? 'background: var(--color-hover-overlay);' : ''}"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
							onmouseleave={(e) => { if (activeFile !== `${entry.name}/${child.name}`) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
						>
							<File size={13} style="color: var(--color-text-muted);" />
							<span class="min-w-0 flex-1 truncate text-xs">{child.baseName}</span>
						</button>
					{/each}
				{/if}
			{:else}
				<!-- File -->
				{#if renamingEntry === entry.name}
					<div class="flex items-center gap-1.5 px-3 py-1">
						<File size={13} style="color: var(--color-text-muted);" />
						<input
							bind:value={renameValue}
							onkeydown={(e) => handleRenameKeydown(e, entry.name, true)}
							onblur={() => commitRename(entry.name, true)}
							class="min-w-0 flex-1 rounded border px-1.5 py-0.5 text-xs outline-none"
							style="background: var(--color-bg-surface-secondary); border-color: var(--color-accent); color: var(--color-text-primary);"
							autofocus
						/>
					</div>
				{:else}
					<div
						onclick={() => onFileSelect(entry.name)}
						ondblclick={() => startRename(entry)}
						class="group flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors cursor-pointer"
						style="color: var(--color-text-secondary); {activeFile === entry.name ? 'background: var(--color-hover-overlay);' : ''}"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => { if (activeFile !== entry.name) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
						onkeydown={(e) => { if (e.key === 'Enter') onFileSelect(entry.name); }}
						role="treeitem"
						tabindex="0"
					>
						<File size={13} style="color: {activeFile === entry.name ? 'var(--color-accent)' : 'var(--color-text-muted)'};" />
						<span class="min-w-0 flex-1 truncate text-xs">{entry.baseName}</span>
						<button
							onclick={(e) => { e.stopPropagation(); handleDelete(entry); }}
							class="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
							style="color: var(--color-text-muted);"
							title="Delete"
						>
							<Trash2 size={10} />
						</button>
					</div>
				{/if}
			{/if}
		{/each}

		{#if entries.length === 0 && !creatingNew}
			<div class="px-3 py-4 text-center">
				<p class="text-[11px]" style="color: var(--color-text-muted);">
					Empty folder
				</p>
			</div>
		{/if}
	</div>
</div>
