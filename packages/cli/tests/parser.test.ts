import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile, createAstCache } from '../src/discovery/parser.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseFile()', () => {
  // Capture console.warn calls
  // vi.spyOn type is inferred from assignment to avoid strict MockInstance issues
  let warnSpy: { mockRestore: () => void; mock: { calls: unknown[][] } };

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Happy path — valid source files
  // -------------------------------------------------------------------------

  it('parses a valid .tsx file and returns a Babel File AST', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'valid', 'simple.tsx');
    const ast = await parseFile(filePath, cache);

    expect(ast).not.toBeNull();
    // A Babel File node always has type === 'File'
    expect((ast as { type: string }).type).toBe('File');
  });

  it('parses a valid .tsx file from a React Router fixture', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'react-router-app', 'src', 'App.tsx');
    const ast = await parseFile(filePath, cache);

    expect(ast).not.toBeNull();
    expect((ast as { type: string }).type).toBe('File');
    // No warnings should have been emitted
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses a valid App Router page.tsx', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'nextjs-app-app', 'app', 'page.tsx');
    const ast = await parseFile(filePath, cache);

    expect(ast).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Error-handling — malformed file
  // -------------------------------------------------------------------------

  it('returns null for a deliberately malformed file WITHOUT throwing', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'malformed', 'broken.ts');

    // Must not throw
    const result = await expect(parseFile(filePath, cache)).resolves;
    const ast = await parseFile(filePath, cache);

    expect(ast).toBeNull();
  });

  it('emits a console.warn (not console.error) for a malformed file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'malformed', 'broken.ts');

    await parseFile(filePath, cache);

    // warn should be called; error must NOT be called
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // Warn message should include the file path
    const warnArg = warnSpy.mock.calls[0]?.[0] as string;
    expect(warnArg).toContain('broken.ts');

    errorSpy.mockRestore();
  });

  it('returns null for a non-existent file WITHOUT throwing', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'does-not-exist.ts');

    const ast = await parseFile(filePath, cache);
    expect(ast).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // In-memory cache
  // -------------------------------------------------------------------------

  it('returns the same object reference on a second call (cache hit)', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'valid', 'simple.tsx');

    const first = await parseFile(filePath, cache);
    const second = await parseFile(filePath, cache);

    expect(first).not.toBeNull();
    // Strict reference equality — same object in memory
    expect(first).toBe(second);
  });

  it('stores the result in the provided cache after first parse', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'valid', 'simple.tsx');

    expect(cache.has(filePath)).toBe(false);
    await parseFile(filePath, cache);
    expect(cache.has(filePath)).toBe(true);
  });

  it('does NOT store null results in the cache (malformed file)', async () => {
    const cache = createAstCache();
    const filePath = resolve(FIXTURES, 'malformed', 'broken.ts');

    await parseFile(filePath, cache);
    // Cache should remain empty — we don't cache failures
    expect(cache.has(filePath)).toBe(false);
  });

  it('different files produce distinct cache entries', async () => {
    const cache = createAstCache();
    const file1 = resolve(FIXTURES, 'valid', 'simple.tsx');
    const file2 = resolve(FIXTURES, 'react-router-app', 'src', 'App.tsx');

    const ast1 = await parseFile(file1, cache);
    const ast2 = await parseFile(file2, cache);

    expect(ast1).not.toBe(ast2);
    expect(cache.size).toBe(2);
  });

  it('isolated caches do not share entries', async () => {
    const cacheA = createAstCache();
    const cacheB = createAstCache();
    const filePath = resolve(FIXTURES, 'valid', 'simple.tsx');

    await parseFile(filePath, cacheA);

    expect(cacheA.has(filePath)).toBe(true);
    expect(cacheB.has(filePath)).toBe(false);
  });
});
