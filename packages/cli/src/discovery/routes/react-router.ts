import type { File, Node, JSXAttribute, JSXOpeningElement } from '@babel/types';
import traverse, { type NodePath } from '@babel/traverse';
import { relative, normalize } from 'node:path';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteMetadata {
  path: string;
  dynamicParams: string[];
  isNested: boolean;
  framework: FrameworkKind;
  routerKind: 'jsx' | 'data-api';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract dynamic param names from a route path string.
 *  "/users/:id/posts/:postId" → ["id", "postId"] */
function extractDynamicParams(routePath: string): string[] {
  const params: string[] = [];
  for (const segment of routePath.split('/')) {
    if (segment.startsWith(':')) {
      // Strip trailing "*" from catch-all params like :slug*
      params.push(segment.slice(1).replace(/\*$/, ''));
    } else if (segment === '*') {
      // wildcard — no named param
    }
  }
  return params;
}

/** Format a Babel node's start position as "line:col". */
function locationOf(node: Node): string {
  const loc = node.loc;
  if (!loc) return '1:1';
  return `${loc.start.line}:${loc.start.column}`;
}

/** Resolve the babel string value from a JSX attribute, or null. */
function jsxStringAttr(
  attrs: JSXOpeningElement['attributes'],
  attrName: string,
): string | null {
  for (const attr of attrs) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === attrName
    ) {
      const val = attr.value;
      if (val === null || val === undefined) return '';
      if (val.type === 'StringLiteral') return val.value;
      if (val.type === 'JSXExpressionContainer') {
        const expr = val.expression;
        if (expr.type === 'StringLiteral') return expr.value;
      }
    }
  }
  return null;
}

/** Return the set of package names imported in this file. */
function getImportedPackages(ast: File): Set<string> {
  const pkgs = new Set<string>();
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      pkgs.add(node.source.value);
    }
  }
  return pkgs;
}

/** True when the file imports from react-router or react-router-dom. */
function importsReactRouter(ast: File): boolean {
  const pkgs = getImportedPackages(ast);
  return pkgs.has('react-router') || pkgs.has('react-router-dom');
}


// ---------------------------------------------------------------------------
// Pass 1 — JSX <Route path="..." /> traversal
// ---------------------------------------------------------------------------

function discoverJsxRoutes(
  absPath: string,
  relPath: string,
  ast: File,
  framework: FrameworkKind,
): Capability[] {
  // Guard: skip files that don't import from react-router*
  if (!importsReactRouter(ast)) return [];

  const results: Capability[] = [];

  // We use JSXElement (not JSXOpeningElement) so that enter fires when we
  // first see the element and exit fires AFTER all children have been visited.
  // This gives us a correct ancestor-depth count for isNested detection.
  const routeAncestorDepth = { value: 0 };

  // CommonJS interop for @babel/traverse — the default export is the function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverseFn = ((traverse as any).default ?? traverse) as typeof traverse;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (traverseFn as any)(ast, {
    JSXElement: {
      enter(path: any) {
        const opening = path.node.openingElement;
        // Must be named exactly "Route"
        if (
          opening.name.type !== 'JSXIdentifier' ||
          opening.name.name !== 'Route'
        ) {
          return;
        }

        const pathAttr = jsxStringAttr(opening.attributes, 'path');
        // <Route> without a path prop is an index route — skip
        if (pathAttr === null) return;

        const isNested = routeAncestorDepth.value > 0;
        const dynamicParams = extractDynamicParams(pathAttr);
        const loc = locationOf(opening);

        const meta: RouteMetadata = {
          path: pathAttr,
          dynamicParams,
          isNested,
          framework,
          routerKind: 'jsx',
        };

        results.push({
          id: generateCapabilityId(relPath, loc, 'route'),
          type: 'route',
          sourceFile: relPath,
          sourceLocation: loc,
          metadata: meta as unknown as Record<string, unknown>,
        });

        // Increment AFTER recording — children will see depth > 0 → isNested
        routeAncestorDepth.value++;
      },
      exit(path: any) {
        const opening = path.node.openingElement;
        if (
          opening.name.type === 'JSXIdentifier' &&
          opening.name.name === 'Route' &&
          jsxStringAttr(opening.attributes, 'path') !== null
        ) {
          routeAncestorDepth.value = Math.max(0, routeAncestorDepth.value - 1);
        }
      },
    },
  });

  return results;
}

