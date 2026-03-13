<script lang="ts">
	import {
		File,
		Folder,
		FolderPlus,
		FilePlus,
		Trash2,
		ChevronRight,
		ChevronDown,
		ExternalLink,
		Copy,
		Check,
		MoreVertical,
		Pencil,
		FolderOpen,
		FileText,
		ClipboardCopy
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
	let copiedField = $state<string | null>(null);

	// ─── Context / Kebab menu ───────────────────────────────────
	let menuEntry = $state<FileEntry | null>(null);
	let menuPos = $state({ x: 0, y: 0 });

	function openMenu(entry: FileEntry, x: number, y: number) {
		menuEntry = entry;
		menuPos = { x, y };
	}

	function closeMenu() {
		menuEntry = null;
	}

	function handleContextMenu(entry: FileEntry, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		openMenu(entry, e.clientX, e.clientY);
	}

	function handleKebabClick(entry: FileEntry, e: MouseEvent) {
		e.stopPropagation();
		if (menuEntry?.name === entry.name) {
			closeMenu();
			return;
		}
		const btn = e.currentTarget as HTMLElement;
		const rect = btn.getBoundingClientRect();
		openMenu(entry, rect.right + 4, rect.top);
	}

	// Close menu on outside click or Escape
	function handleWindowClick() {
		if (menuEntry) closeMenu();
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuEntry) closeMenu();
	}

	// Portal action: moves the element to document.body so it escapes overflow:hidden ancestors
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	// Clamp menu position so it doesn't overflow the viewport
	let menuStyle = $derived.by(() => {
		if (!menuEntry) return '';
		const menuW = 200;
		const menuH = 260;
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const x = Math.min(menuPos.x, vw - menuW - 8);
		const y = Math.min(menuPos.y, vh - menuH - 8);
		return `position:fixed;left:${x}px;top:${y}px;z-index:9999;`;
	});

	// ─── Clipboard helpers ──────────────────────────────────────
	async function copyToClipboard(text: string, field: string) {
		await navigator.clipboard.writeText(text);
		copiedField = field;
		setTimeout(() => { copiedField = null; }, 1500);
		closeMenu();
	}

	function getRelativePath(entry: FileEntry): string {
		return entry.name;
	}

	function getAbsolutePath(entry: FileEntry): string {
		const workspace = $workspaceName || '';
		return workspace ? `${workspace}/${entry.name}` : entry.name;
	}

	// ─── Menu actions ───────────────────────────────────────────
	function menuCopyFilename(entry: FileEntry) {
		const name = entry.kind === 'file' ? entry.baseName : entry.name;
		copyToClipboard(name, `name:${entry.name}`);
	}

	function menuCopyRelativePath(entry: FileEntry) {
		copyToClipboard(getRelativePath(entry), `rel:${entry.name}`);
	}

	function menuCopyAbsolutePath(entry: FileEntry) {
		copyToClipboard(getAbsolutePath(entry), `abs:${entry.name}`);
	}

	function menuRename(entry: FileEntry) {
		closeMenu();
		startRename(entry);
	}

	function menuDelete(entry: FileEntry) {
		closeMenu();
		handleDelete(entry);
	}

	async function menuOpenInExplorer(entry: FileEntry) {
		closeMenu();
		// Resolve the parent handle for nested entries so the dialog opens at the right folder
		let startIn: FileSystemDirectoryHandle | undefined = $directoryHandle ?? undefined;
		if (startIn && entry.name.includes('/')) {
			try {
				const parentFolder = entry.name.split('/').slice(0, -1).join('/');
				startIn = await startIn.getDirectoryHandle(parentFolder);
			} catch { /* fall back to root */ }
		} else if (startIn && entry.kind === 'directory') {
			try {
				startIn = await startIn.getDirectoryHandle(entry.name);
			} catch { /* fall back to root */ }
		}
		try {
			await (window as any).showDirectoryPicker({ mode: 'readwrite', startIn });
		} catch { /* user cancelled */ }
	}

	// ─── File operations ────────────────────────────────────────
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
		if (!$directoryHandle) return;
		try {
			await (window as any).showDirectoryPicker({
				mode: 'readwrite',
				startIn: $directoryHandle
			});
		} catch {
			// User cancelled
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

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

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
					oncontextmenu={(e) => handleContextMenu(entry, e)}
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
						onclick={(e) => handleKebabClick(entry, e)}
						class="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
						style="color: var(--color-text-muted);"
						title="More actions"
					>
						<MoreVertical size={11} />
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
							oncontextmenu={(e) => handleContextMenu({ ...child, name: `${entry.name}/${child.name}` }, e)}
						>
							<File size={13} style="color: var(--color-text-muted);" />
							<span class="min-w-0 flex-1 truncate text-xs">{child.baseName}</span>
							<span class="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100" style="color: var(--color-text-muted);">
								<MoreVertical size={11} />
							</span>
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
						oncontextmenu={(e) => handleContextMenu(entry, e)}
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
							onclick={(e) => handleKebabClick(entry, e)}
							class="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
							style="color: var(--color-text-muted);"
							title="More actions"
						>
							<MoreVertical size={11} />
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

<!-- Context menu — portaled to body to escape sidebar overflow:hidden -->
{#if menuEntry}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portal
		style={menuStyle}
		onclick={(e) => e.stopPropagation()}
		oncontextmenu={(e) => e.preventDefault()}
	>
		<div
			class="min-w-[180px] rounded-lg border py-1 shadow-xl"
			style="
				background: var(--color-bg-surface);
				border-color: var(--color-border-subtle);
				backdrop-filter: blur(12px);
			"
		>
			<!-- Copy section -->
			<button class="context-menu-item" onclick={() => menuEntry && menuCopyFilename(menuEntry)}>
				<Copy size={13} />
				<span>Copy Name</span>
				{#if copiedField === `name:${menuEntry.name}`}
					<Check size={11} class="ml-auto" style="color: var(--color-accent);" />
				{/if}
			</button>
			<button class="context-menu-item" onclick={() => menuEntry && menuCopyRelativePath(menuEntry)}>
				<FileText size={13} />
				<span>Copy Relative Path</span>
				{#if copiedField === `rel:${menuEntry.name}`}
					<Check size={11} class="ml-auto" style="color: var(--color-accent);" />
				{/if}
			</button>
			<button class="context-menu-item" onclick={() => menuEntry && menuCopyAbsolutePath(menuEntry)}>
				<ClipboardCopy size={13} />
				<span>Copy Full Path</span>
				{#if copiedField === `abs:${menuEntry.name}`}
					<Check size={11} class="ml-auto" style="color: var(--color-accent);" />
				{/if}
			</button>

			<div class="my-1 border-t" style="border-color: var(--color-border-subtle);"></div>

			<!-- Actions section -->
			{#if menuEntry.kind === 'file'}
				<button class="context-menu-item" onclick={() => menuEntry && menuRename(menuEntry)}>
					<Pencil size={13} />
					<span>Rename</span>
					<span class="ml-auto text-[10px]" style="color: var(--color-text-muted);">Double-click</span>
				</button>
			{/if}
			<button class="context-menu-item" onclick={() => menuEntry && menuOpenInExplorer(menuEntry)}>
				<FolderOpen size={13} />
				<span>Reveal in Explorer</span>
			</button>

			<div class="my-1 border-t" style="border-color: var(--color-border-subtle);"></div>

			<!-- Danger zone -->
			<button class="context-menu-item context-menu-item--danger" onclick={() => menuEntry && menuDelete(menuEntry)}>
				<Trash2 size={13} />
				<span>Delete</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.context-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 5px 12px;
		font-size: 12px;
		color: var(--color-text-secondary);
		text-align: left;
		transition: background-color 0.1s;
		cursor: pointer;
		border: none;
		background: none;
	}

	.context-menu-item:hover {
		background-color: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.context-menu-item--danger:hover {
		background-color: color-mix(in srgb, #ef4444 12%, transparent);
		color: #ef4444;
	}
</style>
