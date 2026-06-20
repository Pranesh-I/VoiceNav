/**
 * A1 — Route Discovery Tests
 *
 * Total known routes across all fixtures: 24
 *   React Router JSX:      7  (/, /about, /login, /settings/*, /users, /users/:id, /users/:id/settings, /404)
 *   React Router data-API: 6  (/blog, /blog/:slug, /blog/:slug/comments, /products/:category/:id, /dashboard, /dashboard/analytics)
 *   Next.js Pages:         6  (/, /about, /blog, /blog/:slug, /users/:id/profile, /docs/:slug*)
 *   Next.js App:           6  (/, /about, /blog, /blog/:slug, /dashboard, /users/:id)
 *   ─────────────────────────
 *   Total:                25
 *
 * Gate: ≥24/25 (≥95%) must be found.
 * False positives from FakeRoute.tsx: must be 0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAstCache, parseFile } from '../src/discovery/parser.js';
import { walkProject } from '../src/discovery/walker.js';
import { discoverRoutes } from '../src/discovery/routes/index.js';
import { discoverReactRouterRoutes } from '../src/discovery/routes/react-router.js';
import { discoverNextjsPagesRoutes } from '../src/discovery/routes/nextjs-pages.js';
import { discoverNextjsAppRoutes } from '../src/discovery/routes/nextjs-app.js';
import type { Capability } from '../src/discovery/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

/** Silence console during tests */
let warnSpy: { mockRestore: () => void };
let infoSpy: { mockRestore: () => void };
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  infoSpy.mockRestore();
});

/**
 * Walk + parse a fixture directory, returning the pre-warmed cache and file list.
 */
async function loadFixture(fixtureName: string) {
  const rootDir = resolve(FIXTURES, fixtureName);
  const files = await walkProject(rootDir);
  const cache = createAstCache();
  await Promise.all(files.map((f) => parseFile(f, cache)));
  return { rootDir, files, cache };
}

function routePaths(caps: Capability[]): string[] {
  return caps
    .filter((c) => c.type === 'route')
    .map((c) => (c.metadata as { path: string }).path)
    .sort();
}

// ---------------------------------------------------------------------------
// React Router — JSX pass
// ---------------------------------------------------------------------------

