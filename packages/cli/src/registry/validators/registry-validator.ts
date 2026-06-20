import { z } from "zod";

/**
 * Metadata schema for actions
 */
const ActionMetaSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  addedAt: z.string(), // you can refine to datetime later if needed
  sourceCapabilityId: z.string().optional(),
  sourceFile: z.string().optional(),
});

/**
 * Validates slot definitions.
 */
export const ActionSlotSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Slot name must be camelCase"),

  type: z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "enum",
  ]),

  required: z.boolean(),

  description: z.string().min(5),

  enumValues: z.array(z.string()).optional(),

  default: z.unknown().optional(),
});

/**
 * Validates a flow step.
 */
export const FlowStepSchema = z.object({
  handler: z.string().min(1),

  slots: z.array(ActionSlotSchema).optional(),

  outputAs: z.string().optional(),
});

/**
 * Validates a single action entry.
 */
export const ActionEntrySchema =
  z.discriminatedUnion("type", [

    z.object({
      type: z.literal("navigation"),

      id: z.string().regex(/^[a-z_]+$/, "Action ID must contain only lowercase letters and underscores"),

      description: z.string().min(15, "Description must be at least 15 characters long"),

      examples: z.array(z.string()).optional(),

      path: z.string().startsWith("/"),

      slots: z.array(ActionSlotSchema).optional(),

      permissions: z.array(z.string()).optional(),

      meta: ActionMetaSchema.optional(),
    }),

    z.object({
      type: z.literal("handler"),

      id: z.string().regex(/^[a-z_]+$/, "Action ID must contain only lowercase letters and underscores"),

      description: z.string().min(15, "Description must be at least 15 characters long"),

      handler: z.string(),

      examples: z.array(z.string()).optional(),

      slots: z.array(ActionSlotSchema).optional(),

      permissions: z.array(z.string()).optional(),

      meta: ActionMetaSchema.optional(),
    }),

    z.object({
      type: z.literal("ui_action"),

      id: z.string().regex(/^[a-z_]+$/, "Action ID must contain only lowercase letters and underscores"),

      description: z.string().min(15, "Description must be at least 15 characters long"),

      elementType: z.string().min(1),

      label: z.string().min(1),

      associatedComponent: z.string().optional(),

      examples: z.array(z.string()).optional(),

      slots: z.array(ActionSlotSchema).optional(),

      permissions: z.array(z.string()).optional(),

      meta: ActionMetaSchema.optional(),
    }),

    z.object({
      type: z.literal("api_endpoint"),

      id: z.string().regex(/^[a-z_]+$/, "Action ID must contain only lowercase letters and underscores"),

      description: z.string().min(15, "Description must be at least 15 characters long"),

      method: z.string().min(1),

      path: z.string().startsWith("/"),

      examples: z.array(z.string()).optional(),

      slots: z.array(ActionSlotSchema).optional(),

      permissions: z.array(z.string()).optional(),

      meta: ActionMetaSchema.optional(),
    }),

    z.object({
      type: z.literal("flow"),

      id: z.string().regex(/^[a-z_]+$/, "Action ID must contain only lowercase letters and underscores"),

      description: z.string().min(15, "Description must be at least 15 characters long"),

      examples: z.array(z.string()).optional(),

      steps: z.array(FlowStepSchema).min(1),

      meta: ActionMetaSchema.optional(),
    }),
  ]);

/**
 * Validates the complete registry.
 */
export const RegistrySchema =
  z.object({
    version: z.literal("2.0"),

    appId: z.string().min(1),

    actions: z.array(ActionEntrySchema)
      .min(1)
      .max(1000),

    checksum: z.string(),
  });

/**
 * Ensures all action IDs are unique.
 */
export const RegistryWithUniqueIdsSchema =
  RegistrySchema.superRefine((registry, ctx) => {
    const ids = new Set<string>();

    for (const action of registry.actions) {
      if (ids.has(action.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate action id: ${action.id}`,
        });
      }

      ids.add(action.id);
    }
  });

/**
 * Safely validates registry data.
 */
export function validateRegistry(
  registry: unknown,
) {
  return RegistryWithUniqueIdsSchema.safeParse(registry);
}