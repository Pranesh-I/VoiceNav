import type { Capability } from "../discovery/types.js";

import type {
  ActionEntry,
  ActionRegistry,
  ActionType,
} from "./types.js";

import {
  generateDescription,
  generateExamples,
  inferSlots,
} from "./generators/index.js";

import { generateChecksum }
  from "./checksum/checksum-generator.js";

import { validateRegistry }
  from "./validators/registry-validator.js";

/**
 * Helper to map hexadecimal character array to lowercase alphabetical characters.
 * Ensures compatibility with /^[a-z]+$/ rules.
 */
function toAlphabetical(hex: string): string {
  const map: Record<string, string> = {
    "0": "a", "1": "b", "2": "c", "3": "d", "4": "e",
    "5": "f", "6": "g", "7": "h", "8": "i", "9": "j",
    "a": "k", "b": "l", "c": "m", "d": "n", "e": "o", "f": "p",
  };
  return hex.split("").map(char => map[char] || char).join("");
}

/**
 * Normalizes input string for clean semantic ID.
 */
function cleanStringForId(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase to snake_case
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")          // replace non-alphabetic chars with underscore
    .replace(/^_+|_+$/g, "");          // trim leading/trailing underscores
}

/**
 * Normalizes capability ID into a pure alphabetical and underscore string.
 */
function normalizeActionId(capability: Capability): string {
  let prefix = "";
  let semanticName = "";

  switch (capability.type) {
    case "route": {
      prefix = "nav";
      const path = String(capability.metadata.path ?? "");
      semanticName = cleanStringForId(path);
      break;
    }
    case "handler": {
      prefix = "fn";
      const handlerName = String(capability.metadata.handlerName ?? "");
      semanticName = cleanStringForId(handlerName);
      break;
    }
    case "ui_action": {
      prefix = "ui";
      const label = String(capability.metadata.label ?? capability.metadata.text ?? "");
      const elementType = String(capability.metadata.elementType ?? "");
      semanticName = cleanStringForId(label + "_" + elementType);
      break;
    }
    case "api_endpoint": {
      prefix = "api";
      const method = String(capability.metadata.method ?? "get");
      const path = String(capability.metadata.path ?? "");
      semanticName = cleanStringForId(method + "_" + path);
      break;
    }
    default:
      prefix = "act";
      semanticName = "unknown";
  }

  // To guarantee uniqueness and stability, append 8-character alphabetical hash
  const hashSuffix = toAlphabetical(capability.id).slice(0, 8);
  const combined = [prefix, semanticName, hashSuffix].filter(Boolean).join("_");

  // Final safeguard: replace any non-a-z_ with underscore and trim
  return combined.replace(/[^a-z_]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Reconstructs absolute parent-nested route hierarchies.
 */
function resolveRoutePaths(capabilities: Capability[]): Record<string, string> {
  const resolvedPaths: Record<string, string> = {};

  // Group routes by source file
  const routesByFile: Record<string, Capability[]> = {};
  for (const cap of capabilities) {
    if (cap.type === "route") {
      if (!routesByFile[cap.sourceFile]) {
        routesByFile[cap.sourceFile] = [];
      }
      routesByFile[cap.sourceFile].push(cap);
    }
  }

  for (const file of Object.keys(routesByFile)) {
    const fileRoutes = routesByFile[file];

    // Sort by sourceLocation (line and column)
    fileRoutes.sort((a, b) => {
      const [aLine, aCol] = a.sourceLocation.split(":").map(Number);
      const [bLine, bCol] = b.sourceLocation.split(":").map(Number);
      if (aLine !== bLine) return aLine - bLine;
      return aCol - bCol;
    });

    let currentParentPath = "";

    for (const route of fileRoutes) {
      const rawPath = String(route.metadata.path ?? "");
      const isNested = route.metadata.isNested === true;

      let resolvedPath = rawPath;
      if (isNested && currentParentPath) {
        // Construct full path
        const parent = currentParentPath.endsWith("/") ? currentParentPath.slice(0, -1) : currentParentPath;
        const child = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
        resolvedPath = parent + child;
      } else {
        // If not nested, update the active parent path
        if (!rawPath.startsWith("/")) {
          resolvedPath = "/" + rawPath;
        }
        currentParentPath = resolvedPath;
      }

      resolvedPaths[route.id] = resolvedPath;
    }
  }

  return resolvedPaths;
}

/**
 * Converts discovered capabilities
 * into registry actions.
 */
function buildActions(
  capabilities: Capability[],
): ActionEntry[] {
  const resolvedPaths = resolveRoutePaths(capabilities);

  return capabilities.map(capability => {
    let mappedType: ActionType;

    switch (capability.type) {
      case "route":
        mappedType = "navigation";
        break;
      case "handler":
        mappedType = "handler";
        break;
      case "ui_action":
        mappedType = "ui_action";
        break;
      case "api_endpoint":
        mappedType = "api_endpoint";
        break;
      default:
        mappedType = "handler";
    }

    const action: ActionEntry = {
      id: normalizeActionId(capability),
      type: mappedType,
      description: generateDescription(capability),
      examples: generateExamples(capability),
      slots: inferSlots(capability),
      meta: {
        addedAt: new Date().toISOString(),
        sourceCapabilityId: capability.id,
        sourceFile: capability.sourceFile,
      } as ActionEntry["meta"],
    };

    if (capability.type === "route") {
      action.path = resolvedPaths[capability.id] ?? String(capability.metadata.path ?? "");
    } else if (capability.type === "handler") {
      action.handler = String(capability.metadata.handlerName ?? "");
    } else if (capability.type === "ui_action") {
      action.elementType = String(capability.metadata.elementType ?? "");
      action.label = String(capability.metadata.label ?? capability.metadata.text ?? "");
      if (capability.metadata.associatedComponent) {
        action.associatedComponent = String(capability.metadata.associatedComponent);
      }
    } else if (capability.type === "api_endpoint") {
      action.method = String(capability.metadata.method ?? "GET");
      const rawPath = String(capability.metadata.path ?? "/");
      action.path = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
    }

    return action;
  });
}

/**
 * Builds a complete registry
 * from discovered capabilities.
 */
export function buildRegistry(
  capabilities: Capability[],
): ActionRegistry {

  const actions =
    buildActions(capabilities);

  const checksum =
    generateChecksum(actions);

  const registry: ActionRegistry = {
    version: "2.0",
    appId: "voicenav-app",
    generatedAt: new Date().toISOString(),
    checksum,
    actions,
  };

  const validationResult = validateRegistry(registry);

  if (!validationResult.success) {
    console.dir(
      validationResult.error.issues,
      { depth: null },
    );

    throw new Error(
      "Registry validation failed",
    );
  }

  return registry;
}