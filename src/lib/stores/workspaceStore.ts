import { writable, derived, get } from 'svelte/store';
import {
	pickDirectory,
	saveHandleToIDB,
	loadHandleFromIDB,
	clearHandleFromIDB,
	verifyPermission,
	isFileSystemAccessSupported,
	saveRootsToIDB,
	loadRootsFromIDB
} from '$lib/engine/fs-access';

export type FolderRoot = { handle: FileSystemDirectoryHandle; name: string };

export const folderRoots = writable<FolderRoot[]>([]);
export const fsAccessSupported = writable(false);

// Backward-compat aliases — derived from the roots array
export const workspaceReady = derived(folderRoots, ($r) => $r.length > 0);
export const directoryHandle = derived(folderRoots, ($r) => $r[0]?.handle ?? null);
export const workspaceName = derived(folderRoots, ($r) =>
	$r.length === 1 ? $r[0].name : $r.length > 1 ? `${$r.length} folders` : ''
);

/**
 * Restore all previously-opened folders from IndexedDB.
 */
export async function restoreWorkspace(prompt = false): Promise<boolean> {
	if (!isFileSystemAccessSupported()) {
		fsAccessSupported.set(false);
		return false;
	}
	fsAccessSupported.set(true);

	// Try new multi-root format first
	const rootHandles = await loadRootsFromIDB();
	if (rootHandles.length > 0) {
		const valid: FolderRoot[] = [];
		for (const handle of rootHandles) {
			if (await verifyPermission(handle, prompt)) {
				valid.push({ handle, name: handle.name });
			}
		}
		if (valid.length > 0) {
			folderRoots.set(valid);
			return true;
		}
	}

	// Fall back to legacy single-handle format
	const handle = await loadHandleFromIDB();
	if (!handle) return false;
	if (!(await verifyPermission(handle, prompt))) return false;
	const root: FolderRoot = { handle, name: handle.name };
	folderRoots.set([root]);
	await saveRootsToIDB([handle]);
	return true;
}

/** Open the directory picker and ADD the chosen folder as a new root. */
export async function addFolderRoot(): Promise<boolean> {
	const handle = await pickDirectory();
	if (!handle) return false;
	const current = get(folderRoots);
	const updated = [...current, { handle, name: handle.name }];
	folderRoots.set(updated);
	await saveRootsToIDB(updated.map((r) => r.handle));
	// Keep legacy single-handle in sync (first root)
	await saveHandleToIDB(updated[0].handle);
	return true;
}

/** Remove a folder root by index. */
export async function removeFolderRoot(index: number): Promise<void> {
	const current = get(folderRoots);
	const updated = current.filter((_, i) => i !== index);
	folderRoots.set(updated);
	await saveRootsToIDB(updated.map((r) => r.handle));
	if (updated.length > 0) {
		await saveHandleToIDB(updated[0].handle);
	} else {
		await clearHandleFromIDB();
	}
}

/** Backward-compat: opens a folder picker and adds it as a root. */
export async function openWorkspace(): Promise<boolean> {
	return addFolderRoot();
}

export async function closeWorkspace(): Promise<void> {
	await clearHandleFromIDB();
	await saveRootsToIDB([]);
	folderRoots.set([]);
}
