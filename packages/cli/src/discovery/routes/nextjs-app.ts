import { relative, normalize } from 'node:path';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * True if a path segment is an App Router route group: `(groupName)`.
 * Route groups are layout organizers — they do NOT appear in the URL.
 */
function isRouteGroup(segment: string): boolean {
  return /^\(.+\)$/.test(segment);
}

/**
 * Convert a single App Router file-system segment to a URL segment.
 *
 * - `(group)`      → stripped (returns '')
 * - `[param]`      → `:param`
 * - `[...param]`   → `:param*`
 * - `page`         → stripped (returns '') — the "page" file itself is never in the URL
 * - everything else → as-is
 */
function appSegmentToUrl(segment: string): string {
  if (isRouteGroup(segment)) return '';

  // Catch-all: [...param]
  const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAllMatch) return `:${catchAllMatch[1]}*`;

  // Dynamic: [param]
  const dynamicMatch = segment.match(/^\[(.+)\]$/);
  if (dynamicMatch) return `:${dynamicMatch[1]}`;

  return segment;
}

/** Extract named dynamic params from a normalised URL path. */
function extractDynamicParams(urlPath: string): string[] {
  const params: string[] = [];
  for (const seg of urlPath.split('/')) {
    if (seg.startsWith(':')) params.push(seg.slice(1).replace(/\*$/, ''));
  }
  return params;
}

/**
 * Convert an absolute app/[...]/page.tsx path to a URL route.
 *
 * @param absPageFile - Absolute file path ending in page.tsx (or similar)
 * @param appRoot     - Absolute path to the app/ directory
 * @returns Normalised URL path (leading slash) or null if not a page file
 */
function appPageFileToRoute(absPageFile: string, appRoot: string): string | null {
  const normFile = normalize(absPageFile).replace(/\\/g, '/');
  const normRoot = normalize(appRoot).replace(/\\/g, '/');

  // Must be directly under appRoot
  if (!normFile.startsWith(normRoot + '/')) return null;

  // Strip app root and extension
  const rel = normFile.slice(normRoot.length + 1); // e.g. "blog/[slug]/page.tsx"

  // Must end with page.{tsx,ts,jsx,js}
  if (!/\/page\.(tsx?|jsx?)$/.test('/' + rel) && !/^page\.(tsx?|jsx?)$/.test(rel)) {
    return null;
  }

  // Remove the "page.ext" filename
  const withoutPage = rel.replace(/\/?page\.(tsx?|jsx?)$/, '');

  if (!withoutPage) {
    // app/page.tsx → "/"
    return '/';
  }

  // Split into directory segments and convert
  const urlSegments = withoutPage
    .split('/')
    .filter(Boolean)
    .map(appSegmentToUrl)
    .filter((s) => s !== '');

  return urlSegments.length === 0 ? '/' : '/' + urlSegments.join('/');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function discoverNextjsAppRoutes(
  files: string[],
  _cache: AstCache,
  rootDir: string,
  framework: FrameworkKind,
): Promise<Capability[]> {
  const results: Capability[] = [];

  // Support both `<root>/app/` and `<root>/src/app/`
  const appRootCandidates = ['app', 'src/app'];

  for (const candidate of appRootCandidates) {
    const appRoot = normalize(`${rootDir}/${candidate}`).replace(/\\/g, '/');

    // Filter to page files under this app root
    const pageFiles = files.filter((f) => {
      const norm = normalize(f).replace(/\\/g, '/');
      return (
        (norm.startsWith(appRoot + '/') || norm === appRoot) &&
        /\/page\.(tsx?|jsx?)$/.test(norm)
      );
    });

    for (const absFile of pageFiles) {
      const urlPath = appPageFileToRoute(absFile, appRoot);
      if (urlPath === null) continue;

      const relPath = normalize(relative(rootDir, absFile)).replace(/\\/g, '/');
      const dynamicParams = extractDynamicParams(urlPath);
      const loc = '1:1'; // file-level capability

      results.push({
        id: generateCapabilityId(relPath, loc, 'route'),
        type: 'route',
        sourceFile: relPath,
        sourceLocation: loc,
        metadata: {
          path: urlPath,
          dynamicParams,
          isNested: false,
          framework,
          filePath: relPath,
        },
      });
    }
  }

  return results;
}
