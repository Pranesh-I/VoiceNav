import { detectFramework } from './detector.js';
import { parseFile, createAstCache, type AstCache } from './parser.js';
import { walkProject } from './walker.js';
import type { CapabilityGraph, DiscoverOptions, FrameworkKind } from './types.js';

// ---------------------------------------------------------------------------
// Pass registry (A1–A4 will register their discover functions here)
// ---------------------------------------------------------------------------

/**
 * Signature for a discovery pass.
 *
 * Each pass receives:
 *  - `files`     — sorted list of absolute source-file paths.
 *  - `cache`     — warm AST cache populated by the orchestrator.
 *  - `rootDir`   — project root (for computing relative paths).
 *  - `framework` — detected (or overridden) framework kind.
 *
 * Returns capabilities discovered by this pass.
 */
export type DiscoveryPass = (
  files: string[],
  cache: AstCache,
  rootDir: string,
  framework: FrameworkKind,
) => Promise<CapabilityGraph>;

/** Framework-agnostic passes run regardless of detected framework. */
const agnosticPasses: DiscoveryPass[] = [];

/** Framework-specific passes gated on `FrameworkKind`. */
const frameworkPasses: Map<FrameworkKind, DiscoveryPass[]> = new Map();

/**
 * Register a framework-agnostic discovery pass (handler, API endpoint, UI action).
 * Called by A2–A4 during module initialization.
 */
export function registerAgnosticPass(pass: DiscoveryPass): void {
  agnosticPasses.push(pass);
}

/**
 * Register a framework-specific discovery pass (route discovery).
 * Called by A1 during module initialization.
 */
export function registerFrameworkPass(
  framework: FrameworkKind,
  pass: DiscoveryPass,
): void {
  const existing = frameworkPasses.get(framework) ?? [];
  existing.push(pass);
  frameworkPasses.set(framework, existing);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Main entry point for the Capability Discovery Engine.
 *
 * ## Flow
 *  1. Detect (or accept) the framework.
 *  2. Walk the project for candidate source files.
 *  3. Pre-warm the shared AST cache by parsing every candidate file.
 *  4. Run all applicable discovery passes over the warm cache.
 *  5. Return the merged CapabilityGraph.
 *
 * A malformed source file is silently skipped (the parser emits a warning).
 * An `'unknown'` framework triggers a warning but does **not** crash —
 * agnostic passes still run.
 *
 * @param rootDir - Absolute path to the project root.
 * @param options - Optional walk and framework overrides.
 * @returns A (potentially empty) CapabilityGraph.
 */
export async function discoverCapabilities(
  rootDir: string,
  options: DiscoverOptions = {},
): Promise<CapabilityGraph> {
  // 1. Framework detection
  const framework: FrameworkKind =
    options.framework ?? (await detectFramework(rootDir));

  if (framework === 'unknown') {
    console.warn(
      '[VoiceNav/orchestrator] Framework could not be detected. ' +
        'Framework-specific route discovery will be skipped. ' +
        'Agnostic passes (handler, API endpoint, UI action) will still run.',
    );
  } else {
    console.info(`[VoiceNav/orchestrator] Detected framework: ${framework}`);
  }

  // 2. Walk project for candidate files
  const files = await walkProject(rootDir, options);
  console.info(
    `[VoiceNav/orchestrator] Found ${files.length} candidate source file(s).`,
  );

  // 3. Pre-warm the shared AST cache
  const cache = createAstCache();
  await Promise.all(files.map((f) => parseFile(f, cache)));

  const parsedCount = cache.size;
  const skippedCount = files.length - parsedCount;
  if (skippedCount > 0) {
    console.warn(
      `[VoiceNav/orchestrator] Skipped ${skippedCount} file(s) due to parse errors.`,
    );
  }

  // 4. Run discovery passes
  const graph: CapabilityGraph = [];

  // Framework-agnostic passes (always run)
  for (const pass of agnosticPasses) {
    const results = await pass(files, cache, rootDir, framework);
    graph.push(...results);
  }

  // Framework-specific passes (gated)
  if (framework !== 'unknown') {
    const specificPasses = frameworkPasses.get(framework) ?? [];
    for (const pass of specificPasses) {
      const results = await pass(files, cache, rootDir, framework);
      graph.push(...results);
    }
  }

  console.info(
    `[VoiceNav/orchestrator] Discovery complete. ${graph.length} capability/capabilities found.`,
  );

  return graph;
}
