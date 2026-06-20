import type { Node, File, ImportDeclaration, ExportNamedDeclaration, ExportDefaultDeclaration, Expression, Identifier } from '@babel/types';
import traverse from '@babel/traverse';
import { relative, normalize, join, dirname, extname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import fastGlob from 'fast-glob';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';
import { registerAgnosticPass } from '../orchestrator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiEndpointMetadata {
  method: string;
  path: string;
  pathParams: string[];
  sourceType: 'express' | 'fastify' | 'openapi_spec';
  requestSchema?: unknown;
}

interface LocalVariable {
  kind: 'local' | 'import';
  sourcePath?: string;
  exportName?: string;
}

interface LocalEndpoint {
  method: string;
  path: string;
  routerVar: string;
  loc: string;
  sourceType: 'express' | 'fastify';
}

interface LocalMount {
  prefix: string;
  parentVar: string;
  childVar: string;
}

interface FileState {
  absPath: string;
  variables: Map<string, LocalVariable>;
  exports: Map<string, string>; // exportName -> localVarName
  endpoints: LocalEndpoint[];
  mounts: LocalMount[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationOf(node: Node): string {
  const loc = node.loc;
  if (!loc) return '1:1';
  return `${loc.start.line}:${loc.start.column}`;
}

function cleanPath(p: string): string {
  let cleaned = p.replace(/\/+/g, '/');
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

function extractPathParams(p: string): string[] {
  const params: string[] = [];
  for (const segment of p.split('/')) {
    if (segment.startsWith(':')) {
      params.push(segment.slice(1).replace(/[\?\*]+$/, ''));
    } else if (segment.startsWith('{') && segment.endsWith('}')) {
      // OpenAPI style {id}
      params.push(segment.slice(1, -1));
    }
  }
  return params;
}

function resolveImportPath(currentAbsPath: string, importSource: string): string {
  if (!importSource.startsWith('.')) return importSource; // Not relative, e.g. 'express'
  
  const baseDir = dirname(currentAbsPath);
  let resolved = join(baseDir, importSource);
  
  // Basic extension resolution
  if (existsSync(resolved) && !existsSync(resolved + '.ts') && !existsSync(resolved + '.js')) {
    // It's a file with an extension already, or a directory
    // Note: this is a simplistic check. We can just append extensions to check.
  }
  
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
    if (existsSync(resolved + ext)) return normalize(resolved + ext).replace(/\\/g, '/');
  }
  
  return normalize(resolved).replace(/\\/g, '/');
}

function getStringValue(node: Expression | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  // Template literal without expressions
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length > 0) {
    return (node.quasis[0]?.value?.cooked as string | undefined) ?? null;
  }
  return null;
}

function getObjectPropertyValue(properties: any[], keyName: string): any | null {
  for (const prop of properties) {
    if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.key.name === keyName) {
      return prop.value;
    }
  }
  return null;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);

// ---------------------------------------------------------------------------
// Phase 1: Local AST Traversal
// ---------------------------------------------------------------------------

