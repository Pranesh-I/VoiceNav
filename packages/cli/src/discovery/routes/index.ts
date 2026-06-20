// Route discovery sub-module.
//
// This module registers three framework-specific discovery passes into the A0
// orchestrator.  Importing this file (or the parent index barrel) as a side
// effect is sufficient — the registrations happen at module load time.

import { registerFrameworkPass } from '../orchestrator.js';
import { discoverReactRouterRoutes } from './react-router.js';
import { discoverNextjsPagesRoutes } from './nextjs-pages.js';
import { discoverNextjsAppRoutes } from './nextjs-app.js';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';

// ---------------------------------------------------------------------------
// Register passes
// ---------------------------------------------------------------------------

registerFrameworkPass('react-router', discoverReactRouterRoutes);
registerFrameworkPass('nextjs-pages', discoverNextjsPagesRoutes);
registerFrameworkPass('nextjs-app', discoverNextjsAppRoutes);

// ---------------------------------------------------------------------------
// Unified entry point (used directly in tests, bypasses orchestrator)
// ---------------------------------------------------------------------------

/**
 * Run the appropriate route discovery sub-routine for the given framework.
 *
 * - 'react-router' → JSX + data-API AST passes
 * - 'nextjs-pages' → file-system pages/[...] traversal
 * - 'nextjs-app'   → file-system app/[...]/page.* traversal
 * - anything else  → returns []
 *
 * This function is intentionally framework-gated — callers must know which
 * sub-routine they want.  The orchestrator handles the gating automatically.
 */
export async function discoverRoutes(
  files: string[],
  cache: AstCache,
  rootDir: string,
  framework: FrameworkKind,
): Promise<Capability[]> {
  switch (framework) {
    case 'react-router':
      return discoverReactRouterRoutes(files, cache, rootDir, framework);
    case 'nextjs-pages':
      return discoverNextjsPagesRoutes(files, cache, rootDir, framework);
    case 'nextjs-app':
      return discoverNextjsAppRoutes(files, cache, rootDir, framework);
    default:
      return [];
  }
}

export { discoverReactRouterRoutes, discoverNextjsPagesRoutes, discoverNextjsAppRoutes };
