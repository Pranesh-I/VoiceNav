// Public API surface for the Capability Discovery Engine.
//
// Downstream consumers (A1–A4, the CLI binary, tests) should import from this
// barrel rather than from individual module files so that internal refactors
// remain invisible to callers.

// Core types & ID generation
export type {
  Capability,
  CapabilityGraph,
  CapabilityType,
  FrameworkKind,
  WalkOptions,
  DiscoverOptions,
} from './types.js';
export { generateCapabilityId } from './types.js';

// File walker
export { walkProject } from './walker.js';

// AST parser + cache
export { parseFile, createAstCache } from './parser.js';
export type { AstCache } from './parser.js';

// Framework detector
export { detectFramework } from './detector.js';

// Orchestrator + pass registration hooks
export {
  discoverCapabilities,
  registerAgnosticPass,
  registerFrameworkPass,
} from './orchestrator.js';
export type { DiscoveryPass } from './orchestrator.js';

// Route discovery (A1) — side-effect import registers framework passes
export { discoverRoutes } from './routes/index.js';

// Handler discovery (A2) — side-effect import registers agnostic pass
import './handlers/index.js';

// API Endpoint discovery (A3) — side-effect import registers agnostic pass
import './api/index.js';

// UI Discovery (A4) — side-effect import registers agnostic pass
import './ui/index.js';

