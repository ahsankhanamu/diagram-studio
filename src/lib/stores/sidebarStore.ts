import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LEFT_KEY = 'diagram-studio-left-panel';
const RIGHT_KEY = 'diagram-studio-right-panel';
const TAB_KEY = 'diagram-studio-active-tab';
const LEFT_WIDTH_KEY = 'diagram-studio-left-width';
const RIGHT_WIDTH_KEY = 'diagram-studio-right-width';

export const LEFT_WIDTH_DEFAULT = 224; // 14rem
export const RIGHT_WIDTH_DEFAULT = 280;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;

function readBool(key: string, fallback: boolean): boolean {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === 'false') return false;
	if (v === 'true') return true;
	return fallback;
}

function readNumber(key: string, fallback: number): number {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === null) return fallback;
	const n = parseInt(v, 10);
	return isNaN(n) ? fallback : n;
}

function persistedBool(key: string, fallback: boolean, dataAttr?: string) {
	const store = writable<boolean>(readBool(key, fallback));
	if (browser) {
		store.subscribe((v) => {
			localStorage.setItem(key, String(v));
			// Sync the data attribute on <html> so the FOUC CSS rule stays in sync
			if (dataAttr) {
				document.documentElement.setAttribute(dataAttr, v ? 'open' : 'closed');
			}
		});
	}
	return store;
}

function persistedNumber(key: string, fallback: number) {
	const store = writable<number>(readNumber(key, fallback));
	if (browser) {
		store.subscribe((v) => localStorage.setItem(key, String(Math.round(v))));
	}
	return store;
}

export const leftPanelOpen = persistedBool(LEFT_KEY, true, 'data-left-panel');
export const rightPanelOpen = persistedBool(RIGHT_KEY, true, 'data-right-panel');

export const leftPanelWidth = persistedNumber(LEFT_WIDTH_KEY, LEFT_WIDTH_DEFAULT);
export const rightPanelWidth = persistedNumber(RIGHT_WIDTH_KEY, RIGHT_WIDTH_DEFAULT);

export type SidebarTab = 'files' | 'nodes' | 'library';

export const activeTab = writable<SidebarTab>(
	browser ? ((localStorage.getItem(TAB_KEY) as SidebarTab) || 'files') : 'files'
);
if (browser) activeTab.subscribe((v) => localStorage.setItem(TAB_KEY, v));

export function toggleLeftPanel(): void {
	leftPanelOpen.update((v) => !v);
}

export function toggleRightPanel(): void {
	rightPanelOpen.update((v) => !v);
}
