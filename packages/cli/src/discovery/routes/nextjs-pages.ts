import { relative, normalize, basename, dirname } from 'node:path';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Next.js internal page filenames that must never become routes. */
const NEXTJS_INTERNALS = new Set(['_app', '_document', '_error', '_middleware']);

/**
 * Convert a Next.js file-system path segment to a URL path.
 *
 * Examples:
 *   "about"        → "/about"
 *   "[slug]"       → "/:slug"
 *   "[...slug]"    → "/:slug*"
 *   "index"        → "" (collapsed to parent)
 */
function segmentToUrl(segment: string): string {
  // Catch-all: [...param]
  const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAllMatch) return `:${catchAllMatch[1]}*`;

  // Dynamic: [param]
  const dynamicMatch = segment.match(/^\[(.+)\]$/);
  if (dynamicMatch) return `:${dynamicMatch[1]}`;

  // index → collapse
  if (segment === 'index') return '';

  return segment;
}

/** Extract dynamic param names from a normalised URL path. */
function extractDynamicParams(urlPath: string): string[] {
  const params: string[] = [];
  for (const seg of urlPath.split('/')) {
    if (seg.startsWith(':')) params.push(seg.slice(1).replace(/\*$/, ''));
  }
  return params;
}

/**
 * Given an absolute path to a pages/** file, return the normalised URL path
 * (forward-slash, leading slash), or null if this is an internal page.
 *
 * @param absPageFile - Absolute file path, e.g. /proj/pages/blog/[slug].tsx
 * @param pagesRoot   - Absolute path to the `pages/` directory
 */
function pageFileToRoute(absPageFile: string, pagesRoot: string): string | null {
  // Relative path from pages root, e.g. "blog/[slug].tsx"
  const rel = normalize(relative(pagesRoot, absPageFile)).replace(/\\/g, '/');

  // Strip extension
  const withoutExt = rel.replace(/\.(tsx?|jsx?)$/, '');

  // Split into segments
  const segments = withoutExt.split('/');

  // Skip api/ routes — those belong to A2 (API endpoint discovery)
  if (segments[0] === 'api') return null;

  // Skip internal Next.js pages
  const fileName = segments[segments.length - 1] ?? '';
  if (NEXTJS_INTERNALS.has(fileName)) return null;

  // Convert each segment
  const urlSegments = segments.map(segmentToUrl).filter((s) => s !== '');

  const urlPath = urlSegments.length === 0 ? '/' : '/' + urlSegments.join('/');
  return urlPath;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function discoverNextjsPagesRoutes(
  files: string[],
  _cache: AstCache,
  rootDir: string,
  framework: FrameworkKind,
): Promise<Capability[]> {
  const results: Capability[] = [];

  // Locate the pages root — support both `<root>/pages/` and `<root>/src/pages/`
  const pagesCandidates = ['pages', 'src/pages'];

  for (const candidate of pagesCandidates) {
    const pagesRoot = normalize(`${rootDir}/${candidate}`).replace(/\\/g, '/');

    // Filter files that live under this pages root
    const pageFiles = files.filter((f) => {
      const norm = normalize(f).replace(/\\/g, '/');
      return norm.startsWith(pagesRoot + '/') || norm.startsWith(pagesRoot + '\\');
    });

    for (const absFile of pageFiles) {
      const urlPath = pageFileToRoute(absFile, pagesRoot);
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
