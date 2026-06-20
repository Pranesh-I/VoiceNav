import { createHash } from "node:crypto";
import type { ActionEntry } from "../types.js";

/**
 * Generates a deterministic SHA-256 checksum
 * for a list of actions.
 */
export function generateChecksum(
  actions: ActionEntry[],
): string {

  const sortedActions = [...actions]
    .sort((a, b) => a.id.localeCompare(b.id));

  const serialized =
    JSON.stringify(sortedActions);

  return createHash("sha256")
    .update(serialized)
    .digest("hex");
}