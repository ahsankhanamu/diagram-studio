import { writable } from 'svelte/store';
import type { Viewport } from '$lib/types/diagram';

export const viewport = writable<Viewport>({ x: 0, y: 0, zoom: 1 });

export function setViewport(v: Viewport): void {
	viewport.set(v);
}
