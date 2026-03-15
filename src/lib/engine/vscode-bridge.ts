/**
 * VS Code Webview Bridge
 *
 * Detects if the app is running inside a VS Code/Cursor webview and provides
 * postMessage-based communication with the extension host.
 */

type VsCodeApi = {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

let vscodeApi: VsCodeApi | null = null;

export function isVSCodeWebview(): boolean {
	try {
		return typeof (window as any).acquireVsCodeApi === 'function';
	} catch {
		return false;
	}
}

export function getVSCodeApi(): VsCodeApi | null {
	if (!vscodeApi && isVSCodeWebview()) {
		vscodeApi = (window as any).acquireVsCodeApi();
	}
	return vscodeApi;
}

export function postToExtension(type: string, data?: unknown): void {
	const api = getVSCodeApi();
	if (api) {
		api.postMessage({ type, data });
	}
}

export type VSCodeMessageHandler = (message: { type: string; data?: any }) => void;

export function onExtensionMessage(handler: VSCodeMessageHandler): () => void {
	const listener = (event: MessageEvent) => {
		const message = event.data;
		if (message && typeof message.type === 'string') {
			handler(message);
		}
	};
	window.addEventListener('message', listener);
	return () => window.removeEventListener('message', listener);
}
