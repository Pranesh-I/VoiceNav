import type { Node, File, JSXElement, ArrowFunctionExpression, FunctionDeclaration, ClassDeclaration, VariableDeclarator, JSXOpeningElement } from '@babel/types';
import traverse from '@babel/traverse';
import { relative, normalize } from 'node:path';
import { readFileSync } from 'node:fs';
import type { AstCache } from '../parser.js';
import type { Capability, FrameworkKind } from '../types.js';
import { generateCapabilityId } from '../types.js';
import { registerAgnosticPass } from '../orchestrator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabelSource = 'static' | 'dynamic';
type ElementType = 'button' | 'link' | 'menu' | 'menuitem' | 'form' | 'input';

interface UiActionMetadata {
  elementType: ElementType;
  label: string;
  labelSource: LabelSource;
  associatedComponent?: string;
  parentMenu?: string;
  
  href?: string;
  inputType?: string;
  inputId?: string;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationOf(node: Node): string {
  const loc = node.loc;
  if (!loc) return '1:1';
  return `${loc.start.line}:${loc.start.column}`;
}

function getJsxName(openingElement: JSXOpeningElement): string {
  const nameNode = openingElement.name;
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  if (nameNode.type === 'JSXMemberExpression') {
    let current = nameNode;
    const parts = [];
    while (current.type === 'JSXMemberExpression') {
      parts.unshift(current.property.name);
      if (current.object.type === 'JSXIdentifier') {
        parts.unshift(current.object.name);
        break;
      }
      current = current.object as any;
    }
    return parts.join('.');
  }
  return 'Unknown';
}

function extractRawSource(node: Node, fileContent: string): string {
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    return fileContent.slice(node.start, node.end);
  }
  return '';
}

function getAttribute(openingElement: JSXOpeningElement, attrName: string, fileContent: string) {
  for (const attr of openingElement.attributes) {
    if (attr.type === 'JSXAttribute' && attr.name.name === attrName) {
      if (!attr.value) return { value: true, isDynamic: false }; // boolean prop
      if (attr.value.type === 'StringLiteral') {
        return { value: attr.value.value, isDynamic: false };
      }
      if (attr.value.type === 'JSXExpressionContainer') {
        if (attr.value.expression.type === 'StringLiteral') {
           return { value: attr.value.expression.value, isDynamic: false };
        }
        return { value: extractRawSource(attr.value.expression, fileContent), isDynamic: true };
      }
    }
  }
  return undefined;
}

function extractJsxContentLabel(children: any[], fileContent: string) {
  let text = '';
  let isDynamic = false;
  for (const c of children) {
    if (c.type === 'JSXText') {
      // Remove excessive whitespace, collapse
      const val = c.value.replace(/\s+/g, ' ');
      if (val.trim()) text += val;
    } else if (c.type === 'JSXExpressionContainer' && c.expression.type !== 'JSXEmptyExpression') {
      if (c.expression.type === 'StringLiteral') {
        text += c.expression.value;
      } else {
        text += extractRawSource(c.expression, fileContent);
        isDynamic = true;
      }
    }
  }
  text = text.trim();
  if (!text) return null;
  return { label: text, labelSource: (isDynamic ? 'dynamic' : 'static') as LabelSource };
}

// ---------------------------------------------------------------------------
// Main Traversal
// ---------------------------------------------------------------------------

