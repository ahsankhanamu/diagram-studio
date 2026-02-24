/**
 * File System Access API service.
 *
 * All diagram I/O goes through this module. The browser talks
 * directly to the local filesystem — no server round-trips.
 *
 * Directory layout:
 *
 *   <workspace>/
 *     Untitled.json         ← DiagramFile
 *     My Flow.json
 *     subfolder/
 *       another.json
 */

import type { DiagramFile } from '$lib/types/diagram';
import { generateId } from '$lib/utils';
import { openDB } from './idb-cache';

// ── Feature detection ──────────────────────────────────────────────

export function isFileSystemAccessSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ── Low-level helpers ──────────────────────────────────────────────

async function readJsonFile<T>(dirHandle: FileSystemDirectoryHandle, name: string): Promise<T> {
	const fileHandle = await dirHandle.getFileHandle(name);
	const file = await fileHandle.getFile();
	return JSON.parse(await file.text()) as T;
}

async function writeJsonFile<T>(
	dirHandle: FileSystemDirectoryHandle,
	name: string,
	data: T
): Promise<void> {
	const content = JSON.stringify(data, null, 2) + '\n';
	const fileHandle = await dirHandle.getFileHandle(name, { create: true });
	const writable = await fileHandle.createWritable({ keepExistingData: false });
	await writable.write(content);
	await writable.close();
}

// ── Directory picker ───────────────────────────────────────────────

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
	try {
		return await (window as any).showDirectoryPicker({ mode: 'readwrite' });
	} catch {
		return null; // user cancelled
	}
}

// ── Permission persistence via IndexedDB ───────────────────────────

const IDB_STORE = 'workspace';
const IDB_KEY = 'dirHandle';