// ---------------------------------------------------------------------------
// Pass 2 — createBrowserRouter / createHashRouter / createMemoryRouter
// ---------------------------------------------------------------------------

const DATA_API_CREATORS = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'createStaticRouter',
]);

function discoverDataApiRoutes(
  absPath: string,
  relPath: string,
  ast: File,
  framework: FrameworkKind,
): Capability[] {
  const results: Capability[] = [];

  // Find which local names for router creators are imported from react-router*
  const localCreators = new Set<string>();
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    if (!node.source.value.startsWith('react-router')) continue;
    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue;
      const imported =
        spec.imported.type === 'Identifier'
          ? spec.imported.name
          : spec.imported.value;
      if (DATA_API_CREATORS.has(imported)) {
        localCreators.add(spec.local.name);
      }
    }
  }

  // No creator imported → skip the AST traversal entirely (false-positive guard)
  if (localCreators.size === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverseFn2 = ((traverse as any).default ?? traverse);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (traverseFn2 as any)(ast, {
    CallExpression(path: any) {
      const callee = path.node.callee;

      // Match `createBrowserRouter(...)` or `pkg.createBrowserRouter(...)`
      let calleeName: string | null = null;
      if (callee.type === 'Identifier') {
        calleeName = callee.name;
      } else if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier'
      ) {
        calleeName = callee.property.name;
      }

      if (!calleeName || !localCreators.has(calleeName)) return;

      // First argument must be an array expression (route config array)
      const firstArg = path.node.arguments[0];
      if (!firstArg || firstArg.type !== 'ArrayExpression') return;

      // Recursively walk the route config tree
      walkRouteObjects(firstArg.elements, relPath, framework, results, false);
    },
  });

  return results;
}

type BabelNode = Node | null | undefined;

function walkRouteObjects(
  elements: BabelNode[],
  relPath: string,
  framework: FrameworkKind,
  results: Capability[],
  isNested: boolean,
): void {
  for (const el of elements) {
    if (!el || el.type !== 'ObjectExpression') continue;

    let routePath: string | null = null;
    let childrenElements: BabelNode[] = [];

    for (const prop of el.properties) {
      if (prop.type !== 'ObjectProperty') continue;

      const keyName =
        prop.key.type === 'Identifier'
          ? prop.key.name
          : prop.key.type === 'StringLiteral'
            ? prop.key.value
            : null;

      if (keyName === 'path' && prop.value.type === 'StringLiteral') {
        routePath = prop.value.value;
      }
      if (keyName === 'children' && prop.value.type === 'ArrayExpression') {
        childrenElements = prop.value.elements;
      }
    }

    if (routePath !== null) {
      const loc = locationOf(el);
      const meta: RouteMetadata = {
        path: routePath,
        dynamicParams: extractDynamicParams(routePath),
        isNested,
        framework,
        routerKind: 'data-api',
      };

      results.push({
        id: generateCapabilityId(relPath, loc, 'route'),
        type: 'route',
        sourceFile: relPath,
        sourceLocation: loc,
        metadata: meta as unknown as Record<string, unknown>,
      });
    }

    // Recurse into children
    if (childrenElements.length > 0) {
      walkRouteObjects(childrenElements, relPath, framework, results, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function discoverReactRouterRoutes(
  files: string[],
  cache: AstCache,
  rootDir: string,
  framework: FrameworkKind,
): Promise<Capability[]> {
  const results: Capability[] = [];

  for (const absPath of files) {
    const ast = cache.get(absPath);
    if (!ast) continue;

    const relPath = normalize(relative(rootDir, absPath)).replace(/\\/g, '/');

    results.push(...discoverJsxRoutes(absPath, relPath, ast, framework));
    results.push(...discoverDataApiRoutes(absPath, relPath, ast, framework));
  }

  return results;
}
