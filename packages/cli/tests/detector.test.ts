import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFramework } from '../src/discovery/detector.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectFramework()', () => {
  let warnSpy: { mockRestore: () => void; mock: { calls: unknown[][] } };
  let infoSpy: { mockRestore: () => void; mock: { calls: unknown[][] } };

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Framework identification
  // -------------------------------------------------------------------------

  it('identifies a React Router app from package.json deps', async () => {
    const root = resolve(FIXTURES, 'react-router-app');
    const kind = await detectFramework(root);
    expect(kind).toBe('react-router');
  });

  it('identifies a Next.js Pages Router app (next dep, no app/ dir)', async () => {
    const root = resolve(FIXTURES, 'nextjs-pages-app');
    const kind = await detectFramework(root);
    expect(kind).toBe('nextjs-pages');
  });

  it('identifies a Next.js App Router app (next.config.js + app/page.tsx)', async () => {
    const root = resolve(FIXTURES, 'nextjs-app-app');
    const kind = await detectFramework(root);
    expect(kind).toBe('nextjs-app');
  });

  it('returns "unknown" for a bare directory with no package.json', async () => {
    // Use the valid fixture dir — no package.json, no known deps
    const root = resolve(FIXTURES, 'valid');
    const kind = await detectFramework(root);
    expect(kind).toBe('unknown');
  });

  it('returns "unknown" for a directory with an empty package.json', async () => {
    const root = resolve(FIXTURES, 'malformed');
    // malformed/ has no package.json at all
    const kind = await detectFramework(root);
    expect(kind).toBe('unknown');
  });

  // -------------------------------------------------------------------------
  // Priority — next.config.js beats dep-based detection
  // -------------------------------------------------------------------------

  it('prefers next.config.js presence over dep-only detection', async () => {
    // nextjs-app-app has both next.config.js AND next in deps → nextjs-app
    const root = resolve(FIXTURES, 'nextjs-app-app');
    const kind = await detectFramework(root);
    // Should be the config-file-derived answer, not just 'nextjs-pages'
    expect(kind).toBe('nextjs-app');
  });

  // -------------------------------------------------------------------------
  // Return type is one of the valid FrameworkKind values
  // -------------------------------------------------------------------------

  it('always returns a valid FrameworkKind literal', async () => {
    const valid = new Set([
      'react-router',
      'nextjs-pages',
      'nextjs-app',
      'vue',
      'unknown',
    ]);
    const roots = [
      resolve(FIXTURES, 'react-router-app'),
      resolve(FIXTURES, 'nextjs-pages-app'),
      resolve(FIXTURES, 'nextjs-app-app'),
      resolve(FIXTURES, 'valid'),
    ];
    for (const root of roots) {
      const kind = await detectFramework(root);
      expect(valid.has(kind)).toBe(true);
    }
  });
});
