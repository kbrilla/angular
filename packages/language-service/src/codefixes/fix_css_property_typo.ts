/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import tss from 'typescript';

import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

// Regular expression to extract the suggested property from diagnostic messages
// Examples:
// "Unknown CSS property 'wdith'. Did you mean 'width'?"
// "Variable contains unknown CSS property 'backgroudnColor'. Did you mean 'backgroundColor'?"
const SUGGESTION_REGEX = /Did you mean '([^']+)'\?/;

/**
 * Quick fix for CSS property typos in Angular templates.
 *
 * This fix handles:
 * - Individual style bindings: [style.wdith] -> [style.width]
 * - Object style bindings: [style]="{backgroudnColor: ...}" -> [style]="{backgroundColor: ...}"
 * - Host bindings: host: {'[style.wdith]': ...} -> host: {'[style.width]': ...}
 */
export const fixCssPropertyTypoMeta: CodeActionMeta = {
  errorCodes: [
    ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY),
    ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
    ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
  ],
  getCodeActions({start, end, errorCode, fileName, diagnostics}) {
    // Find the diagnostic that matches this position and error code
    const targetDiag = diagnostics.find(
      (d) => d.start === start && d.length === end - start && d.code === errorCode,
    );

    if (!targetDiag) {
      return [];
    }

    // Extract the message text
    const messageText =
      typeof targetDiag.messageText === 'string'
        ? targetDiag.messageText
        : targetDiag.messageText.messageText;

    // Extract the suggested property name
    const match = messageText.match(SUGGESTION_REGEX);
    if (!match) {
      return [];
    }

    const suggestedProperty = match[1];

    // Get the invalid property name from the diagnostic message
    const invalidPropertyMatch = messageText.match(/Unknown CSS property '([^']+)'/);
    if (!invalidPropertyMatch) {
      return [];
    }
    const invalidProperty = invalidPropertyMatch[1];

    const description = `Change '${invalidProperty}' to '${suggestedProperty}'`;

    return [
      {
        fixName: FixIdForCodeFixesAll.FIX_CSS_PROPERTY_TYPO,
        fixId: FixIdForCodeFixesAll.FIX_CSS_PROPERTY_TYPO,
        fixAllDescription: 'Fix all CSS property typos',
        description,
        changes: [
          {
            fileName,
            textChanges: [
              {
                span: {start, length: end - start},
                newText: suggestedProperty,
              },
            ],
          },
        ],
      },
    ];
  },
  fixIds: [FixIdForCodeFixesAll.FIX_CSS_PROPERTY_TYPO],
  getAllCodeActions({diagnostics}) {
    const fileNameToTextChangesMap = new Map<string, tss.TextChange[]>();

    for (const diag of diagnostics) {
      const fileName = diag.file?.fileName;
      if (fileName === undefined || diag.start === undefined || diag.length === undefined) {
        continue;
      }

      // Extract the message text
      const messageText =
        typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;

      // Extract the suggested property name
      const match = messageText.match(SUGGESTION_REGEX);
      if (!match) {
        continue;
      }

      const suggestedProperty = match[1];

      if (!fileNameToTextChangesMap.has(fileName)) {
        fileNameToTextChangesMap.set(fileName, []);
      }

      fileNameToTextChangesMap.get(fileName)!.push({
        span: {start: diag.start, length: diag.length},
        newText: suggestedProperty,
      });
    }

    const fileTextChanges: tss.FileTextChanges[] = [];
    for (const [fileName, textChanges] of fileNameToTextChangesMap) {
      fileTextChanges.push({
        fileName,
        textChanges,
      });
    }

    return {
      changes: fileTextChanges,
    };
  },
};
