import type { DiagramFile } from '$lib/types/diagram';

const DB_NAME = 'diagram-studio-imports';
const DIAGRAM_STORE = 'diagrams';
const HANDLE_STORE = 'handles';
const META_STORE = 'meta';
const VERSION = 3;

export type ImportMeta = {
	id: string;
	name: string;
	diagramType: string;
	modifiedAt: string;
};

function openImportDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(DIAGRAM_STORE)) {
				db.createObjectStore(DIAGRAM_STORE, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(HANDLE_STORE)) {
				db.createObjectStore(HANDLE_STORE);
			}
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE, { keyPath: 'id' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// ── Diagram entries ────────────────────────────────────────────────────

export async function saveImport(diagram: DiagramFile): Promise<void> {
	const db = await openImportDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction([DIAGRAM_STORE, META_STORE], 'readwrite');
		tx.objectStore(DIAGRAM_STORE).put(diagram);
		const meta: ImportMeta = {
			id: diagram.id,
			name: diagram.name,
			diagramType: diagram.diagramType,
			modifiedAt: diagram.modifiedAt ?? new Date().toISOString()
		};
		tx.objectStore(META_STORE).put(meta);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadImport(id: string): Promise<DiagramFile | null> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(DIAGRAM_STORE, 'readonly');
			const req = tx.objectStore(DIAGRAM_STORE).get(id);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

/** Lightweight listing — returns only metadata, NOT full diagram content. */
export async function listImportMeta(): Promise<ImportMeta[]> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(META_STORE, 'readonly');
			const req = tx.objectStore(META_STORE).getAll();
			req.onsuccess = () => resolve(req.result ?? []);
			req.onerror = () => resolve([]);
		});
	} catch {
		return [];
	}
}

export async function removeImport(id: string): Promise<void> {
	try {
		const db = await openImportDB();
		await new Promise<void>((resolve) => {
			const tx = db.transaction([DIAGRAM_STORE, META_STORE], 'readwrite');
			tx.objectStore(DIAGRAM_STORE).delete(id);
			tx.objectStore(META_STORE).delete(id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		});
	} catch { /* ignore */ }
	await removeImportHandle(id);
}

// ── File handle links ──────────────────────────────────────────────────

export async function saveImportHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
	try {
		const db = await openImportDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(HANDLE_STORE, 'readwrite');
			tx.objectStore(HANDLE_STORE).put(handle, id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch { /* non-fatal */ }
}

export async function loadImportHandle(id: string): Promise<FileSystemFileHandle | null> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(HANDLE_STORE, 'readonly');
			const req = tx.objectStore(HANDLE_STORE).get(id);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

export async function removeImportHandle(id: string): Promise<void> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(HANDLE_STORE, 'readwrite');
			tx.objectStore(HANDLE_STORE).delete(id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		});
	} catch { /* ignore */ }
}

/** Returns id → filename for all imports that have a linked file handle. */
export async function loadAllImportHandleNames(ids: string[]): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	for (const id of ids) {
		const handle = await loadImportHandle(id);
		if (handle) result.set(id, handle.name);
	}
	return result;
}
