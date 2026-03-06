import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { SNAP_THRESHOLD } from '$lib/constants';

const STORAGE_KEY = 'diagram-studio-snap-settings';

export interface SnapSettings {
	gridSnap: boolean;
	alignmentSnap: boolean;
	connectorSnap: boolean;
	geometricSnap: boolean;
	threshold: number;
	showGuides: boolean;
}

const defaults: SnapSettings = {
	gridSnap: true,
	alignmentSnap: true,
	connectorSnap: true,
	geometricSnap: false,
	threshold: SNAP_THRESHOLD,
	showGuides: true
};

function loadSettings(): SnapSettings {
	if (!browser) return defaults;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...defaults, ...JSON.parse(raw) };
	} catch {}
	return defaults;
}

export const snapSettings = writable<SnapSettings>(loadSettings());

if (browser) {
	snapSettings.subscribe((v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)));
}
