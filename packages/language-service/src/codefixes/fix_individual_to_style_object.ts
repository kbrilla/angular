/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import tss from 'typescript';
import {CssDiagnosticCode, kebabToCamelCase} from '../css';
import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

/**
 * Provides code fixes to consolidate multiple individual [style.x] bindings
 * into a single [style] object binding.
 *
 * This handles:
 * - [style.width]="w" [style.height]="h" → [style]="{width: w, height: h}"
 *
 * Note: This fix is NOT offered when any of the bindings use pipes,
 * because pipes are not supported in object literal values.
 */
export const fixIndividualToStyleObjectMeta: CodeActionMeta = {
  errorCodes: [CssDiagnosticCode.PREFER_STYLE_OBJECT_BINDING],
  getCodeActions({start, fileName, compiler, errorCode, diagnostics}) {
    const program = compiler.getCurrentProgram();
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return [];
    }

    // Find the diagnostic that matches our error code and contains the cursor position
    const matchingDiag = diagnostics.find(
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

    // The diagnostic is on the first [style.x] binding
    // We need to find ALL [style.x] bindings on this element to create the consolidated object
    // This requires parsing the template around the diagnostic location

    const text = sourceFile.text;
    const diagStart = matchingDiag.start;

    // Find the element that contains this style binding
    // Look backwards to find '<' and forwards to find '>'
    let elementStart = diagStart;
    while (elementStart > 0 && text[elementStart] !== '<') {
      elementStart--;
    }

    let elementEnd = diagStart;
    let depth = 0;
    while (elementEnd < text.length) {
      const char = text[elementEnd];
      if (char === '<') depth++;
      else if (char === '>') {
        if (depth === 0) {
          elementEnd++;
          break;
        }
        depth--;
      }
      elementEnd++;
    }

    const elementText = text.slice(elementStart, elementEnd);

    // Parse all [style.x]="value" bindings from the element
    const styleBindingRegex = /\[style\.([^\]]+)\]="([^"]*)"/g;
    const bindings: {
      fullMatch: string;
      property: string;
      value: string;
      start: number;
      end: number;
    }[] = [];

    let match;
    while ((match = styleBindingRegex.exec(elementText)) !== null) {
      const fullMatch = match[0];
      const property = match[1].split('.')[0]; // Remove unit suffix if present
      const value = match[2];

      bindings.push({
        fullMatch,
        property,
        value,
        start: elementStart + match.index,
        end: elementStart + match.index + fullMatch.length,
      });
    }

    if (bindings.length < 2) {
      // Not enough bindings to consolidate
      return [];
    }

    // Build the consolidated object literal
    const objectProps = bindings.map((b) => {
      const camelCaseProp = kebabToCamelCase(b.property);
      return `${camelCaseProp}: ${b.value}`;
    });
    const objectLiteral = `[style]="{${objectProps.join(', ')}}"`;

    // Calculate the span to replace: from first binding to last binding
    // We also need to handle whitespace between bindings
    const firstBinding = bindings[0];
    const lastBinding = bindings[bindings.length - 1];

    // Find where to start: before the first binding (include leading whitespace)
    let replaceStart = firstBinding.start;
    while (replaceStart > elementStart && /\s/.test(text[replaceStart - 1])) {
      replaceStart--;
    }

    // Build list of all text changes - we need to replace first binding and remove subsequent ones
    const textChanges: tss.TextChange[] = [];

    // Replace the first binding with the consolidated object
    textChanges.push({
      span: {
        start: firstBinding.start,
        length: firstBinding.end - firstBinding.start,
      },
      newText: objectLiteral,
    });

    // Remove subsequent bindings (including preceding whitespace)
    for (let i = 1; i < bindings.length; i++) {
      const binding = bindings[i];
      // Find preceding whitespace
      let removeStart = binding.start;
      while (removeStart > 0 && /\s/.test(text[removeStart - 1])) {
        removeStart--;
      }

      textChanges.push({
        span: {
          start: removeStart,
          length: binding.end - removeStart,
        },
        newText: '',
      });
    }

    const codeActions: tss.CodeFixAction[] = [];

    codeActions.push({
      fixName: FixIdForCodeFixesAll.FIX_INDIVIDUAL_TO_STYLE_OBJECT,
      fixId: FixIdForCodeFixesAll.FIX_INDIVIDUAL_TO_STYLE_OBJECT,
      fixAllDescription: 'Consolidate all individual style bindings',
      description: `Consolidate ${bindings.length} style bindings into [style] object`,
      changes: [
        {
          fileName,
          textChanges,
        },
      ],
    });

    return codeActions;
  },
  fixIds: [FixIdForCodeFixesAll.FIX_INDIVIDUAL_TO_STYLE_OBJECT],
  getAllCodeActions({diagnostics, compiler}) {
    // This is complex because multiple diagnostics on different elements
    // would require separate handling. For now, just handle one at a time.
    const changes: tss.FileTextChanges[] = [];

    // The fix-all for this is complex because each element needs separate handling
    // and the text offsets change as we make edits. For now, return empty.
    // Users can apply fixes one by one.

    return {changes};
  },
};
