/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import * as lsp from 'vscode-languageserver';
import {TypeHierarchyItem as NgTypeHierarchyItem} from '@angular/language-service/api';

import {Session} from '../session';
import {
  lspPositionToTsPosition,
  tsTextSpanToLspRange,
  uriToFilePath,
  filePathToUri,
} from '../utils';

/**
 * Handle the `textDocument/prepareTypeHierarchy` LSP request.
 *
 * Returns the type hierarchy item(s) at the cursor position.
 */
export function onPrepareTypeHierarchy(
  session: Session,
  params: lsp.TypeHierarchyPrepareParams,
): lsp.TypeHierarchyItem[] | null {
  const lsInfo = session.getLSAndScriptInfo(params.textDocument);
  if (lsInfo === null) {
    return null;
  }

  const {languageService, scriptInfo} = lsInfo;
  const offset = lspPositionToTsPosition(scriptInfo, params.position);
  const items = languageService.prepareTypeHierarchy(scriptInfo.fileName, offset);

  if (!items || items.length === 0) {
    return null;
  }

  return items.map((item) => convertToLspTypeHierarchyItem(item, scriptInfo));
}

/**
 * Handle the `typeHierarchy/supertypes` LSP request.
 *
 * Returns the supertypes (parent types) of a type hierarchy item.
 */
export function onTypeHierarchySupertypes(
  session: Session,
  params: lsp.TypeHierarchySupertypesParams,
): lsp.TypeHierarchyItem[] | null {
  const item = params.item;
  if (!item.data) {
    return null;
  }

  const filePath = uriToFilePath(item.uri);
  if (!filePath) {
    return null;
  }

  const lsInfo = session.getLSAndScriptInfo({uri: item.uri});
  if (lsInfo === null) {
    return null;
  }

  const {languageService, scriptInfo} = lsInfo;

  // Convert LSP item to our internal format
  const ngItem: NgTypeHierarchyItem = {
    name: item.name,
    kind: item.kind as any,
    uri: filePath,
    range: lspRangeToTsTextSpan(item.range, scriptInfo),
    selectionRange: lspRangeToTsTextSpan(item.selectionRange, scriptInfo),
    data: item.data as {fileName: string; position: number},
  };

  const supertypes = languageService.getTypeHierarchySupertypes(ngItem);
  if (!supertypes || supertypes.length === 0) {
    return null;
  }

  return supertypes.map((superItem) => convertToLspTypeHierarchyItem(superItem, scriptInfo));
}

/**
 * Handle the `typeHierarchy/subtypes` LSP request.
 *
 * Returns the subtypes (child types) of a type hierarchy item.
 */
export function onTypeHierarchySubtypes(
  session: Session,
  params: lsp.TypeHierarchySubtypesParams,
): lsp.TypeHierarchyItem[] | null {
  const item = params.item;
  if (!item.data) {
    return null;
  }

  const filePath = uriToFilePath(item.uri);
  if (!filePath) {
    return null;
  }

  const lsInfo = session.getLSAndScriptInfo({uri: item.uri});
  if (lsInfo === null) {
    return null;
  }

  const {languageService, scriptInfo} = lsInfo;

  // Convert LSP item to our internal format
  const ngItem: NgTypeHierarchyItem = {
    name: item.name,
    kind: item.kind as any,
    uri: filePath,
    range: lspRangeToTsTextSpan(item.range, scriptInfo),
    selectionRange: lspRangeToTsTextSpan(item.selectionRange, scriptInfo),
    data: item.data as {fileName: string; position: number},
  };

  const subtypes = languageService.getTypeHierarchySubtypes(ngItem);
  if (!subtypes || subtypes.length === 0) {
    return null;
  }

  return subtypes.map((subItem) => convertToLspTypeHierarchyItem(subItem, scriptInfo));
}

/**
 * Convert an Angular TypeHierarchyItem to an LSP TypeHierarchyItem.
 */
function convertToLspTypeHierarchyItem(
  item: NgTypeHierarchyItem,
  scriptInfo: any,
): lsp.TypeHierarchyItem {
  const range = tsTextSpanToLspRange(scriptInfo, item.range);
  const selectionRange = tsTextSpanToLspRange(scriptInfo, item.selectionRange);

  // Map ts.ScriptElementKind to lsp.SymbolKind
  const kind = mapScriptElementKindToSymbolKind(item.kind);

  return {
    name: item.name,
    kind,
    uri: filePathToUri(item.uri),
    range: range!,
    selectionRange: selectionRange!,
    detail: item.detail,
    data: item.data,
  };
}

/**
 * Convert an LSP Range to a TypeScript TextSpan.
 */
function lspRangeToTsTextSpan(range: lsp.Range, scriptInfo: any): {start: number; length: number} {
  const snapshot = scriptInfo.getSnapshot();
  const start = snapshot.getPositionOfLineAndCharacter(range.start.line, range.start.character);
  const end = snapshot.getPositionOfLineAndCharacter(range.end.line, range.end.character);
  return {
    start,
    length: end - start,
  };
}

/**
 * Map TypeScript ScriptElementKind to LSP SymbolKind.
 */
function mapScriptElementKindToSymbolKind(kind: string): lsp.SymbolKind {
  switch (kind) {
    case 'class':
      return lsp.SymbolKind.Class;
    case 'interface':
      return lsp.SymbolKind.Interface;
    case 'type':
      return lsp.SymbolKind.TypeParameter;
    case 'enum':
      return lsp.SymbolKind.Enum;
    default:
      return lsp.SymbolKind.Class;
  }
}
