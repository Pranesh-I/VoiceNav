import { describe, it, expect } from 'vitest';
import { generateCapabilityId } from '../src/discovery/types.js';
import type { CapabilityType } from '../src/discovery/types.js';

// ---------------------------------------------------------------------------
// ID determinism tests
//
// These guard two invariants that will silently break everything downstream
// if violated:
//   1. Same inputs → same id (pure function, no randomness).
//   2. Different inputs → different id (no collisions on distinct capabilities).
// ---------------------------------------------------------------------------

describe('generateCapabilityId() — determinism', () => {
  const CASES: Array<{
    label: string;
    sourceFile: string;
    sourceLocation: string;
    type: CapabilityType;
  }> = [
    {
      label: 'route',
      sourceFile: 'src/App.tsx',
      sourceLocation: '12:4',
      type: 'route',
    },
    {
      label: 'handler',
      sourceFile: 'src/api/users.ts',
      sourceLocation: '34:2-48:3',
      type: 'handler',
    },
    {
      label: 'api_endpoint',
      sourceFile: 'pages/api/posts.ts',
      sourceLocation: '1:1',
      type: 'api_endpoint',
    },
    {
      label: 'ui_action',
      sourceFile: 'components/Button.tsx',
      sourceLocation: '22:10',
      type: 'ui_action',
    },
  ];

  // -------------------------------------------------------------------------
  // 1. Same inputs → same id (idempotent)
  // -------------------------------------------------------------------------

  for (const c of CASES) {
    it(`[${c.label}] produces the same id on repeated calls`, () => {
      const id1 = generateCapabilityId(c.sourceFile, c.sourceLocation, c.type);
      const id2 = generateCapabilityId(c.sourceFile, c.sourceLocation, c.type);
      const id3 = generateCapabilityId(c.sourceFile, c.sourceLocation, c.type);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });
  }

  // -------------------------------------------------------------------------
  // 2. All combinations produce distinct ids (no collisions)
  // -------------------------------------------------------------------------

  it('all test-case inputs produce distinct ids', () => {
    const ids = CASES.map((c) =>
      generateCapabilityId(c.sourceFile, c.sourceLocation, c.type),
    );
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // -------------------------------------------------------------------------
  // 3. Changing any single component changes the id
  // -------------------------------------------------------------------------

  it('changing sourceFile changes the id', () => {
    const base = { sourceFile: 'src/a.ts', sourceLocation: '1:1', type: 'route' as CapabilityType };
    const id1 = generateCapabilityId(base.sourceFile, base.sourceLocation, base.type);
    const id2 = generateCapabilityId('src/b.ts', base.sourceLocation, base.type);
    expect(id1).not.toBe(id2);
  });

  it('changing sourceLocation changes the id', () => {
    const base = { sourceFile: 'src/a.ts', sourceLocation: '1:1', type: 'route' as CapabilityType };
    const id1 = generateCapabilityId(base.sourceFile, base.sourceLocation, base.type);
    const id2 = generateCapabilityId(base.sourceFile, '2:5', base.type);
    expect(id1).not.toBe(id2);
  });

  it('changing type changes the id', () => {
    const base = { sourceFile: 'src/a.ts', sourceLocation: '1:1', type: 'route' as CapabilityType };
    const id1 = generateCapabilityId(base.sourceFile, base.sourceLocation, base.type);
    const id2 = generateCapabilityId(base.sourceFile, base.sourceLocation, 'handler');
    expect(id1).not.toBe(id2);
  });

  // -------------------------------------------------------------------------
  // 4. Output format assertions
  // -------------------------------------------------------------------------

  it('produces a 16-character lowercase hex string', () => {
    const id = generateCapabilityId('src/x.ts', '10:0', 'route');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not change output on subsequent process runs (golden value)', () => {
    // Golden-test: this value was computed by running the function once.
    // If the hash algorithm or input serialization changes, this test will
    // catch the regression before it silently breaks capability ids in the wild.
    const id = generateCapabilityId('src/App.tsx', '12:4', 'route');
    // Snapshot the expected value.  To regenerate: delete the expected value,
    // run the test, note the actual value, paste it back.
    expect(id).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // 5. Separator prevents accidental prefix collisions
  // -------------------------------------------------------------------------

  it('avoids collision when sourceFile ends with part of sourceLocation', () => {
    // Without a separator, "src/a" + "1:1" + "route" and "src/a1" + ":1" + "route"
    // would hash the same string.  The pipe separator prevents this.
    const id1 = generateCapabilityId('src/a', '1:1', 'route');
    const id2 = generateCapabilityId('src/a1', ':1', 'route');
    expect(id1).not.toBe(id2);
  });
});
