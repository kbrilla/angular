/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import ts from 'typescript';

import {findTightestNode} from './utils/ts_utils';

/**
 * Represents an item in the type hierarchy.
 */
export interface TypeHierarchyItem {
  /** The name of this item */
  name: string;
  /** The kind of this item (class, interface, etc.) */
  kind: ts.ScriptElementKind;
  /** More detail for this item, e.g. the module name */
  detail?: string;
  /** The file path containing this item */
  uri: string;
  /** The full range of the symbol definition */
  range: ts.TextSpan;
  /** The range of the symbol name (for highlighting) */
  selectionRange: ts.TextSpan;
  /** Data to help resolve supertypes/subtypes */
  data?: {
    fileName: string;
    position: number;
  };
}

/**
 * Prepare the type hierarchy at the given position.
 * Returns the type hierarchy item(s) at the cursor position, or undefined if not on a class/interface.
 */
export function prepareTypeHierarchy(
  compiler: NgCompiler,
  fileName: string,
  position: number,
): TypeHierarchyItem[] | undefined {
  const program = compiler.getCurrentProgram();
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return undefined;
  }

  const node = findTightestNode(sourceFile, position);
  if (!node) {
    return undefined;
  }

  // Find the class or interface declaration at this position
  const declaration = findClassOrInterfaceDeclaration(node);
  if (!declaration) {
    return undefined;
  }

  return [createTypeHierarchyItem(declaration, sourceFile)];
}

/**
 * Get the supertypes (parent types) of a type hierarchy item.
 */
export function getSupertypes(
  compiler: NgCompiler,
  item: TypeHierarchyItem,
): TypeHierarchyItem[] | undefined {
  if (!item.data) {
    return undefined;
  }

  const program = compiler.getCurrentProgram();
  const typeChecker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(item.data.fileName);
  if (!sourceFile) {
    return undefined;
  }

  const node = findTightestNode(sourceFile, item.data.position);
  if (!node) {
    return undefined;
  }

  const declaration = findClassOrInterfaceDeclaration(node);
  if (!declaration) {
    return undefined;
  }

  const supertypes: TypeHierarchyItem[] = [];

  if (ts.isClassDeclaration(declaration)) {
    // Get the extends clause
    if (declaration.heritageClauses) {
      for (const clause of declaration.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const superItem = getTypeHierarchyItemFromExpression(
              type.expression,
              typeChecker,
              program,
            );
            if (superItem) {
              supertypes.push(superItem);
            }
          }
        }
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const type of clause.types) {
            const superItem = getTypeHierarchyItemFromExpression(
              type.expression,
              typeChecker,
              program,
            );
            if (superItem) {
              supertypes.push(superItem);
            }
          }
        }
      }
    }
  } else if (ts.isInterfaceDeclaration(declaration)) {
    // Get the extends clause for interfaces
    if (declaration.heritageClauses) {
      for (const clause of declaration.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const superItem = getTypeHierarchyItemFromExpression(
              type.expression,
              typeChecker,
              program,
            );
            if (superItem) {
              supertypes.push(superItem);
            }
          }
        }
      }
    }
  }

  return supertypes.length > 0 ? supertypes : undefined;
}

/**
 * Get the subtypes (child types) of a type hierarchy item.
 */
export function getSubtypes(
  compiler: NgCompiler,
  item: TypeHierarchyItem,
): TypeHierarchyItem[] | undefined {
  if (!item.data) {
    return undefined;
  }

  const program = compiler.getCurrentProgram();
  const typeChecker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(item.data.fileName);
  if (!sourceFile) {
    return undefined;
  }

  const node = findTightestNode(sourceFile, item.data.position);
  if (!node) {
    return undefined;
  }

  const declaration = findClassOrInterfaceDeclaration(node);
  if (!declaration || !declaration.name) {
    return undefined;
  }

  const targetSymbol = typeChecker.getSymbolAtLocation(declaration.name);
  if (!targetSymbol) {
    return undefined;
  }

  const subtypes: TypeHierarchyItem[] = [];

  // Search through all source files for classes/interfaces that extend/implement this type
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) {
      continue;
    }

    ts.forEachChild(sf, function visit(child) {
      if (ts.isClassDeclaration(child) || ts.isInterfaceDeclaration(child)) {
        if (child.heritageClauses) {
          for (const clause of child.heritageClauses) {
            for (const type of clause.types) {
              const symbol = typeChecker.getSymbolAtLocation(type.expression);
              if (symbol && symbol === targetSymbol) {
                const subItem = createTypeHierarchyItem(child, sf);
                subtypes.push(subItem);
              }
            }
          }
        }
      }
      ts.forEachChild(child, visit);
    });
  }

  return subtypes.length > 0 ? subtypes : undefined;
}

/**
 * Find the class or interface declaration containing or at the given node.
 */
function findClassOrInterfaceDeclaration(
  node: ts.Node,
): ts.ClassDeclaration | ts.InterfaceDeclaration | undefined {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current) || ts.isInterfaceDeclaration(current)) {
      return current;
    }

    // If on a class/interface name identifier, check parent
    if (ts.isIdentifier(current) && current.parent) {
      if (ts.isClassDeclaration(current.parent) || ts.isInterfaceDeclaration(current.parent)) {
        return current.parent;
      }
    }

    current = current.parent;
  }

  return undefined;
}

/**
 * Create a TypeHierarchyItem from a class or interface declaration.
 */
function createTypeHierarchyItem(
  declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
): TypeHierarchyItem {
  const name = declaration.name?.text ?? '<anonymous>';
  const kind = ts.isClassDeclaration(declaration)
    ? ts.ScriptElementKind.classElement
    : ts.ScriptElementKind.interfaceElement;

  const range: ts.TextSpan = {
    start: declaration.getStart(sourceFile),
    length: declaration.getEnd() - declaration.getStart(sourceFile),
  };

  const selectionRange: ts.TextSpan = declaration.name
    ? {
        start: declaration.name.getStart(sourceFile),
        length: declaration.name.getEnd() - declaration.name.getStart(sourceFile),
      }
    : range;

  return {
    name,
    kind,
    uri: sourceFile.fileName,
    range,
    selectionRange,
    data: declaration.name
      ? {
          fileName: sourceFile.fileName,
          position: declaration.name.getStart(sourceFile),
        }
      : undefined,
  };
}

/**
 * Get a TypeHierarchyItem from an expression in a heritage clause.
 */
function getTypeHierarchyItemFromExpression(
  expression: ts.Expression,
  typeChecker: ts.TypeChecker,
  program: ts.Program,
): TypeHierarchyItem | undefined {
  const symbol = typeChecker.getSymbolAtLocation(expression);
  if (!symbol) {
    return undefined;
  }

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return undefined;
  }

  const declaration = declarations[0];
  if (!ts.isClassDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration)) {
    return undefined;
  }

  const sourceFile = declaration.getSourceFile();
  return createTypeHierarchyItem(declaration, sourceFile);
}
