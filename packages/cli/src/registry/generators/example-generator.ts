import type { Capability } from "../../discovery/types.js";

/**
 * Generates natural language examples
 * that improve semantic matching quality.
 */
export function generateExamples(
  capability: Capability,
): string[] {

  switch (capability.type) {

    case "route":
      return generateRouteExamples(capability);

    case "handler":
      return generateHandlerExamples(capability);

    case "api_endpoint":
      return generateApiExamples(capability);

    case "ui_action":
      return generateUiExamples(capability);

    default:
      return [];
  }
}

/**
 * Generates examples for navigation actions.
 */
function generateRouteExamples(
  capability: Capability,
): string[] {

  const path = String(
    capability.metadata.path ?? "",
  );

  const page = path
    .replace(/\//g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();

  if (!page) {
    return [
      "go home",
      "open home page",
    ];
  }

  return [
    `open ${page}`,
    `go to ${page}`,
    `show ${page} page`,
    `navigate to ${page}`,
  ];
}

/**
 * Generates examples for handler actions.
 */
function generateHandlerExamples(
  capability: Capability,
): string[] {

  const handlerName = String(
    capability.metadata.handlerName ?? "",
  );

  const readable = handlerName
    .replace(/^handle/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

  return [
    readable,
    `please ${readable}`,
    `can you ${readable}`,
  ];
}

/**
 * Generates examples for API actions.
 */
function generateApiExamples(
  capability: Capability,
): string[] {

  const method = String(
    capability.metadata.method ?? "",
  ).toLowerCase();

  const path = String(
    capability.metadata.path ?? "",
  );

  return [
    `${method} request`,
    `call ${path}`,
    `execute ${method} endpoint`,
  ];
}

/**
 * Generates examples for UI actions.
 */
function generateUiExamples(
  capability: Capability,
): string[] {

  const label = String(
    capability.metadata.label ??
    capability.metadata.text ??
    "",
  );

  if (!label) {
    return [
      "click button",
      "perform action",
    ];
  }

  return [
    label.toLowerCase(),
    `click ${label.toLowerCase()}`,
    `press ${label.toLowerCase()}`,
  ];
}