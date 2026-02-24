import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const EDGE_TYPE_KEY = 'diagram-studio-default-edge-type';

export type EdgeTypePreference = 'smoothstep' | 'bezier' | 'straight' | 'step';

const stored = browser ? (localStorage.getItem(EDGE_TYPE_KEY) as EdgeTypePreference | null) : null;

export const defaultEdgeType = writable<EdgeTypePreference>(stored || 'bezier');

if (browser) {
	defaultEdgeType.subscribe((v) => localStorage.setItem(EDGE_TYPE_KEY, v));
}
