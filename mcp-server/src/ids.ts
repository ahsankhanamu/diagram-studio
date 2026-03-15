import { nanoid } from "nanoid";

export type IdPrefix = "proj" | "diag" | "node" | "edge";

/**
 * Generate a prefixed ID matching Diagram Studio conventions.
 * Format: prefix_ + 10-char nanoid (e.g. "node_V1StGXR8_Z")
 */
export function generateId(prefix: IdPrefix): string {
  return `${prefix}_${nanoid(10)}`;
}
