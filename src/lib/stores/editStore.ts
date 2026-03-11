import { writable } from 'svelte/store';

/** When set, the matching EditableLabel auto-enters edit mode (like macOS Enter-to-rename). */
export const editingNodeId = writable<string | null>(null);
