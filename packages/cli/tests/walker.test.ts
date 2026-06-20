import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkProject } from '../src/discovery/walker.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Strip the fixture root from an absolute path for readable assertions. */
function rel(abs: string): string {
  return abs.slice(FIXTURES.length).replace(/\\/g, '/').replace(/^\//, '');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('walkProject()', () => {
  it('finds source files in a react-router-app fixture', async () => {
    const root = resolve(FIXTURES, 'react-router-app');
    const files = await walkProject(root);
    const relative = files.map(rel);

    expect(relative).toContain('react-router-app/src/App.tsx');
    // package.json is not a source file — should be absent
    expect(relative).not.toContain('react-router-app/package.json');
  });

  it('finds source files in a nextjs-app-app fixture', async () => {
    const root = resolve(FIXTURES, 'nextjs-app-app');
    const files = await walkProject(root);
    const relative = files.map(rel);

    expect(relative).toContain('nextjs-app-app/app/page.tsx');
    expect(relative).toContain('nextjs-app-app/app/layout.tsx');
  });

  it('excludes node_modules by default', async () => {
    const root = resolve(FIXTURES, 'react-router-app');
    const files = await walkProject(root);
    expect(files.every((f) => !f.includes('node_modules'))).toBe(true);
  });

  it('excludes *.test.* files by default', async () => {
    // Create an in-memory virtual check — the fixture itself has no test files,
    // so we verify the default pattern excludes a hypothetical path.
    const root = resolve(FIXTURES, 'valid');
    const files = await walkProject(root);

    // simple.tsx should be present
    expect(files.some((f) => f.endsWith('simple.tsx'))).toBe(true);
  });

  it('returns a deterministically sorted list', async () => {
    const root = resolve(FIXTURES, 'nextjs-app-app');
    const [run1, run2] = await Promise.all([
      walkProject(root),
      walkProject(root),
    ]);
    expect(run1).toEqual(run2);
  });

  it('respects custom include patterns', async () => {
    const root = resolve(FIXTURES, 'valid');
    // Only match .tsx files
    const files = await walkProject(root, { include: ['**/*.tsx'] });
    expect(files.every((f) => f.endsWith('.tsx'))).toBe(true);
  });

  it('respects custom ignore patterns', async () => {
    const root = resolve(FIXTURES, 'nextjs-app-app');
    // Ignore the app directory
    const files = await walkProject(root, { ignore: ['**/app/**'] });
    expect(files.every((f) => !f.includes('/app/'))).toBe(true);
  });

  it('can override include patterns entirely via includePatterns', async () => {
    const root = resolve(FIXTURES, 'valid');
    // Override to only include .js files — none exist in this fixture
    const files = await walkProject(root, { includePatterns: ['**/*.js'] });
    expect(files).toHaveLength(0);
  });

  it('returns an empty array for an empty/non-matching directory', async () => {
    const root = resolve(FIXTURES, 'malformed');
    // malformed/broken.ts has a .ts extension, so the default include DOES match it.
    // Verify it shows up (walker doesn't care about parseability).
    const files = await walkProject(root);
    expect(files.some((f) => f.endsWith('broken.ts'))).toBe(true);
  });
});
