/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import type ts from 'typescript';

import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

function createChange(file: ts.SourceFile, start: number, length: number): ts.TextChange | null {
  const original = file.text.slice(start, start + length);

  if (original.includes('?? null')) {
    return null;
  }

  return {
    span: {start, length},
    newText: `(${original}) ?? null`,
  };
}

export const fixLegacySafeNavigationUsageMeta: CodeActionMeta = {
  errorCodes: [ngErrorCode(ErrorCode.LEGACY_SAFE_NAVIGATION_USAGE)],
  getCodeActions({start, fileName, errorCode, diagnostics}) {
    const fileDiag = (diagnostics ?? []).find(
      (d) =>
        d.code === errorCode &&
        d.file?.fileName === fileName &&
        d.start !== undefined &&
        d.length !== undefined &&
        d.start <= start &&
        start <= d.start + d.length,
    );

    if (
      fileDiag === undefined ||
      fileDiag.file === undefined ||
      fileDiag.start === undefined ||
      fileDiag.length === undefined
    ) {
      return [];
    }

    const change = createChange(fileDiag.file, fileDiag.start, fileDiag.length);
    if (change === null) {
      return [];
    }

    return [
      {
        fixName: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE,
        fixId: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE,
        fixAllDescription: 'Convert all legacy safe navigation usages to preserve null semantics',
        description: 'Convert this safe navigation expression to `?? null` form',
        changes: [
          {
            fileName,
            textChanges: [change],
          },
        ],
      },
    ];
  },
  fixIds: [FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE],
  getAllCodeActions({diagnostics}) {
    const byFile = new Map<string, ts.TextChange[]>();

    for (const diag of diagnostics) {
      if (
        diag.code !== ngErrorCode(ErrorCode.LEGACY_SAFE_NAVIGATION_USAGE) ||
        diag.file === undefined ||
        diag.start === undefined ||
        diag.length === undefined
      ) {
        continue;
      }

      const change = createChange(diag.file, diag.start, diag.length);
      if (change === null) {
        continue;
      }

      if (!byFile.has(diag.file.fileName)) {
        byFile.set(diag.file.fileName, []);
      }
      byFile.get(diag.file.fileName)!.push(change);
    }

    return {
      changes: Array.from(byFile.entries()).map(([fileName, textChanges]) => ({
        fileName,
        textChanges,
      })),
    };
  },
};
