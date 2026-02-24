import { writable, derived } from 'svelte/store';
import {
	pickDirectory,
	saveHandleToIDB,
	loadHandleFromIDB,
	clearHandleFromIDB,
	verifyPermission,
	isFileSystemAccessSupported
} from '$lib/engine/fs-access';

export const directoryHandle = writable<FileSystemDirectoryHandle | null>(null);
export const workspaceName = writable<string>('');
export const workspaceReady = derived(directoryHandle, ($h) => $h !== null);
export const fsAccessSupported = writable(false);

/**
 * Try to restore a previously-opened workspace from IndexedDB.
 * Must be called from a user-gesture context to re-prompt permission.
 */
export async function restoreWorkspace(prompt = false): Promise<boolean> {
	if (!isFileSystemAccessSupported()) {
		fsAccessSupported.set(false);
		return false;
	}
	fsAccessSupported.set(true);

	const handle = await loadHandleFromIDB();
	if (!handle) return false;

	const granted = await verifyPermission(handle, prompt);
	if (!granted) return false;

	directoryHandle.set(handle);
	workspaceName.set(handle.name);
	return true;
}

/**
 * Open a new workspace via the native directory picker.
 */
export async function openWorkspace(): Promise<boolean> {
	const handle = await pickDirectory();
	if (!handle) return false;

	await saveHandleToIDB(handle);
	directoryHandle.set(handle);
	workspaceName.set(handle.name);
	return true;
}

/**
 * Close the current workspace.
 */
export async function closeWorkspace(): Promise<void> {
	await clearHandleFromIDB();
	directoryHandle.set(null);
	workspaceName.set('');
}