describe('React Router — JSX <Route> discovery', () => {
  it('finds all flat JSX routes', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');
    const paths = routePaths(caps);

    expect(paths).toContain('/');
    expect(paths).toContain('/about');
    expect(paths).toContain('/login');
    expect(paths).toContain('/404');
    expect(paths).toContain('/settings/*');
  });

  it('finds the parent /users JSX route', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');
    const paths = routePaths(caps);
    expect(paths).toContain('/users');
  });

  it('finds nested JSX routes with dynamic :id param', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const idRoute = caps.find(
      (c) => (c.metadata as { path: string }).path === ':id',
    );
    expect(idRoute).toBeDefined();
    const meta = idRoute!.metadata as { isNested: boolean; dynamicParams: string[] };
    expect(meta.isNested).toBe(true);
    expect(meta.dynamicParams).toContain('id');
  });

  it('finds deeply nested JSX route /users/:id/settings', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const settingsRoute = caps.find(
      (c) => (c.metadata as { path: string }).path === 'settings',
    );
    expect(settingsRoute).toBeDefined();
    const meta = settingsRoute!.metadata as { isNested: boolean };
    expect(meta.isNested).toBe(true);
  });

  it('sets routerKind to "jsx" for JSX routes', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const jsxRoutes = caps.filter(
      (c) => (c.metadata as { routerKind: string }).routerKind === 'jsx',
    );
    expect(jsxRoutes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// React Router — data-API pass
// ---------------------------------------------------------------------------

describe('React Router — createBrowserRouter data-API discovery', () => {
  it('finds flat data-API routes', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');
    const paths = routePaths(caps);

    expect(paths).toContain('/blog');
    expect(paths).toContain('/products/:category/:id');
    expect(paths).toContain('/dashboard');
  });

  it('finds nested data-API routes', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');
    const paths = routePaths(caps);

    expect(paths).toContain(':slug');
    expect(paths).toContain('comments');
    expect(paths).toContain('analytics');
  });

  it('marks nested data-API children as isNested: true', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const slugRoute = caps.find(
      (c) => (c.metadata as { path: string }).path === ':slug',
    );
    expect(slugRoute).toBeDefined();
    expect((slugRoute!.metadata as { isNested: boolean }).isNested).toBe(true);
  });

  it('extracts multiple dynamic params from /products/:category/:id', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const productsRoute = caps.find(
      (c) => (c.metadata as { path: string }).path === '/products/:category/:id',
    );
    expect(productsRoute).toBeDefined();
    const params = (productsRoute!.metadata as { dynamicParams: string[] }).dynamicParams;
    expect(params).toContain('category');
    expect(params).toContain('id');
  });

  it('sets routerKind to "data-api" for data-API routes', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');

    const dataRoutes = caps.filter(
      (c) => (c.metadata as { routerKind: string }).routerKind === 'data-api',
    );
    expect(dataRoutes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// False-positive prevention
// ---------------------------------------------------------------------------

describe('React Router — false-positive prevention', () => {
  it('produces zero routes from FakeRoute.tsx (no react-router import)', async () => {
    const rootDir = resolve(FIXTURES, 'react-router-app');
    const fakeFile = resolve(rootDir, 'src', 'FakeRoute.tsx');

    const cache = createAstCache();
    await parseFile(fakeFile, cache);

    const caps = await discoverReactRouterRoutes(
      [fakeFile],
      cache,
      rootDir,
      'react-router',
    );

    expect(caps).toHaveLength(0);
  });

  it('does not pick up objects with "path" key outside createBrowserRouter', async () => {
    const rootDir = resolve(FIXTURES, 'react-router-app');
    const fakeFile = resolve(rootDir, 'src', 'FakeRoute.tsx');

    const cache = createAstCache();
    await parseFile(fakeFile, cache);

    const caps = await discoverReactRouterRoutes(
      [fakeFile],
      cache,
      rootDir,
      'react-router',
    );

    // Even the menuItems array with path keys must not produce routes
    expect(caps.filter((c) => c.type === 'route')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Next.js Pages Router
// ---------------------------------------------------------------------------

describe('Next.js Pages Router — file-system route discovery', () => {
  it('finds the root index page as /', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths).toContain('/');
  });

  it('finds /about page', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths).toContain('/about');
  });

  it('finds /blog from blog/index.tsx', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths).toContain('/blog');
  });

  it('converts [slug].tsx to /blog/:slug with dynamic param', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');

    const slugRoute = caps.find(
      (c) => (c.metadata as { path: string }).path === '/blog/:slug',
    );
    expect(slugRoute).toBeDefined();
    const params = (slugRoute!.metadata as { dynamicParams: string[] }).dynamicParams;
    expect(params).toContain('slug');
  });

  it('converts users/[id]/profile.tsx to /users/:id/profile', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths).toContain('/users/:id/profile');
  });

  it('converts [...slug].tsx to /docs/:slug* (catch-all)', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths).toContain('/docs/:slug*');
  });

  it('strips _app.tsx — must not appear as a route', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths.some((p) => p.includes('_app'))).toBe(false);
  });

  it('strips _document.tsx — must not appear as a route', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');
    const caps = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const paths = routePaths(caps);
    expect(paths.some((p) => p.includes('_document'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Next.js App Router
// ---------------------------------------------------------------------------

describe('Next.js App Router — file-system route discovery', () => {
  it('finds the root app/page.tsx as /', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);
    expect(paths).toContain('/');
  });

  it('finds /about from app/about/page.tsx', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);
    expect(paths).toContain('/about');
  });

  it('strips route group (marketing) → /blog not /(marketing)/blog', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);

    expect(paths).toContain('/blog');
    expect(paths.some((p) => p.includes('(marketing)'))).toBe(false);
  });

  it('strips route group and converts dynamic segment → /blog/:slug', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);
    expect(paths).toContain('/blog/:slug');
  });

  it('strips nested route group (overview) → /dashboard', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);

    expect(paths).toContain('/dashboard');
    expect(paths.some((p) => p.includes('(overview)'))).toBe(false);
  });

  it('converts [id]/page.tsx to /users/:id', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);
    expect(paths).toContain('/users/:id');
  });

  it('does not include layout.tsx as a route', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-app-app');
    const caps = await discoverNextjsAppRoutes(files, cache, rootDir, 'nextjs-app');
    const paths = routePaths(caps);
    expect(paths.some((p) => p.includes('layout'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ID determinism
// ---------------------------------------------------------------------------

describe('Route capability ID determinism', () => {
  it('running discovery twice produces byte-identical route ids', async () => {
    const { rootDir, files, cache } = await loadFixture('nextjs-pages-app');

    const run1 = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');
    const run2 = await discoverNextjsPagesRoutes(files, cache, rootDir, 'nextjs-pages');

    const ids1 = run1.map((c) => c.id).sort();
    const ids2 = run2.map((c) => c.id).sort();
    expect(ids1).toEqual(ids2);
  });

  it('all route ids are unique within a single run', async () => {
    const { rootDir, files, cache } = await loadFixture('react-router-app');
    const caps = await discoverReactRouterRoutes(files, cache, rootDir, 'react-router');
    const ids = caps.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// ≥95% DETECTION GATE (gating test — must not be deleted or softened)
// ---------------------------------------------------------------------------

describe('Detection rate gate — ≥95% of known routes must be found', () => {
  /**
   * Known routes catalogue.
   * These are the ground-truth routes we expect to find across all fixtures.
   *
   * React Router JSX (App.tsx):
   *   "/", "/about", "/login", "/settings/*", "/users", ":id", "settings", "/404"
   *   Note: nested paths use the literal path attr value as recorded by the detector
   *
   * React Router data-API (router.tsx):
   *   "/blog", ":slug", "comments", "/products/:category/:id", "/dashboard", "analytics"
   *
   * Next.js Pages:
   *   "/", "/about", "/blog", "/blog/:slug", "/users/:id/profile", "/docs/:slug*"
   *
   * Next.js App:
   *   "/", "/about", "/blog", "/blog/:slug", "/dashboard", "/users/:id"
   */
  const KNOWN_REACT_ROUTER_PATHS = new Set([
    '/', '/about', '/login', '/settings/*', '/users', ':id', 'settings', '/404',  // JSX
    '/blog', ':slug', 'comments', '/products/:category/:id', '/dashboard', 'analytics',  // data-API
  ]);
  const TOTAL_RR = KNOWN_REACT_ROUTER_PATHS.size; // 14

  const KNOWN_PAGES_PATHS = new Set([
    '/', '/about', '/blog', '/blog/:slug', '/users/:id/profile', '/docs/:slug*',
  ]);
  const TOTAL_PAGES = KNOWN_PAGES_PATHS.size; // 6

  const KNOWN_APP_PATHS = new Set([
    '/', '/about', '/blog', '/blog/:slug', '/dashboard', '/users/:id',
  ]);
  const TOTAL_APP = KNOWN_APP_PATHS.size; // 6

  const GRAND_TOTAL = TOTAL_RR + TOTAL_PAGES + TOTAL_APP; // 26
  const REQUIRED = Math.ceil(GRAND_TOTAL * 0.95); // 25

  it(`finds ≥${REQUIRED}/${GRAND_TOTAL} known routes (≥95% detection gate)`, async () => {
    const [rrFixture, pagesFixture, appFixture] = await Promise.all([
      loadFixture('react-router-app'),
      loadFixture('nextjs-pages-app'),
      loadFixture('nextjs-app-app'),
    ]);

    const [rrCaps, pagesCaps, appCaps] = await Promise.all([
      discoverReactRouterRoutes(rrFixture.files, rrFixture.cache, rrFixture.rootDir, 'react-router'),
      discoverNextjsPagesRoutes(pagesFixture.files, pagesFixture.cache, pagesFixture.rootDir, 'nextjs-pages'),
      discoverNextjsAppRoutes(appFixture.files, appFixture.cache, appFixture.rootDir, 'nextjs-app'),
    ]);

    const foundRR = new Set(rrCaps.map((c) => (c.metadata as { path: string }).path));
    const foundPages = new Set(pagesCaps.map((c) => (c.metadata as { path: string }).path));
    const foundApp = new Set(appCaps.map((c) => (c.metadata as { path: string }).path));

    const rrHits = [...KNOWN_REACT_ROUTER_PATHS].filter((p) => foundRR.has(p)).length;
    const pagesHits = [...KNOWN_PAGES_PATHS].filter((p) => foundPages.has(p)).length;
    const appHits = [...KNOWN_APP_PATHS].filter((p) => foundApp.has(p)).length;
    const totalFound = rrHits + pagesHits + appHits;

    const detectionPct = ((totalFound / GRAND_TOTAL) * 100).toFixed(1);

    // Report
    console.info(`[A1 Detection Report]`);
    console.info(`  React Router: ${rrHits}/${TOTAL_RR}  (found: ${[...foundRR].join(', ')})`);
    console.info(`  Pages Router: ${pagesHits}/${TOTAL_PAGES}  (found: ${[...foundPages].join(', ')})`);
    console.info(`  App Router:   ${appHits}/${TOTAL_APP}  (found: ${[...foundApp].join(', ')})`);
    console.info(`  TOTAL: ${totalFound}/${GRAND_TOTAL} = ${detectionPct}% (gate: ≥${REQUIRED})`);

    expect(totalFound).toBeGreaterThanOrEqual(REQUIRED);
  });

  it('produces ZERO false positives from FakeRoute.tsx', async () => {
    const rootDir = resolve(FIXTURES, 'react-router-app');
    const fakeFile = resolve(rootDir, 'src', 'FakeRoute.tsx');
    const cache = createAstCache();
    await parseFile(fakeFile, cache);

    const caps = await discoverReactRouterRoutes([fakeFile], cache, rootDir, 'react-router');
    expect(caps).toHaveLength(0);
  });
});
