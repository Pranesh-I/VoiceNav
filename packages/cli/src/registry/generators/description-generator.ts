import type { Capability } from "../../discovery/types.js";

/**
 * Converts a discovered capability into a
 * human-readable semantic description.
 */
export function generateDescription(
  capability: Capability,
): string {

  switch (capability.type) {
    case "route":
      return describeRoute(capability);
    case "handler":
      return describeHandler(capability);
    case "api_endpoint":
      return describeApi(capability);
    case "ui_action":
      return describeUiAction(capability);
    default:
      return "Unknown application action";
  }
}

/**
 * Creates a navigation description
 * from route metadata.
 */
function describeRoute(
  capability: Capability,
): string {

  const path =
    String(
      capability.metadata.path ?? "",
    );

  if (!path || path === "/") {
    return "Navigate to the home page";
  }

  const pageName = path
    .replace(/\//g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();

  return `Navigate to the ${pageName} page`;
}

/**
 * Creates a semantic description
 * from a handler name.
 */
function describeHandler(
  capability: Capability,
): string {

  const handlerName =
    String(
      capability.metadata.handlerName ?? "",
    );

  if (!handlerName || handlerName === "<anonymous>") {
    return "Execute anonymous application action handler";
  }

  const readable = handlerName
    .replace(/^handle/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return `Execute application handler to ${readable.toLowerCase()}`;
}

/**
 * Creates a description for
 * discovered API endpoints.
 */
function describeApi(
  capability: Capability,
): string {

  const method =
    String(
      capability.metadata.method ?? "GET",
    );

  const path =
    String(
      capability.metadata.path ?? "/",
    );

  return `Invoke API request to ${method} ${path} endpoint`;
}

/**
 * Creates a semantic description
 * from UI labels.
 */
function describeUiAction(
  capability: Capability,
): string {

  const label =
    String(
      capability.metadata.label ??
      capability.metadata.text ??
      "",
    );

  const elementType =
    String(
      capability.metadata.elementType ?? "element",
    );

  if (label) {
    return `Interact with the ${label} ${elementType} element`;
  }

  return `Perform user interface action on ${elementType}`;
}