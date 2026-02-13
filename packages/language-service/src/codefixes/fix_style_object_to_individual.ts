/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import tss from 'typescript';
import {CssDiagnosticCode, camelToKebabCase} from '../css';
import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

/**
 * Provides code fixes to convert [style] object bindings to individual [style.x] bindings.
 *
 * This handles:
 * - [style]="{width: w, height: h}" → [style.width]="w" [style.height]="h"
 * - [style]="{color: textColor}" → [style.color]="textColor"
 */
export const fixStyleObjectToIndividualMeta: CodeActionMeta = {
  errorCodes: [CssDiagnosticCode.PREFER_INDIVIDUAL_STYLE_BINDINGS],
  getCodeActions({start, fileName, compiler, errorCode, diagnostics}) {
    const program = compiler.getCurrentProgram();
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return [];
    }

    // Find the diagnostic that matches our error code and contains the cursor position
    const matchingDiag = (diagnostics ?? []).find(
      (d) =>
        d.code === errorCode &&
        d.file?.fileName === fileName &&
        d.start !== undefined &&
        d.length !== undefined &&
        d.start <= start &&
        start <= d.start + d.length,
    );

    if (!matchingDiag || matchingDiag.start === undefined || matchingDiag.length === undefined) {
      return [];
    }

    const text = sourceFile.text;
    const diagStart = matchingDiag.start;

    // We need to find the full binding: [style]="{...}"
    // The diagnostic spans "style" from the keySpan, but the binding is [style]="..."
    // So we need to find: opening [, style, closing ], =, and the value
    let endOfAttrName = diagStart + matchingDiag.length;

    // Skip the closing bracket ] if present
    if (text[endOfAttrName] === ']') {
      endOfAttrName++;
    }

    // Then find the = sign
    let eqIndex = text.indexOf('=', endOfAttrName);
    if (eqIndex === -1) {
      return [];
    }
    // Only allow whitespace between the attribute name and '='
    const betweenNameAndEquals = text.slice(endOfAttrName, eqIndex);
    if (!/^[\s]*$/.test(betweenNameAndEquals)) {
      return [];
    }

    // Skip whitespace and find the opening quote/bracket of the value
    let valueStart = eqIndex + 1;
    while (valueStart < text.length && /\s/.test(text[valueStart])) {
      valueStart++;
    }

    // The value should start with " or '
    const quote = text[valueStart];
    if (quote !== '"' && quote !== "'") {
      return [];
    }

    // Find the matching closing quote
    let valueEnd = valueStart + 1;
    let braceDepth = 0;
    while (valueEnd < text.length) {
      const char = text[valueEnd];
      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === quote && braceDepth === 0) break;
      valueEnd++;
    }

    if (valueEnd >= text.length) {
      return [];
    }

    // Extract the value content (excluding quotes)
    const valueContent = text.slice(valueStart + 1, valueEnd);

    // Parse the object literal to get property names and values
    const properties = parseStyleObjectLiteral(valueContent);
    if (properties.length === 0) {
      return [];
    }

    // Build the replacement text: [style.prop1]="val1" [style.prop2]="val2"
    const individualBindings = properties
      .map((p) => {
        const kebabName = camelToKebabCase(p.name);
        return `[style.${kebabName}]="${p.value}"`;
      })
      .join(' ');

    const codeActions: tss.CodeFixAction[] = [];

    // The full span to replace: from [style] to the closing quote
    const fullBindingStart = text[diagStart - 1] === '[' ? diagStart - 1 : diagStart;
    const fullBindingEnd = valueEnd + 1; // Include the closing quote

    codeActions.push({
      fixName: FixIdForCodeFixesAll.FIX_STYLE_OBJECT_TO_INDIVIDUAL,
      fixId: FixIdForCodeFixesAll.FIX_STYLE_OBJECT_TO_INDIVIDUAL,
      fixAllDescription: 'Convert all [style] objects to individual bindings',
      description: `Convert to individual [style.x] bindings`,
      changes: [
        {
          fileName,
          textChanges: [
            {
              span: {
                start: fullBindingStart,
                length: fullBindingEnd - fullBindingStart,
              },
              newText: individualBindings,
            },
          ],
        },
      ],
    });

    return codeActions;
  },
  fixIds: [FixIdForCodeFixesAll.FIX_STYLE_OBJECT_TO_INDIVIDUAL],
  getAllCodeActions({diagnostics, compiler}) {
    // For "fix all", we apply each fix individually since they may have
    // overlapping spans and need careful handling
    const changes: tss.FileTextChanges[] = [];
    const program = compiler.getCurrentProgram();

    for (const diag of diagnostics) {
      const fileName = diag.file?.fileName;
      if (fileName === undefined || diag.start === undefined || diag.length === undefined) {
        continue;
      }

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        continue;
      }

      const text = sourceFile.text;
      const diagStart = diag.start;

      // Same logic as getCodeActions
      let endOfAttrName = diagStart + diag.length;
      // Skip the closing bracket ] if present
      if (text[endOfAttrName] === ']') {
        endOfAttrName++;
      }
      let eqIndex = text.indexOf('=', endOfAttrName);
      if (eqIndex === -1) continue;
      const betweenNameAndEquals = text.slice(endOfAttrName, eqIndex);
      if (!/^[\s]*$/.test(betweenNameAndEquals)) continue;

      let valueStart = eqIndex + 1;
      while (valueStart < text.length && /\s/.test(text[valueStart])) {
        valueStart++;
      }

      const quote = text[valueStart];
      if (quote !== '"' && quote !== "'") continue;

      let valueEnd = valueStart + 1;
      let braceDepth = 0;
      while (valueEnd < text.length) {
        const char = text[valueEnd];
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
        else if (char === quote && braceDepth === 0) break;
        valueEnd++;
      }

      if (valueEnd >= text.length) continue;

      const valueContent = text.slice(valueStart + 1, valueEnd);
      const properties = parseStyleObjectLiteral(valueContent);
      if (properties.length === 0) continue;

      const individualBindings = properties
        .map((p) => {
          const kebabName = camelToKebabCase(p.name);
          return `[style.${kebabName}]="${p.value}"`;
        })
        .join(' ');

      const fullBindingStart = text[diagStart - 1] === '[' ? diagStart - 1 : diagStart;
      const fullBindingEnd = valueEnd + 1;

      changes.push({
        fileName,
        textChanges: [
          {
            span: {
              start: fullBindingStart,
              length: fullBindingEnd - fullBindingStart,
            },
            newText: individualBindings,
          },
        ],
      });
    }

    return {changes};
  },
};

/**
 * Parse a style object literal string to extract property names and values.
 * Handles: {width: w, height: h, 'font-size': fs}
 */
function parseStyleObjectLiteral(content: string): {name: string; value: string}[] {
  const properties: {name: string; value: string}[] = [];

  // Simple regex-based parsing for common object literal patterns
  // This handles: {propName: value, 'prop-name': value}
  const regex = /(?:['"]?)([\w-]+)(?:['"]?)\s*:\s*([^,}]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim();
    if (name && value) {
      properties.push({name, value});
    }
  }

  return properties;
}
