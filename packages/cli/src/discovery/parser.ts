import { parse, type ParserPlugin } from '@babel/parser';
import type { File } from '@babel/types';
import { readFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Babel plugin configuration
// ---------------------------------------------------------------------------

/**
 * The superset of Babel plugins that lets us parse any JS/JSX/TS/TSX file
 * found in a typical React / Next.js / Vue-with-TS project, including
 * NestJS-style controller files that use class decorators.
 *
 * Ordering matters: `typescript` must come before `jsx` (Babel requirement).
 */
const BABEL_PLUGINS: ParserPlugin[] = [
  'typescript',
  'jsx',
  'decorators-legacy',   // NestJS / Angular-style @Controller() etc.
  'classProperties',
  'classStaticBlock',
  'dynamicImport',
  'importMeta',
  'importAssertions',
  'optionalChaining',
  'nullishCoalescingOperator',
  'logicalAssignment',
  'numericSeparator',
  'objectRestSpread',
  'exportDefaultFrom',
  'exportNamespaceFrom',
];

// ---------------------------------------------------------------------------
// In-memory AST cache (scoped to one discovery run)
// ---------------------------------------------------------------------------

/**
 * A simple Map used as the in-memory AST cache.
 * Key: absolute file path.  Value: parsed Babel `File` node.
 *
 * Consumers (orchestrator, A1–A4 passes) receive the same Map instance so
 * they share a single warm cache for the duration of one scan run.
 */
export type AstCache = Map<string, File>;

/** Create a fresh empty cache for a new discovery run. */
export function createAstCache(): AstCache {
  return new Map<string, File>();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a source file and return its Babel `File` AST node.
 *
 * - Results are stored in `cache`; subsequent calls with the same path return
 *   the cached object immediately without touching the filesystem.
 * - If parsing fails for any reason the function logs a warning and returns
 *   `null`.  It **never throws** — one broken file must not abort a whole
 *   discovery run.
 *
 * @param filePath - Absolute path to the source file.
 * @param cache    - Shared in-memory cache for this scan run.
 * @returns The Babel `File` AST, or `null` if the file could not be parsed.
 */
export async function parseFile(
  filePath: string,
  cache: AstCache,
): Promise<File | null> {
  // Cache hit — return without any I/O or re-parsing
  const cached = cache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }

  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (err) {
    console.warn(
      `[VoiceNav/parser] Could not read file "${filePath}":`,
      (err as Error).message,
    );
    return null;
  }

  // @babel/parser's parse() returns a File node directly (ParseResult<File> = File).
  // The try/catch handles thrown SyntaxErrors from badly malformed input.
  let ast: File;
  try {
    ast = parse(source, {
      sourceType: 'unambiguous',
      strictMode: false,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      plugins: BABEL_PLUGINS,
    }) as File;
  } catch (err) {
    console.warn(
      `[VoiceNav/parser] Failed to parse "${filePath}":`,
      (err as Error).message,
    );
    return null;
  }

  cache.set(filePath, ast);
  return ast;
}
