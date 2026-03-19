import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { HandleDistributionMode } from '$lib/types/diagram';

const STORAGE_KEY = 'diagram-studio-handle-distribution';

const stored = browser ? (localStorage.getItem(STORAGE_KEY) as HandleDistributionMode | null) : null;

export const defaultHandleDistribution = writable<HandleDistributionMode>(stored || 'center');

if (browser) {
	defaultHandleDistribution.subscribe((v) => localStorage.setItem(STORAGE_KEY, v));
}
