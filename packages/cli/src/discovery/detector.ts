import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { FrameworkKind } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns `true` if the path exists (file or directory), `false` otherwise. */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read and JSON-parse the project's `package.json`.
 * Returns `null` if the file is missing or malformed.
 */
async function readPackageJson(
  rootDir: string,
): Promise<Record<string, unknown> | null> {
  const pkgPath = join(rootDir, 'package.json');
  try {
    const raw = await readFile(pkgPath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Collect all dependency keys from `dependencies` + `devDependencies`. */
function allDeps(pkg: Record<string, unknown>): Set<string> {
  const deps = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const block = pkg[field];
    if (block !== null && typeof block === 'object') {
      for (const key of Object.keys(block as Record<string, unknown>)) {
        deps.add(key);
      }
    }
  }
  return deps;
}

/** Check whether any of the candidate `next.config.*` filenames exist. */
async function hasNextConfig(rootDir: string): Promise<boolean> {
  const candidates = [
    'next.config.js',
    'next.config.ts',
    'next.config.mjs',
    'next.config.cjs',
  ];
  const checks = await Promise.all(
    candidates.map((name) => pathExists(join(rootDir, name))),
  );
  return checks.some(Boolean);
}

/**
 * Distinguish Next.js App Router from Pages Router by looking for the
 * characteristic `app/page.tsx` (or layout) files.  Supports both the
 * `<root>/app/` layout and the `<root>/src/app/` layout that Next.js supports.
 */
async function isNextjsAppRouter(rootDir: string): Promise<boolean> {
  const appRouterSignals = [
    // Root-level app dir
    join(rootDir, 'app', 'page.tsx'),
    join(rootDir, 'app', 'page.ts'),
    join(rootDir, 'app', 'page.js'),
    join(rootDir, 'app', 'page.jsx'),
    join(rootDir, 'app', 'layout.tsx'),
    join(rootDir, 'app', 'layout.ts'),
    join(rootDir, 'app', 'layout.js'),
    // src/ variant
    join(rootDir, 'src', 'app', 'page.tsx'),
    join(rootDir, 'src', 'app', 'page.ts'),
    join(rootDir, 'src', 'app', 'page.js'),
    join(rootDir, 'src', 'app', 'page.jsx'),
    join(rootDir, 'src', 'app', 'layout.tsx'),
  ];
  const checks = await Promise.all(appRouterSignals.map(pathExists));
  return checks.some(Boolean);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect which framework the project at `rootDir` is using.
 *
 * Detection priority:
 *  1. Next.js — presence of `next.config.*` (beats mere dep presence).
 *     - App Router  → `'nextjs-app'`   (has `app/page.*` or `src/app/page.*`)
 *     - Pages Router → `'nextjs-pages'` (has `pages/` but no app router signals)
 *  2. React Router — `react-router-dom` or `react-router` in deps.
 *  3. Vue          — `vue` in deps.
 *  4. `'unknown'`  — none of the above matched.
 */
export async function detectFramework(rootDir: string): Promise<FrameworkKind> {
  const [pkg, nextConfigPresent] = await Promise.all([
    readPackageJson(rootDir),
    hasNextConfig(rootDir),
  ]);

  // --- Next.js (config-file presence is the strongest signal) ---
  if (nextConfigPresent) {
    const appRouter = await isNextjsAppRouter(rootDir);
    return appRouter ? 'nextjs-app' : 'nextjs-pages';
  }

  // --- Dep-based detection ---
  const deps = pkg ? allDeps(pkg) : new Set<string>();

  // Next.js without a config file (rare but valid for some setups)
  if (deps.has('next')) {
    const appRouter = await isNextjsAppRouter(rootDir);
    return appRouter ? 'nextjs-app' : 'nextjs-pages';
  }

  if (deps.has('react-router-dom') || deps.has('react-router')) {
    return 'react-router';
  }

  if (deps.has('vue')) {
    return 'vue';
  }

  return 'unknown';
}