function analyzeFile(absPath: string, ast: File): FileState {
  const state: FileState = {
    absPath,
    variables: new Map(),
    exports: new Map(),
    endpoints: [],
    mounts: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverseFn = ((traverse as any).default ?? traverse) as typeof traverse;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (traverseFn as any)(ast, {
    ImportDeclaration(path: any) {
      const node = path.node as ImportDeclaration;
      const sourcePath = resolveImportPath(absPath, node.source.value);
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') {
          state.variables.set(spec.local.name, { kind: 'import', sourcePath, exportName: 'default' });
        } else if (spec.type === 'ImportSpecifier') {
          const importedName = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
          state.variables.set(spec.local.name, { kind: 'import', sourcePath, exportName: importedName });
        }
      }
    },

    ExportDefaultDeclaration(path: any) {
      const decl = path.node.declaration;
      if (decl.type === 'Identifier') {
        state.exports.set('default', decl.name);
      }
    },

    ExportNamedDeclaration(path: any) {
      const node = path.node as ExportNamedDeclaration;
      if (node.declaration && node.declaration.type === 'VariableDeclaration') {
        for (const d of node.declaration.declarations) {
          if (d.id.type === 'Identifier') {
            state.exports.set(d.id.name, d.id.name);
          }
        }
      } else if (node.specifiers) {
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            const localName = spec.local.name;
            const exportedName = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value;
            state.exports.set(exportedName, localName);
          }
        }
      }
    },

    AssignmentExpression(path: any) {
      const node = path.node;
      // module.exports = router
      if (
        node.left.type === 'MemberExpression' &&
        node.left.object.type === 'Identifier' && node.left.object.name === 'module' &&
        node.left.property.type === 'Identifier' && node.left.property.name === 'exports' &&
        node.right.type === 'Identifier'
      ) {
        state.exports.set('default', node.right.name);
      }
    },

    VariableDeclarator(path: any) {
      const node = path.node;
      if (node.id.type === 'Identifier' && node.init) {
        if (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') {
          if (node.init.params.length > 0 && node.init.params[0].type === 'Identifier') {
            const paramName = node.init.params[0].name;
            // Alias the parameter to the function's variable name (for Fastify plugins)
            state.exports.set(paramName, node.id.name); 
            // Wait, state.exports is for cross-file. For local aliasing, we can use a new map or variables.
            // Let's just set variables to 'local' kind with exportName = node.id.name
            // Actually, we can just say "paramName is imported from this file's node.id.name"
            state.variables.set(paramName, { kind: 'import', sourcePath: absPath, exportName: node.id.name });
            state.exports.set(node.id.name, node.id.name);
          }
        }
      }
    },

    CallExpression(path: any) {
      const node = path.node;
      const callee = node.callee;

      // Ensure callee is object.property
      if (callee.type !== 'MemberExpression') return;
      if (callee.object.type !== 'Identifier') return;
      if (callee.property.type !== 'Identifier') return;

      const routerVar = callee.object.name;
      const method = callee.property.name.toLowerCase();

      // 1. Direct Endpoints: app.get('/path', handler)
      if (HTTP_METHODS.has(method)) {
        if (node.arguments.length > 0) {
          const routePath = getStringValue(node.arguments[0] as Expression);
          if (routePath !== null) {
            state.endpoints.push({
              method: method.toUpperCase(),
              path: routePath,
              routerVar,
              loc: locationOf(node),
              sourceType: 'express', // Agnostic default, could be fastify
            });
          }
        }
      }

      // 2. Fastify Object Style: fastify.route({ method: 'GET', url: '/path' })
      if (method === 'route' && node.arguments.length === 1 && node.arguments[0].type === 'ObjectExpression') {
        const props = node.arguments[0].properties;
        const methodVal = getStringValue(getObjectPropertyValue(props, 'method'));
        const urlVal = getStringValue(getObjectPropertyValue(props, 'url'));
        if (methodVal && urlVal) {
          state.endpoints.push({
            method: methodVal.toUpperCase(),
            path: urlVal,
            routerVar,
            loc: locationOf(node),
            sourceType: 'fastify',
          });
        }
      }

      // 3. Express Mount: app.use('/prefix', router)
      if (method === 'use' && node.arguments.length >= 2) {
        const prefix = getStringValue(node.arguments[0] as Expression);
        // Find the router identifier in arguments (often the second, but could be array or anything)
        let childVar: string | null = null;
        for (let i = 1; i < node.arguments.length; i++) {
          if (node.arguments[i].type === 'Identifier') {
            childVar = (node.arguments[i] as Identifier).name;
            break;
          }
        }
        if (prefix !== null && childVar !== null) {
          state.mounts.push({
            prefix,
            parentVar: routerVar,
            childVar,
          });
        }
      }

      // 4. Fastify Mount: fastify.register(router, { prefix: '/prefix' })
      if (method === 'register' && node.arguments.length >= 2) {
        const childVar = node.arguments[0].type === 'Identifier' ? (node.arguments[0] as Identifier).name : null;
        if (childVar && node.arguments[1].type === 'ObjectExpression') {
          const prefix = getStringValue(getObjectPropertyValue(node.arguments[1].properties, 'prefix'));
          if (prefix !== null) {
            state.mounts.push({
              prefix,
              parentVar: routerVar,
              childVar,
            });
          }
        }
      }
    }
  });

  return state;
}

// ---------------------------------------------------------------------------
// Phase 2: Global Graph Resolution
// ---------------------------------------------------------------------------

class GraphResolver {
  fileStates = new Map<string, FileState>();

  constructor(states: FileState[]) {
    for (const s of states) {
      this.fileStates.set(s.absPath, s);
    }
  }

  resolveRouterId(absPath: string, localName: string, visited = new Set<string>()): string {
    const state = this.fileStates.get(absPath);
    if (!state) return `${absPath}#${localName}`;

    const localId = `${absPath}#${localName}`;
    if (visited.has(localId)) return localId; // Prevent cycles
    visited.add(localId);

    const v = state.variables.get(localName);
    if (v && v.kind === 'import' && v.sourcePath && v.exportName) {
      const targetState = this.fileStates.get(v.sourcePath);
      if (targetState) {
        const targetLocal = targetState.exports.get(v.exportName);
        if (targetLocal) {
          return this.resolveRouterId(v.sourcePath, targetLocal, visited);
        }
      }
      return `${v.sourcePath}#${v.exportName}`;
    }

    return localId;
  }
}

// ---------------------------------------------------------------------------
// Pass: Source code AST
// ---------------------------------------------------------------------------

