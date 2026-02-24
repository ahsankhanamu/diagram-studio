import type { DiagramFile } from '$lib/types/diagram';

/**
 * Check if the File System Access API is available
 */
export function hasFileSystemAccess(): boolean {
	return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Save content using File System Access API with native OS save dialog.
 * Falls back to blob download if the API is unavailable or user cancels.
 */
async function saveWithFSA(
	content: string,
	suggestedName: string,
	types: FilePickerAcceptType[]
): Promise<boolean> {
	if (!hasFileSystemAccess()) return false;
	try {
		const handle = await (window as any).showSaveFilePicker({
			suggestedName,
			types
		});
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
		return true;
	} catch (err: any) {
		// User cancelled the dialog
		if (err?.name === 'AbortError') return true;
		return false;
	}
}

export async function exportJson(diagram: DiagramFile): Promise<void> {
	const json = JSON.stringify(diagram, null, 2);
	const saved = await saveWithFSA(json, `${diagram.name}.json`, [
		{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }
	]);
	if (!saved) {
		downloadBlob(new Blob([json], { type: 'application/json' }), `${diagram.name}.json`);
	}
}

export async function exportSvg(svgElement: SVGElement, filename: string): Promise<void> {
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svgElement);
	const saved = await saveWithFSA(svgString, `${filename}.svg`, [
		{ description: 'SVG Files', accept: { 'image/svg+xml': ['.svg'] } }
	]);
	if (!saved) {
		downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), `${filename}.svg`);
	}
}

export async function exportPng(
	svgElement: SVGElement,
	filename: string,
	scale: number = 2
): Promise<void> {
	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(svgElement);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const img = new Image();
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	return new Promise((resolve) => {
		img.onload = () => {
			canvas.width = img.width * scale;
			canvas.height = img.height * scale;
			ctx.scale(scale, scale);
			ctx.drawImage(img, 0, 0);
			URL.revokeObjectURL(url);

			canvas.toBlob((blob) => {
				if (blob) downloadBlob(blob, `${filename}.png`);
				resolve();
			}, 'image/png');
		};
		img.src = url;
	});
}

/**
 * Import a diagram JSON file using File System Access API (native open dialog).
 * Falls back to a file input element if the API is unavailable.
 */
export async function importDiagramFile(): Promise<DiagramFile | null> {
	if (hasFileSystemAccess()) {
		try {
			const [handle] = await (window as any).showOpenFilePicker({
				types: [
					{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }
				],
				multiple: false
			});
			const file = await handle.getFile();
			const text = await file.text();
			return JSON.parse(text) as DiagramFile;
		} catch (err: any) {
			if (err?.name === 'AbortError') return null;
			// Fall through to legacy
		}
	}

	// Legacy fallback using file input
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return resolve(null);
			try {
				const text = await file.text();
				resolve(JSON.parse(text) as DiagramFile);
			} catch {
				resolve(null);
			}
		};
		input.click();
	});
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
