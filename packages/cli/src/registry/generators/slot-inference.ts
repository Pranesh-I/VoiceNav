import type { Capability } from "../../discovery/types.js";
import type { ActionSlot } from "../types.js";

/**
 * Infers action slots from discovered capabilities.
 */
export function inferSlots(
  capability: Capability,
): ActionSlot[] {

  switch (capability.type) {
    case "route":
      return inferRouteSlots(capability);

    case "handler":
      return inferHandlerSlots(capability);

    default:
      return [];
  }
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "")
    .replace(/^(.)/, (c) => c.toLowerCase());
}

/**
 * Extracts route parameters from:
 * - React Router (dynamicParams)
 * - Next.js ([id] syntax)
 */
function inferRouteSlots(
  capability: Capability,
): ActionSlot[] {

  const dynamicParams =
    capability.metadata?.dynamicParams;

  // ✅ 1. Prefer explicit params (React Router, etc.)
  if (
    Array.isArray(dynamicParams) &&
    dynamicParams.length > 0
  ) {
    return dynamicParams.map(param => ({
      name: toCamelCase(String(param)),
      type: "string",
      required: true,
      description: `Value for "${param}" in route`,
    }));
  }

  // ✅ 2. Fallback: parse Next.js-style routes
  const path = String(
    capability.metadata?.path ?? "",
  );

  const matches =
    [...path.matchAll(/\[(.*?)\]/g)];

  return matches.map(match => {
    const rawName = match[1] ?? "";

    return {
      name: toCamelCase(rawName),
      type: "string",
      required: true,
      description: `Value for "${rawName}" in route`,
    };
  });
}

/**
 * Placeholder for handler parameter inference.
 */
function inferHandlerSlots(
  capability: Capability,
): ActionSlot[] {
  return [];
}