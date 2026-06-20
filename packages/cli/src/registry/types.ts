/**
 * Represents all supported VoiceNav action types.
 */
export type ActionType =
  | "navigation"
  | "handler"
  | "ui_action"
  | "api_endpoint"
  | "flow";

/**
 * Supported slot value types.
 */
export type SlotType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum";

/**
 * Represents a dynamic parameter required by an action.
 */
export interface ActionSlot {
  name: string;
  type: SlotType;
  required: boolean;
  description: string;

  enumValues?: string[];
  default?: unknown;
}

/**
 * Represents a single step in a flow action.
 */
export interface FlowStep {
  handler: string;
  slots?: ActionSlot[];
  outputAs?: string;
}

/**
 * Represents a single executable VoiceNav action.
 */
export interface ActionEntry {
  id: string;
  type: ActionType;
  description: string;
  examples?: string[] | undefined;
  path?: string | undefined;
  handler?: string | undefined;
  elementType?: string | undefined;
  label?: string | undefined;
  associatedComponent?: string | undefined;
  method?: string | undefined;
  steps?: FlowStep[] | undefined;
  slots?: ActionSlot[] | undefined;
  permissions?: string[] | undefined;
  disabled?: boolean | undefined;

  meta?: {
    category?: string;
    tags?: string[];
    addedAt: string;
    sourceCapabilityId?: string;
    sourceFile?: string;
  } | undefined;
}

/**
 * Root registry object written to voicenav.actions.json.
 */
export interface ActionRegistry {
  version: string;
  appId: string;
  generatedAt: string;
  actions: ActionEntry[];
  checksum: string;
}