export const GRID_SIZE = 20;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 80;

export const HISTORY_MAX_SIZE = 100;

export const AUTOSAVE_DEBOUNCE_MS = 1000;

export const NODE_CATEGORIES = ['shapes', 'flowchart', 'architecture', 'erd', 'workflow'] as const;
export type NodeCategory = (typeof NODE_CATEGORIES)[number];