function analyzeUiElements(absPath: string, ast: File, fileContent: string): Capability[] {
  const capabilities: Capability[] = [];
  const relPath = normalize(relative(process.cwd(), absPath)).replace(/\\/g, '/'); // rootDir is implicitly cwd here, wait, better use relative

  // Stacks
  const componentStack: string[] = [];
  const menuStack: string[] = [];
  const labelStack: { label: string, labelSource: LabelSource }[] = [];
  
  // Cross-reference lookup
  const htmlForLabels = new Map<string, { label: string, labelSource: LabelSource }>();

  // Pass 1: Collect `<label htmlFor="id">`
  const traverseFn = ((traverse as any).default ?? traverse) as typeof traverse;
  (traverseFn as any)(ast, {
    JSXElement(path: any) {
      const node = path.node as JSXElement;
      const name = getJsxName(node.openingElement);
      if (name.toLowerCase() === 'label') {
        const htmlFor = getAttribute(node.openingElement, 'htmlFor', fileContent) || getAttribute(node.openingElement, 'for', fileContent);
        if (htmlFor && typeof htmlFor.value === 'string') {
          const content = extractJsxContentLabel(node.children, fileContent);
          if (content) {
            htmlForLabels.set(htmlFor.value, content);
          }
        }
      }
    }
  });

  // Pass 2: Main discovery
  (traverseFn as any)(ast, {
    VariableDeclarator: {
      enter(path: any) {
        const node = path.node as VariableDeclarator;
        if (node.id.type === 'Identifier' && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
          componentStack.push(node.id.name);
        }
      },
      exit(path: any) {
        const node = path.node as VariableDeclarator;
        if (node.id.type === 'Identifier' && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
          componentStack.pop();
        }
      }
    },
    FunctionDeclaration: {
      enter(path: any) {
        const node = path.node as FunctionDeclaration;
        if (node.id) componentStack.push(node.id.name);
      },
      exit(path: any) {
        const node = path.node as FunctionDeclaration;
        if (node.id) componentStack.pop();
      }
    },
    ClassDeclaration: {
      enter(path: any) {
        const node = path.node as ClassDeclaration;
        if (node.id) componentStack.push(node.id.name);
      },
      exit(path: any) {
        const node = path.node as ClassDeclaration;
        if (node.id) componentStack.pop();
      }
    },

    JSXElement: {
      enter(path: any) {
        const node = path.node as JSXElement;
        const name = getJsxName(node.openingElement);
        const nameLower = name.toLowerCase();

        const roleAttr = getAttribute(node.openingElement, 'role', fileContent);
        const typeAttr = getAttribute(node.openingElement, 'type', fileContent);
        const nameAttr = getAttribute(node.openingElement, 'name', fileContent);
        const idAttr = getAttribute(node.openingElement, 'id', fileContent);
        const placeholderAttr = getAttribute(node.openingElement, 'placeholder', fileContent);
        
        const comp = componentStack[componentStack.length - 1];
        const menu = menuStack[menuStack.length - 1];

        // Label tracker
        if (nameLower === 'label') {
          const content = extractJsxContentLabel(node.children, fileContent);
          if (content) labelStack.push(content);
        }

        // 1. Buttons
        if (nameLower === 'button' || name === 'Button' || (roleAttr && roleAttr.value === 'button')) {
          const content = extractJsxContentLabel(node.children, fileContent);
          capabilities.push({
            id: '', // filled later
            type: 'ui_action',
            sourceFile: '',
            sourceLocation: locationOf(node),
            metadata: {
              elementType: 'button',
              label: content ? content.label : name,
              labelSource: content ? content.labelSource : 'static',
              associatedComponent: comp,
              parentMenu: menu,
            } as unknown as Record<string, unknown>
          });
        }

        // 2. Navigation
        else if (nameLower === 'a' || name === 'Link' || name === 'NavLink') {
          const hrefAttr = getAttribute(node.openingElement, 'href', fileContent) || getAttribute(node.openingElement, 'to', fileContent);
          const content = extractJsxContentLabel(node.children, fileContent);
          capabilities.push({
            id: '', 
            type: 'ui_action',
            sourceFile: '',
            sourceLocation: locationOf(node),
            metadata: {
              elementType: 'link',
              label: content ? content.label : (hrefAttr ? String(hrefAttr.value) : name),
              labelSource: content ? content.labelSource : 'static',
              associatedComponent: comp,
              parentMenu: menu,
              href: hrefAttr ? String(hrefAttr.value) : undefined,
            } as unknown as Record<string, unknown>
          });
        }

        // 3. Menus (Container tracking and MenuItem emission)
        else if (name.includes('Menu') || name.includes('Dropdown')) {
          if (name.includes('Item')) {
            const content = extractJsxContentLabel(node.children, fileContent);
            capabilities.push({
              id: '', 
              type: 'ui_action',
              sourceFile: '',
              sourceLocation: locationOf(node),
              metadata: {
                elementType: 'menuitem',
                label: content ? content.label : name,
                labelSource: content ? content.labelSource : 'static',
                associatedComponent: comp,
                parentMenu: menu,
              } as unknown as Record<string, unknown>
            });
          } else {
            // It's a menu container
            // Use the component name or ID as the menu identifier
            const menuId = (idAttr && typeof idAttr.value === 'string') ? idAttr.value : name;
            menuStack.push(menuId);
            
            capabilities.push({
              id: '', 
              type: 'ui_action',
              sourceFile: '',
              sourceLocation: locationOf(node),
              metadata: {
                elementType: 'menu',
                label: menuId,
                labelSource: 'static',
                associatedComponent: comp,
                parentMenu: menu, // parent menu of this menu
              } as unknown as Record<string, unknown>
            });
          }
        }

        // 4. Forms
        else if (nameLower === 'form' || name.endsWith('Form')) {
          let formLabel = name;
          // Look for direct legend or heading
          for (const child of node.children) {
            if (child.type === 'JSXElement') {
              const childName = getJsxName(child.openingElement).toLowerCase();
              if (childName === 'legend' || /^h[1-6]$/.test(childName)) {
                const content = extractJsxContentLabel(child.children, fileContent);
                if (content) {
                  formLabel = content.label;
                  break;
                }
              }
            }
          }
          capabilities.push({
            id: '', 
            type: 'ui_action',
            sourceFile: '',
            sourceLocation: locationOf(node),
            metadata: {
              elementType: 'form',
              label: formLabel,
              labelSource: 'static',
              associatedComponent: comp,
            } as unknown as Record<string, unknown>
          });
        }

        // 5. Inputs
        else if (nameLower === 'input' || nameLower === 'textarea' || nameLower === 'select' || name.endsWith('Input') || name.endsWith('Select')) {
          // Resolve label
          let inputLabel = name;
          let inputLabelSource: LabelSource = 'static';

          if (labelStack.length > 0) {
            const top = labelStack[labelStack.length - 1]!;
            inputLabel = top.label;
            inputLabelSource = top.labelSource;
          } else if (idAttr && typeof idAttr.value === 'string' && htmlForLabels.has(idAttr.value)) {
            const match = htmlForLabels.get(idAttr.value)!;
            inputLabel = match.label;
            inputLabelSource = match.labelSource;
          } else if (nameAttr && typeof nameAttr.value === 'string') {
            inputLabel = nameAttr.value;
          }

          capabilities.push({
            id: '', 
            type: 'ui_action',
            sourceFile: '',
            sourceLocation: locationOf(node),
            metadata: {
              elementType: 'input',
              label: inputLabel,
              labelSource: inputLabelSource,
              associatedComponent: comp,
              parentMenu: menu,
              inputType: typeAttr ? String(typeAttr.value) : undefined,
              inputId: idAttr ? String(idAttr.value) : undefined,
              placeholder: placeholderAttr ? String(placeholderAttr.value) : undefined,
            } as unknown as Record<string, unknown>
          });
        }
      },
      
      exit(path: any) {
        const node = path.node as JSXElement;
        const name = getJsxName(node.openingElement);
        const nameLower = name.toLowerCase();

        if (nameLower === 'label') {
          const content = extractJsxContentLabel(node.children, fileContent);
          if (content) labelStack.pop();
        }

        if (name.includes('Menu') || name.includes('Dropdown')) {
          if (!name.includes('Item')) {
            menuStack.pop();
          }
        }
      }
    }
  });

  return capabilities;
}

export async function discoverUiActions(
  files: string[],
  cache: AstCache,
  rootDir: string,
  _framework: FrameworkKind,
): Promise<Capability[]> {
  const capabilities: Capability[] = [];

  for (const absPath of files) {
    // Only process typical UI files
    if (!absPath.endsWith('.tsx') && !absPath.endsWith('.jsx')) continue;
    
    const ast = cache.get(absPath);
    if (!ast) continue;

    const fileContent = readFileSync(absPath, 'utf8');
    const caps = analyzeUiElements(absPath, ast, fileContent);
    const relPath = normalize(relative(rootDir, absPath)).replace(/\\/g, '/');

    for (const c of caps) {
      c.sourceFile = relPath;
      const typeStr = (c.metadata as any).elementType;
      c.id = generateCapabilityId(relPath, `${c.sourceLocation}-${typeStr}`, 'ui_action');
      capabilities.push(c);
    }
  }

  return capabilities;
}

registerAgnosticPass(discoverUiActions);
