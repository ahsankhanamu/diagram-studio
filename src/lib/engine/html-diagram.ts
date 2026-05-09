import type { DiagramFile } from '$lib/types/diagram';

const SCRIPT_RE = /<script[^>]+data-diag="([^"]*)"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/;

export function isDiagramHtml(text: string): boolean {
	return SCRIPT_RE.test(text);
}

export function extractDiagramFromHtml(text: string): DiagramFile | null {
	const match = SCRIPT_RE.exec(text);
	if (!match) return null;
	try {
		return JSON.parse(match[2]) as DiagramFile;
	} catch {
		return null;
	}
}

export function updateDiagramInHtml(html: string, diagram: DiagramFile): string {
	return html.replace(
		/(<script[^>]+data-diag="[^"]*"[^>]*type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/,
		`$1${JSON.stringify(diagram, null, 2)}$3`
	);
}