async function discoverAstEndpoints(files: string[], cache: AstCache, rootDir: string): Promise<Capability[]> {
  // Phase 1
  const states: FileState[] = [];
  for (const absPath of files) {
    const ast = cache.get(absPath);
    if (ast) states.push(analyzeFile(absPath, ast));
  }

  // Phase 2
  const resolver = new GraphResolver(states);
  
  interface GlobalMount { parentId: string; childId: string; prefix: string; }
  const globalMounts: GlobalMount[] = [];
  
  for (const state of states) {
    for (const m of state.mounts) {
      globalMounts.push({
        parentId: resolver.resolveRouterId(state.absPath, m.parentVar),
        childId: resolver.resolveRouterId(state.absPath, m.childVar),
        prefix: m.prefix
      });
    }
  }

  function getRouterPaths(routerId: string, visited = new Set<string>()): string[] {
    if (visited.has(routerId)) return [];
    visited.add(routerId);
    
    const mountsAsChild = globalMounts.filter(m => m.childId === routerId);
    if (mountsAsChild.length === 0) {
      visited.delete(routerId);
      return [''];
    }
    
    const result: string[] = [];
    for (const m of mountsAsChild) {
      const parentPaths = getRouterPaths(m.parentId, visited);
      for (const p of parentPaths) {
        result.push(cleanPath(p + m.prefix));
      }
    }
    visited.delete(routerId);
    return result.length > 0 ? result : [''];
  }

  const capabilities: Capability[] = [];

  for (const state of states) {
    const relPath = normalize(relative(rootDir, state.absPath)).replace(/\\/g, '/');
    for (const ep of state.endpoints) {
      const routerId = resolver.resolveRouterId(state.absPath, ep.routerVar);
      const prefixes = getRouterPaths(routerId);
      
      for (const prefix of prefixes) {
        const fullPath = cleanPath(prefix + ep.path);
        const meta: ApiEndpointMetadata = {
          method: ep.method,
          path: fullPath,
          pathParams: extractPathParams(fullPath),
          sourceType: ep.sourceType,
        };

        // Create a unique deterministic ID
        // Note: multiple prefixes mean multiple capabilities for the same endpoint location
        capabilities.push({
          id: generateCapabilityId(relPath, `${ep.loc}-${meta.method}-${meta.path}`, 'api_endpoint'),
          type: 'api_endpoint',
          sourceFile: relPath,
          sourceLocation: ep.loc,
          metadata: meta as unknown as Record<string, unknown>,
        });
      }
    }
  }

  return capabilities;
}

// ---------------------------------------------------------------------------
// Pass: OpenAPI parsing
// ---------------------------------------------------------------------------

async function discoverOpenApiEndpoints(rootDir: string): Promise<Capability[]> {
  const capabilities: Capability[] = [];
  
  // Find openapi/swagger JSON files
  const specFiles = await fastGlob(['**/swagger.json', '**/openapi.json'], {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**']
  });

  for (const absPath of specFiles) {
    try {
      const content = readFileSync(absPath, 'utf8');
      const spec = JSON.parse(content);
      if (!spec || !spec.paths) continue;

      const relPath = normalize(relative(rootDir, absPath)).replace(/\\/g, '/');

      for (const [pathStr, methods] of Object.entries(spec.paths)) {
        if (!methods || typeof methods !== 'object') continue;
        
        for (const [method, op] of Object.entries(methods as any)) {
          if (!HTTP_METHODS.has(method.toLowerCase())) continue;

          let requestSchema: unknown = undefined;
          const opAny = op as any;
          if (opAny && opAny.requestBody && opAny.requestBody.content && opAny.requestBody.content['application/json']) {
            requestSchema = opAny.requestBody.content['application/json'].schema;
          }

          const meta: ApiEndpointMetadata = {
            method: method.toUpperCase(),
            path: pathStr,
            pathParams: extractPathParams(pathStr),
            sourceType: 'openapi_spec',
            ...(requestSchema ? { requestSchema } : {})
          };

          capabilities.push({
            id: generateCapabilityId(relPath, `1:1-${meta.method}-${meta.path}`, 'api_endpoint'),
            type: 'api_endpoint',
            sourceFile: relPath,
            sourceLocation: '1:1',
            metadata: meta as unknown as Record<string, unknown>,
          });
        }
      }
    } catch (e) {
      console.warn(`[VoiceNav/API] Failed to parse OpenAPI spec: ${absPath}`);
    }
  }

  return capabilities;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function discoverApiEndpoints(
  files: string[],
  cache: AstCache,
  rootDir: string,
  _framework: FrameworkKind,
): Promise<Capability[]> {
  const astResults = await discoverAstEndpoints(files, cache, rootDir);
  const openapiResults = await discoverOpenApiEndpoints(rootDir);
  return [...astResults, ...openapiResults];
}

registerAgnosticPass(discoverApiEndpoints);
