import type { DiagramFile } from '$lib/types/diagram';

const DB_NAME = 'diagram-studio-imports';
const STORE = 'diagrams';
const VERSION = 1;

function openImportDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE, { keyPath: 'id' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveImport(diagram: DiagramFile): Promise<void> {
	const db = await openImportDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(diagram);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadImport(id: string): Promise<DiagramFile | null> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).get(id);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

export async function removeImport(id: string): Promise<void> {
	try {
		const db = await openImportDB();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE, 'readwrite');
			tx.objectStore(STORE).delete(id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		});
	} catch {
		// ignore
	}
}
