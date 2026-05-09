import type { DiagramFile, DiagramNode, DiagramEdge } from '$lib/types/diagram';
import { VIEWER_CSS, VIEWER_SCRIPT, viewerHtml } from './html-viewer';
import { RENDERER_SCRIPT } from './compact-renderer';

export function hasFileSystemAccess(): boolean {
	return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

async function saveWithFSA(
	content: string,
	suggestedName: string,
	types: FilePickerAcceptType[]
): Promise<boolean> {
	if (!hasFileSystemAccess()) return false;
	try {
		const handle = await (window as any).showSaveFilePicker({ suggestedName, types });
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
		return true;
	} catch (err: any) {
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

export async function importDiagramFile(): Promise<DiagramFile | null> {
	if (hasFileSystemAccess()) {
		try {
			const [handle] = await (window as any).showOpenFilePicker({
				types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
				multiple: false
			});
			const file = await handle.getFile();
			const text = await file.text();
			return JSON.parse(text) as DiagramFile;
		} catch (err: any) {
			if (err?.name === 'AbortError') return null;
		}
	}

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

// ── HTML Export ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}



const HTML_STYLES = `
  :root { --bg:#fff; --text:#1f2937; --muted:#6b7280; --border:#e5e7eb; --accent:#2563eb; --sidebar:#f9fafb; }
  *{box-sizing:border-box}
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);background:var(--bg);margin:0}
  h1{font-size:22px;font-weight:700;margin:0 0 6px}
  .blurb{color:var(--muted);margin:0 0 20px;max-width:820px}
  .empty{padding:48px;text-align:center;color:var(--muted);font-size:14px}
  .meta{margin-top:20px;font-size:12px;color:var(--muted)}
  .meta a{color:var(--accent);text-decoration:none}
  .meta a:hover{text-decoration:underline}
  ${VIEWER_CSS}
`;

const MULTI_STYLES = `
  :root { --bg:#fff; --text:#1f2937; --muted:#6b7280; --border:#e5e7eb; --accent:#2563eb; --sidebar:#f9fafb; }
  *{box-sizing:border-box}
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);background:var(--bg);margin:0}
  .layout{display:grid;grid-template-columns:280px 1fr;min-height:100vh}
  aside{position:sticky;top:0;align-self:start;height:100vh;display:flex;flex-direction:column;background:var(--sidebar);border-right:1px solid var(--border);overflow:hidden}
  .aside-nav{flex:1;overflow-y:auto;padding:24px 20px}
  .aside-nav::-webkit-scrollbar{width:4px} .aside-nav::-webkit-scrollbar-track{background:transparent} .aside-nav::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  aside .ws-title{font-size:15px;font-weight:700;color:var(--text);margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid var(--border);line-height:1.3;word-break:break-word}
  aside h1{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 8px}
  aside ol{list-style:none;padding:0;margin:0}
  aside li{margin:2px 0;display:flex;align-items:flex-start;border-radius:6px;transition:background .12s}
  aside li:hover{background:#eef2ff}
  aside a{flex:1;color:var(--text);text-decoration:none;display:block;padding:6px 8px;font-size:13px;line-height:1.4;transition:color .12s}
  aside li:hover a,aside a.active{color:var(--accent)}
  .nav-ext{opacity:0;flex-shrink:0;align-self:center;border:none;background:transparent;color:var(--accent);cursor:pointer;padding:4px 6px;display:flex;align-items:center;transition:opacity .15s;border-radius:4px}
  aside li:hover .nav-ext{opacity:1}
  .nav-ext:hover{background:rgba(37,99,235,.1)}
  .aside-footer{flex-shrink:0;padding:12px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}
  .aside-footer a{color:var(--accent);text-decoration:none}
  .aside-footer a:hover{text-decoration:underline}
  main{padding:32px 40px 80px;width:100%}
  main h2{font-size:17px;font-weight:600;margin:0 0 6px;padding-bottom:6px;border-bottom:1px solid var(--border)}
  .blurb{color:var(--muted);margin:0 0 16px;max-width:820px;font-size:13px}
  section{margin-bottom:56px;scroll-margin-top:16px}
  @media(max-width:700px){.layout{grid-template-columns:1fr} aside{display:none} main{padding:20px 20px 60px}}
  ${VIEWER_CSS}
`;


export interface HtmlExportItem {
	diagram: DiagramFile;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

export function generateDiagramHtml(
	diagram: DiagramFile,
	nodes: DiagramNode[],
	edges: DiagramEdge[]
): string {
	const now = new Date().toLocaleString();
	// Embed only the raw diagram JSON — the compact renderer draws it client-side
	const diagData = JSON.stringify({ ...diagram, nodes, edges });

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(diagram.name)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${HTML_STYLES}</style>
</head>
<body style="padding:40px 48px 80px;max-width:1100px;margin:0 auto">
  <h1>${escapeHtml(diagram.name)}</h1>
  ${diagram.description ? `<p class="blurb">${escapeHtml(diagram.description)}</p>` : ''}
  ${viewerHtml('dv0', null)}
  <script data-diag="dv0" type="application/json">${diagData}<\/script>
  <p class="meta">Exported from <a href="https://diagram-studio.vercel.app/" target="_blank" rel="noopener">Diagram Studio</a> · ${now}</p>
${RENDERER_SCRIPT}
${VIEWER_SCRIPT}
</body>
</html>`;
}

export async function exportHtml(
	diagram: DiagramFile,
	nodes: DiagramNode[],
	edges: DiagramEdge[]
): Promise<void> {
	const html = generateDiagramHtml(diagram, nodes, edges);
	const saved = await saveWithFSA(html, `${diagram.name}.html`, [
		{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }
	]);
	if (!saved) {
		downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${diagram.name}.html`);
	}
}

export function generateMultiDiagramHtml(
	items: HtmlExportItem[],
	title: string = 'Diagrams'
): string {
	const now = new Date().toLocaleString();
	const EXT_ICO = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
	const navLinks = items
		.map(({ diagram }, i) => `<li><a href="#d${i}" data-target="d${i}">${escapeHtml(diagram.name)}</a><button class="nav-ext" onclick="dvOpenInStudio('dv${i}')" title="Open in Diagram Studio">${EXT_ICO}</button></li>`)
		.join('\n      ');

	const sections = items
		.map(({ diagram, nodes, edges }, i) => {
			const diagData = JSON.stringify({ ...diagram, nodes, edges });
			return `
  <section id="d${i}">
    <h2>${escapeHtml(diagram.name)}</h2>
    ${diagram.description ? `<p class="blurb">${escapeHtml(diagram.description)}</p>` : ''}
    ${viewerHtml(`dv${i}`, null)}
    <script data-diag="dv${i}" type="application/json">${diagData}<\/script>
  </section>`;
		})
		.join('\n');

	const navScript = `
<script>
(function(){
  var links=document.querySelectorAll('aside a[data-target]');
  var sections=document.querySelectorAll('section[id]');
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(l){l.classList.toggle('active',l.dataset.target===e.target.id);});
      }
    });
  },{threshold:0.2,rootMargin:'-10% 0px -70% 0px'});
  sections.forEach(function(s){obs.observe(s);});
})();
<\/script>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${MULTI_STYLES}</style>
</head>
<body>
<div class="layout">
  <aside>
    <div class="aside-nav">
      <p class="ws-title">${escapeHtml(title)}</p>
      <h1>Diagrams (${items.length})</h1>
      <ol>
        ${navLinks}
      </ol>
    </div>
    <div class="aside-footer">Exported ${now}<br><a href="https://diagram-studio.vercel.app/" target="_blank" rel="noopener">diagram-studio.vercel.app</a></div>
  </aside>
  <main>${sections}
  </main>
</div>
${RENDERER_SCRIPT}
${VIEWER_SCRIPT}
${navScript}
</body>
</html>`;
}

export async function exportMultiHtml(
	items: HtmlExportItem[],
	title: string = 'Diagrams'
): Promise<void> {
	const html = generateMultiDiagramHtml(items, title);
	const saved = await saveWithFSA(html, `${title}.html`, [
		{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }
	]);
	if (!saved) {
		downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${title}.html`);
	}
}

// ── Blob download ──────────────────────────────────────────────────

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
