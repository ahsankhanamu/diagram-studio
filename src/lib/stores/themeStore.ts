import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'midnight';

const STORAGE_KEY = 'diagram-studio-theme';

function getInitialTheme(): Theme {
	if (!browser) return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'midnight') return stored;
	if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
	return 'light';
}

export const theme = writable<Theme>(getInitialTheme());

export const themeLabel = derived(theme, ($t) => {
	const labels: Record<Theme, string> = { light: 'Light', dark: 'Dark', midnight: 'Midnight' };
	return labels[$t];
});

export function setTheme(t: Theme): void {
	theme.set(t);
	if (browser) {
		localStorage.setItem(STORAGE_KEY, t);
		document.documentElement.setAttribute('data-theme', t);
	}
}

export function cycleTheme(): void {
	theme.update(($t) => {
		const order: Theme[] = ['light', 'dark', 'midnight'];
		const next = order[(order.indexOf($t) + 1) % order.length];
		if (browser) {
			localStorage.setItem(STORAGE_KEY, next);
			document.documentElement.setAttribute('data-theme', next);
		}
		return next;
	});
}

export function initTheme(): void {
	if (!browser) return;
	const t = getInitialTheme();
	theme.set(t);
	document.documentElement.setAttribute('data-theme', t);
}
