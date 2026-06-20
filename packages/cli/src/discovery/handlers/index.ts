import type { Node, FunctionDeclaration, ArrowFunctionExpression, FunctionExpression, ClassMethod, ClassPrivateMethod, Comment } from '@babel/types';
import traverse, { type NodePath } from '@babel/traverse';
import { relative, normalize, basename } from 'node:path';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';
import { registerAgnosticPass } from '../orchestrator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HandlerTriggerType = 'onClick' | 'onSubmit' | 'service' | 'controller';

interface HandlerMetadata {
  handlerName: string;
  functionSignature: string;
  triggerType: HandlerTriggerType;
  inlineHandler?: boolean;
  docComment?: string;
}

type AnyFunctionNode = FunctionDeclaration | ArrowFunctionExpression | FunctionExpression | ClassMethod | ClassPrivateMethod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Babel node's start position as "line:col". */
function locationOf(node: Node): string {
  const loc = node.loc;
  if (!loc) return '1:1';
  return `${loc.start.line}:${loc.start.column}`;
}

/** Check if a file matches a service convention. */
function isServiceFile(relPath: string): boolean {
  return /\/services\//i.test('/' + relPath) || /Service\.(ts|js|tsx|jsx)$/i.test(basename(relPath));
}

/** Check if a file matches a controller convention. */
function isControllerFile(relPath: string): boolean {
  return /\/controllers\//i.test('/' + relPath) || /Controller\.(ts|js|tsx|jsx)$/i.test(basename(relPath));
}

/** Check if a function name looks like a CRUD operation. */
function isCrudActionName(name: string): boolean {
  return /^(create|update|delete|get|fetch)[A-Z]?/i.test(name);
}

/** Check if a function node has a type predicate return type (x is Type), which means it's a type guard. */
function isTypeGuard(node: AnyFunctionNode): boolean {
  if (node.returnType && node.returnType.type === 'TSTypeAnnotation') {
    return node.returnType.typeAnnotation.type === 'TSTypePredicate';
  }
  return false;
}

