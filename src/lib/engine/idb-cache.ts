/**
 * IndexedDB cache layer for diagram data.
 *
 * Provides fast (~1-3ms) persistence so the user sees "Saved" immediately.
 * Filesystem sync happens async in the background via FSAA.
 *
 * Reuses the existing `diagram-studio` DB, bumped to v2 to add a
 * `diagrams` object store alongside the existing `workspace` store.
 */

import type { DiagramFile } from '$lib/types/diagram';

const DB_NAME = 'diagram-studio';
const DB_VERSION = 3;
const WORKSPACE_STORE = 'workspace';
const DIAGRAMS_STORE = 'diagrams';
const ROOTS_STORE = 'roots';

interface CachedDiagram {
	fileName: string;
	diagram: DiagramFile;
	modifiedAt: number;
	fsSyncedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Shared DB opener — handles v1 → v2 migration. */
export function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
				db.createObjectStore(WORKSPACE_STORE);
			}
			if (!db.objectStoreNames.contains(DIAGRAMS_STORE)) {
				db.createObjectStore(DIAGRAMS_STORE, { keyPath: 'fileName' });
			}
			if (!db.objectStoreNames.contains(ROOTS_STORE)) {
				db.createObjectStore(ROOTS_STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => {
			dbPromise = null;
			reject(req.error);
		};
	});
	return dbPromise;
}

/** Write a DiagramFile to IDB cache. */
export async function cacheDiagram(fileName: string, diagram: DiagramFile): Promise<void> {
	const db = await openDB();
	const entry: CachedDiagram = {
		fileName,
		diagram,
		modifiedAt: Date.now(),
		fsSyncedAt: 0
	};
	const tx = db.transaction(DIAGRAMS_STORE, 'readwrite');
	tx.objectStore(DIAGRAMS_STORE).put(entry);
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Read a cached diagram from IDB. */
export async function getCachedDiagram(fileName: string): Promise<CachedDiagram | null> {
	try {
		const db = await openDB();
		const tx = db.transaction(DIAGRAMS_STORE, 'readonly');
		const req = tx.objectStore(DIAGRAMS_STORE).get(fileName);
		return new Promise((resolve) => {
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

/** Remove a cached diagram from IDB. */
export async function removeCachedDiagram(fileName: string): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(DIAGRAMS_STORE, 'readwrite');
		tx.objectStore(DIAGRAMS_STORE).delete(fileName);
	} catch {
		// ignore
	}
}

/** Mark that a diagram has been successfully written to the filesystem. */
export async function markFsSynced(fileName: string): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(DIAGRAMS_STORE, 'readwrite');
		const store = tx.objectStore(DIAGRAMS_STORE);
		const req = store.get(fileName);
		req.onsuccess = () => {
			const entry = req.result as CachedDiagram | undefined;
			if (entry) {
				entry.fsSyncedAt = Date.now();
				store.put(entry);
			}
		};
	} catch {
		// ignore
	}
}
