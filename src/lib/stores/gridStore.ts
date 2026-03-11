import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'diagram-studio-grid-visible';

function loadGridVisible(): boolean {
	if (!browser) return true;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) return JSON.parse(raw);
	} catch {}
	return true;
}

export const gridVisible = writable<boolean>(loadGridVisible());

if (browser) {
	gridVisible.subscribe((v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)));
}
