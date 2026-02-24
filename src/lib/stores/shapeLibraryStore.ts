import { writable, get } from 'svelte/store';
import type { ShapePreset, ShapeLibrary } from '$lib/types/shape-library';
import { generateId } from '$lib/utils';
import { directoryHandle } from '$lib/stores/workspaceStore';

export const shapePresets = writable<ShapePreset[]>([]);

const LIB_DIR = '.diagram-studio';
const LIB_FILE = 'shape-library.json';

async function getLibDir(): Promise<FileSystemDirectoryHandle | null> {
	const dir = get(directoryHandle);
	if (!dir) return null;
	try {
		return await dir.getDirectoryHandle(LIB_DIR, { create: true });
	} catch {
		return null;
	}
}

export async function loadLibrary(): Promise<void> {
	const libDir = await getLibDir();
	if (!libDir) return;

	try {
		const fileHandle = await libDir.getFileHandle(LIB_FILE);
		const file = await fileHandle.getFile();
		const text = await file.text();
		const lib: ShapeLibrary = JSON.parse(text);
		shapePresets.set(lib.shapes || []);
	} catch {
		shapePresets.set([]);
	}
}

async function saveLibrary(): Promise<void> {
	const libDir = await getLibDir();
	if (!libDir) return;

	const presets = get(shapePresets);
	const lib: ShapeLibrary = {
		$schema: 'diagram-studio/shape-library-v1',
		id: 'default',
		name: 'My Shapes',
		shapes: presets
	};

	try {
		const fileHandle = await libDir.getFileHandle(LIB_FILE, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(JSON.stringify(lib, null, 2));
		await writable.close();
	} catch {
		// Silently fail — library is non-critical
	}
}

export async function saveShape(preset: Omit<ShapePreset, 'id'>): Promise<string> {
	const id = generateId('shape');
	const shape: ShapePreset = { ...preset, id };
	shapePresets.update(($p) => [...$p, shape]);
	await saveLibrary();
	return id;
}

export async function deleteShape(id: string): Promise<void> {
	shapePresets.update(($p) => $p.filter((s) => s.id !== id));
	await saveLibrary();
}
