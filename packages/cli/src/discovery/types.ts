import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

export type CapabilityType = 'route' | 'handler' | 'api_endpoint' | 'ui_action';

export type FrameworkKind =
  | 'react-router'
  | 'nextjs-pages'
  | 'nextjs-app'
  | 'vue'
  | 'unknown';

// ---------------------------------------------------------------------------
// Core contract
// ---------------------------------------------------------------------------

/**
 * A single discoverable capability found in the target codebase.
 *
 * - `id`              — stable, deterministic hex string derived from
 *                       `sourceFile`, `sourceLocation`, and `type`.
 *                       Running discovery twice on an unchanged codebase
 *                       always produces byte-identical ids.
 * - `type`            — broad category of capability.
 * - `sourceFile`      — path relative to the project root (forward slashes).
 * - `sourceLocation`  — "startLine:startCol" or "startLine:startCol-endLine:endCol".
 * - `metadata`        — type-specific payload populated by A1–A4 passes.
 */
export interface Capability {
  id: string;
  type: CapabilityType;
  sourceFile: string;
  sourceLocation: string;
  metadata: Record<string, unknown>;
}

export type CapabilityGraph = Capability[];

// ---------------------------------------------------------------------------
// Option bags
// ---------------------------------------------------------------------------

export interface WalkOptions {
  /**
   * Additional glob patterns to include on top of the defaults.
   * Patterns are relative to `rootDir`.
   */
  include?: string[];
  /**
   * Additional glob patterns to ignore on top of the defaults.
   */
  ignore?: string[];
  /**
   * Replace the default include patterns entirely.
   * When set, `include` additions are appended to this list.
   */
  includePatterns?: string[];
  /**
   * Replace the default ignore patterns entirely.
   * When set, `ignore` additions are appended to this list.
   */
  ignorePatterns?: string[];
}

export interface DiscoverOptions extends WalkOptions {
  /**
   * Override framework auto-detection.
   */
  framework?: FrameworkKind;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a **deterministic** 16-character hex id for a capability.
 *
 * The id is the first 16 hex characters of a SHA-256 digest of the
 * pipe-delimited tuple `"sourceFile|sourceLocation|type"`.
 *
 * Properties:
 *  - Same inputs  → same output (always).
 *  - Diff inputs  → statistically unique output (collision probability ≈ 2^-64).
 *  - No randomness, no timestamps, no counters.
 */
export function generateCapabilityId(
  sourceFile: string,
  sourceLocation: string,
  type: CapabilityType,
): string {
  const payload = `${sourceFile}|${sourceLocation}|${type}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}