export async function saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
	const db = await openDB();
	const tx = db.transaction(IDB_STORE, 'readwrite');
	tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
	try {
		const db = await openDB();
		const tx = db.transaction(IDB_STORE, 'readonly');
		const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
		return new Promise((resolve) => {
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

export async function clearHandleFromIDB(): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(IDB_STORE, 'readwrite');
		tx.objectStore(IDB_STORE).delete(IDB_KEY);
	} catch {
		// ignore
	}
}

export async function verifyPermission(
	handle: FileSystemDirectoryHandle,
	prompt = false
): Promise<boolean> {
	const opts: any = { mode: 'readwrite' };
	if ((await (handle as any).queryPermission(opts)) === 'granted') return true;
	if (prompt && (await (handle as any).requestPermission(opts)) === 'granted') return true;
	return false;
}

// ── Workspace operations ───────────────────────────────────────────

export interface FileEntry {
	name: string;
	kind: 'file' | 'directory';
	/** Without .json extension for files */
	baseName: string;
}

/**
 * List all entries (files + folders) in a directory.
 * Only shows .json files, sorted: folders first, then files alphabetically.
 */
export async function listEntries(
	dirHandle: FileSystemDirectoryHandle
): Promise<FileEntry[]> {
	const entries: FileEntry[] = [];
	for await (const [name, entry] of dirHandle.entries()) {
		if (entry.kind === 'directory') {
			entries.push({ name, kind: 'directory', baseName: name });
		} else if (entry.kind === 'file' && name.endsWith('.json')) {
			entries.push({ name, kind: 'file', baseName: name.replace('.json', '') });
		}
	}
	return entries.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

export async function readDiagramFile(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string
): Promise<DiagramFile | null> {
	try {
		return await readJsonFile<DiagramFile>(dirHandle, fileName);
	} catch {
		return null;
	}
}

export async function writeDiagramFile(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string,
	diagram: DiagramFile
): Promise<void> {
	await writeJsonFile(dirHandle, fileName, diagram);
}

export function createEmptyDiagram(name: string = 'Untitled'): DiagramFile {
	const id = generateId('diag');
	const now = new Date().toISOString();
	return {
		$schema: 'diagram-studio/diagram-v1',
		id,
		name,
		description: '',
		diagramType: 'flowchart',
		version: 1,
		createdAt: now,
		modifiedAt: now,
		viewport: { x: 0, y: 0, zoom: 1 },
		nodes: [],
		edges: [],
		metadata: { tags: [], author: '', notes: '' }
	};
}

export async function renameEntry(
	dirHandle: FileSystemDirectoryHandle,
	oldName: string,
	newName: string
): Promise<void> {
	const fileHandle = await dirHandle.getFileHandle(oldName);
	const file = await fileHandle.getFile();
	const content = await file.text();
	const newHandle = await dirHandle.getFileHandle(newName, { create: true });
	const writable = await newHandle.createWritable({ keepExistingData: false });
	await writable.write(content);
	await writable.close();
	await dirHandle.removeEntry(oldName);
}

export async function createFolder(
	dirHandle: FileSystemDirectoryHandle,
	name: string
): Promise<FileSystemDirectoryHandle> {
	return dirHandle.getDirectoryHandle(name, { create: true });
}

export async function deleteEntry(
	dirHandle: FileSystemDirectoryHandle,
	name: string
): Promise<void> {
	await dirHandle.removeEntry(name, { recursive: true });
}

export async function moveFileToFolder(
	rootHandle: FileSystemDirectoryHandle,
	fileName: string,
	folderName: string
): Promise<void> {
	const fileHandle = await rootHandle.getFileHandle(fileName);
	const file = await fileHandle.getFile();
	const content = await file.text();
	const folderHandle = await rootHandle.getDirectoryHandle(folderName);
	const newFileHandle = await folderHandle.getFileHandle(fileName, { create: true });
	const writable = await newFileHandle.createWritable();
	await writable.write(content);
	await writable.close();
	await rootHandle.removeEntry(fileName);
}

// ── File watching ──────────────────────────────────────────────────

export interface FileWatcher {
	stop(): void;
	markSelfWrite(): void;
}

export interface DirectoryWatcher {
	stop(): void;
}

export function isFileSystemObserverSupported(): boolean {
	return typeof window !== 'undefined' && 'FileSystemObserver' in window;
}

async function getFileModifiedTime(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string
): Promise<number> {
	try {
		const fileHandle = await dirHandle.getFileHandle(fileName);
		const file = await fileHandle.getFile();
		return file.lastModified;
	} catch {
		return 0;
	}
}

function watchFileWithPolling(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string,
	onExternalChange: (diagram: DiagramFile) => void,
	intervalMs: number
): FileWatcher {
	let lastModified = 0;
	let lastSelfWriteTime = 0;
	let stopped = false;

	getFileModifiedTime(dirHandle, fileName).then((t) => {
		lastModified = t;
	});

	const timer = setInterval(async () => {
		if (stopped) return;
		try {
			const currentMtime = await getFileModifiedTime(dirHandle, fileName);
			if (currentMtime === 0) return;
			if (Date.now() - lastSelfWriteTime < 2000) {
				lastModified = currentMtime;
				return;
			}
			if (currentMtime > lastModified && lastModified > 0) {
				lastModified = currentMtime;
				const diagram = await readDiagramFile(dirHandle, fileName);
				if (diagram) onExternalChange(diagram);
			} else {
				lastModified = currentMtime;
			}
		} catch {
			// file may be mid-write, skip this tick
		}
	}, intervalMs);

	return {
		stop() {
			stopped = true;
			clearInterval(timer);
		},
		markSelfWrite() {
			lastSelfWriteTime = Date.now();
		}
	};
}

function watchFileWithObserver(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string,
	onExternalChange: (diagram: DiagramFile) => void
): FileWatcher {
	let lastSelfWriteTime = 0;

	const observer = new FileSystemObserver(async (records) => {
		for (const record of records) {
			if (record.type === 'errored') {
				// Observer broke — caller should handle reconnection if needed
				return;
			}
			if (record.type !== 'modified') continue;
			if (Date.now() - lastSelfWriteTime < 2000) return;
			try {
				const diagram = await readDiagramFile(dirHandle, fileName);
				if (diagram) onExternalChange(diagram);
			} catch {
				// file may be mid-write
			}
		}
	});

	const fileHandle = dirHandle.getFileHandle(fileName).then((fh) => {
		observer.observe(fh);
	});

	// Ensure observe promise errors don't go unhandled
	fileHandle.catch(() => {});

	return {
		stop() {
			observer.disconnect();
		},
		markSelfWrite() {
			lastSelfWriteTime = Date.now();
		}
	};
}

/**
 * Watch a file for external changes (e.g. AI editing the JSON).
 * Uses FileSystemObserver when available (Chrome 133+), falls back to polling.
 */
export function watchFile(
	dirHandle: FileSystemDirectoryHandle,
	fileName: string,
	onExternalChange: (diagram: DiagramFile) => void,
	intervalMs: number = 1000
): FileWatcher {
	if (isFileSystemObserverSupported()) {
		return watchFileWithObserver(dirHandle, fileName, onExternalChange);
	}
	return watchFileWithPolling(dirHandle, fileName, onExternalChange, intervalMs);
}

/**
 * Watch a directory for file additions/deletions (observer only).
 * Returns null if FileSystemObserver is not supported.
 */
export function watchDirectory(
	dirHandle: FileSystemDirectoryHandle,
	onChange: (changes: { type: string; name: string }[]) => void
): DirectoryWatcher | null {
	if (!isFileSystemObserverSupported()) return null;

	const observer = new FileSystemObserver((records) => {
		const relevant = records
			.filter((r) => r.type === 'appeared' || r.type === 'disappeared' || r.type === 'moved')
			.map((r) => ({
				type: r.type,
				name: r.relativePathComponents[0] ?? ''
			}))
			.filter((c) => c.name !== '');

		if (relevant.length > 0) onChange(relevant);
	});

	observer.observe(dirHandle, { recursive: false });

	return {
		stop() {
			observer.disconnect();
		}
	};
}

// ── Write lock ─────────────────────────────────────────────────────

let fsWriteChain: Promise<void> = Promise.resolve();

/** Promise-chain mutex to prevent concurrent FS writes. */
export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
	const next = fsWriteChain.then(fn, fn);
	fsWriteChain = next.then(() => {}, () => {});
	return next;
}