/** Extract a best-effort function signature. */
function getFunctionSignature(node: AnyFunctionNode): string {
  const params = node.params.map(p => {
    if (p.type === 'Identifier') {
      let typeStr = '';
      if (p.typeAnnotation && p.typeAnnotation.type === 'TSTypeAnnotation') {
        // Just note that it has a type, we don't need a perfect stringification
        // A simple approach is just keeping parameter names for now, or basic types if easily extracted.
        // For best-effort, we can just say "p.name: type"
        // Since we don't have a full AST stringifier easily available, we'll just use param name.
        typeStr = ': any'; // placeholder
        if (p.typeAnnotation.typeAnnotation.type === 'TSStringKeyword') typeStr = ': string';
        else if (p.typeAnnotation.typeAnnotation.type === 'TSNumberKeyword') typeStr = ': number';
        else if (p.typeAnnotation.typeAnnotation.type === 'TSBooleanKeyword') typeStr = ': boolean';
        else if (p.typeAnnotation.typeAnnotation.type === 'TSTypeReference' && p.typeAnnotation.typeAnnotation.typeName.type === 'Identifier') {
          typeStr = `: ${p.typeAnnotation.typeAnnotation.typeName.name}`;
        }
      }
      return `${p.name}${typeStr}`;
    }
    if (p.type === 'ObjectPattern') return '{...}';
    if (p.type === 'ArrayPattern') return '[...]';
    if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`;
    return 'unknown';
  });
  return `(${params.join(', ')})`;
}

/** Extract JSDoc block from leading comments. */
function extractDocComment(comments: readonly Comment[] | null): string | undefined {
  if (!comments) return undefined;
  for (const comment of comments) {
    if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
      return `/*${comment.value}*/`;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Pass
// ---------------------------------------------------------------------------

export async function discoverHandlers(
  files: string[],
  cache: AstCache,
  rootDir: string,
  _framework: FrameworkKind,
): Promise<Capability[]> {
  const results: Capability[] = [];

  for (const absPath of files) {
    const ast = cache.get(absPath);
    if (!ast) continue;

    const relPath = normalize(relative(rootDir, absPath)).replace(/\\/g, '/');
    const isSvcFile = isServiceFile(relPath);
    const isCtrlFile = isControllerFile(relPath);

    // CommonJS interop for @babel/traverse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traverseFn = ((traverse as any).default ?? traverse) as typeof traverse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (traverseFn as any)(ast, {
      
      // Category 1 & 2: onClick and onSubmit JSX Handlers
      JSXAttribute(path: any) {
        const node = path.node;
        if (node.name.type !== 'JSXIdentifier') return;
        const attrName = node.name.name;
        if (attrName !== 'onClick' && attrName !== 'onSubmit') return;

        const value = node.value;
        if (!value || value.type !== 'JSXExpressionContainer') return;

        const expr = value.expression;
        let handlerName = '<anonymous>';
        let inlineHandler = false;
        let signature = '()';

        let baseExpr = expr;
        while (
          baseExpr.type === 'TSAsExpression' ||
          baseExpr.type === 'TSNonNullExpression' ||
          baseExpr.type === 'TSTypeAssertion'
        ) {
          baseExpr = baseExpr.expression;
        }

        if (baseExpr.type === 'Identifier') {
          handlerName = baseExpr.name;
        } else if (baseExpr.type === 'MemberExpression') {
          if (baseExpr.property.type === 'Identifier') {
            handlerName = baseExpr.property.name;
          } else {
            handlerName = '<dynamic>';
          }
        } else if (baseExpr.type === 'ArrowFunctionExpression' || baseExpr.type === 'FunctionExpression') {
          inlineHandler = true;
          signature = getFunctionSignature(baseExpr);
        } else {
          // If it's something else (like a string, or a call that doesn't return a function immediately visually), skip or record as unknown.
          if (
            baseExpr.type === 'StringLiteral' || 
            baseExpr.type === 'NumericLiteral' || 
            baseExpr.type === 'BooleanLiteral' ||
            baseExpr.type === 'NullLiteral'
          ) {
            return;
          }
          inlineHandler = true;
        }

        const loc = locationOf(node);
        const meta: HandlerMetadata = {
          handlerName,
          functionSignature: signature,
          triggerType: attrName as HandlerTriggerType,
        };
        if (inlineHandler) meta.inlineHandler = true;

        results.push({
          id: generateCapabilityId(relPath, loc, 'handler'),
          type: 'handler',
          sourceFile: relPath,
          sourceLocation: loc,
          metadata: meta as unknown as Record<string, unknown>,
        });
      },

      // Category 3: Service functions (ExportNamedDeclaration / ExportDefaultDeclaration)
      ExportNamedDeclaration(path: any) {
        const declaration = path.node.declaration;
        if (!declaration) return;

        if (declaration.type === 'FunctionDeclaration') {
          const name = declaration.id ? declaration.id.name : '<anonymous>';
          if ((isSvcFile || isCrudActionName(name)) && !isTypeGuard(declaration)) {
            const loc = locationOf(declaration);
            results.push({
              id: generateCapabilityId(relPath, loc, 'handler'),
              type: 'handler',
              sourceFile: relPath,
              sourceLocation: loc,
              metadata: {
                handlerName: name,
                functionSignature: getFunctionSignature(declaration),
                triggerType: 'service',
              } as unknown as Record<string, unknown>,
            });
          }
        } else if (declaration.type === 'VariableDeclaration') {
          for (const decl of declaration.declarations) {
            if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
              const name = decl.id.type === 'Identifier' ? decl.id.name : '<anonymous>';
              if ((isSvcFile || isCrudActionName(name)) && !isTypeGuard(decl.init)) {
                const loc = locationOf(decl);
                results.push({
                  id: generateCapabilityId(relPath, loc, 'handler'),
                  type: 'handler',
                  sourceFile: relPath,
                  sourceLocation: loc,
                  metadata: {
                    handlerName: name,
                    functionSignature: getFunctionSignature(decl.init),
                    triggerType: 'service',
                  } as unknown as Record<string, unknown>,
                });
              }
            }
          }
        }
      },

      ExportDefaultDeclaration(path: any) {
        const declaration = path.node.declaration;
        if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ArrowFunctionExpression' || declaration.type === 'FunctionExpression') {
          let name = '<default>';
          if (declaration.type === 'FunctionDeclaration' && declaration.id) name = declaration.id.name;

          if ((isSvcFile || isCrudActionName(name)) && !isTypeGuard(declaration as AnyFunctionNode)) {
            const loc = locationOf(declaration);
            results.push({
              id: generateCapabilityId(relPath, loc, 'handler'),
              type: 'handler',
              sourceFile: relPath,
              sourceLocation: loc,
              metadata: {
                handlerName: name,
                functionSignature: getFunctionSignature(declaration as AnyFunctionNode),
                triggerType: 'service',
              } as unknown as Record<string, unknown>,
            });
          }
        }
      },

      // Category 4: Controller methods
      ClassMethod(path: any) {
        if (!isCtrlFile) return;
        const node = path.node;
        if (node.key.type !== 'Identifier') return;
        const name = node.key.name;

        // Skip constructor
        if (name === 'constructor') return;

        const docComment = extractDocComment(node.leadingComments);
        const loc = locationOf(node);

        results.push({
          id: generateCapabilityId(relPath, loc, 'handler'),
          type: 'handler',
          sourceFile: relPath,
          sourceLocation: loc,
          metadata: {
            handlerName: name,
            functionSignature: getFunctionSignature(node),
            triggerType: 'controller',
            ...(docComment ? { docComment } : {}),
          } as unknown as Record<string, unknown>,
        });
      },

      ClassProperty(path: any) {
        if (!isCtrlFile) return;
        const node = path.node;
        if (node.key.type !== 'Identifier') return;
        const name = node.key.name;

        if (node.value && (node.value.type === 'ArrowFunctionExpression' || node.value.type === 'FunctionExpression')) {
          const docComment = extractDocComment(node.leadingComments);
          const loc = locationOf(node);

          results.push({
            id: generateCapabilityId(relPath, loc, 'handler'),
            type: 'handler',
            sourceFile: relPath,
            sourceLocation: loc,
            metadata: {
              handlerName: name,
              functionSignature: getFunctionSignature(node.value),
              triggerType: 'controller',
              ...(docComment ? { docComment } : {}),
            } as unknown as Record<string, unknown>,
          });
        }
      }

    });
  }

  return results;
}

// Register as agnostic pass
registerAgnosticPass(discoverHandlers);
