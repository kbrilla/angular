/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import tss from 'typescript';
import {CssDiagnosticCode} from '../css';
import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

/**
 * Provides code fixes to migrate [ngClass] bindings to [class].
 *
 * This handles:
 * - [ngClass]="'className'" → [class]="'className'"
 * - [ngClass]="classes" → [class]="classes" (where classes is string or string[])
 * - [ngClass]="{active: isActive}" → [class]="{active: isActive}"
 */
export const fixNgClassToClassMeta: CodeActionMeta = {
  errorCodes: [CssDiagnosticCode.PREFER_CLASS_OVER_NGCLASS],
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

    const codeActions: tss.CodeFixAction[] = [];

    // The diagnostic spans "ngClass" - we need to replace it with "class"
    codeActions.push({
      fixName: FixIdForCodeFixesAll.FIX_NGCLASS_TO_CLASS,
      fixId: FixIdForCodeFixesAll.FIX_NGCLASS_TO_CLASS,
      fixAllDescription: 'Convert all [ngClass] to [class]',
      description: `Convert [ngClass] to [class]`,
      changes: [
        {
          fileName,
          textChanges: [
            {
              span: {
                start: matchingDiag.start,
                length: matchingDiag.length,
              },
              newText: 'class',
            },
          ],
        },
      ],
    });

    return codeActions;
  },
  fixIds: [FixIdForCodeFixesAll.FIX_NGCLASS_TO_CLASS],
  getAllCodeActions({diagnostics, compiler}) {
    const fileNameToTextChangesMap = new Map<string, tss.TextChange[]>();
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

      let textChanges = fileNameToTextChangesMap.get(fileName);
      if (!textChanges) {
        textChanges = [];
        fileNameToTextChangesMap.set(fileName, textChanges);
      }

      textChanges.push({
        span: {start: diag.start, length: diag.length},
        newText: 'class',
      });
    }

    const changes: tss.FileTextChanges[] = [];
    for (const [fileName, textChanges] of fileNameToTextChangesMap) {
      changes.push({fileName, textChanges});
    }

    return {changes};
  },
};
