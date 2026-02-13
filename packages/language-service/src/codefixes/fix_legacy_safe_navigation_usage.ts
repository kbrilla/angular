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

/**
 * Expands the diagnostic span (which may cover just the property name)
 * backwards to include the full safe-navigation expression chain.
 *
 * For example, if the diagnostic highlights `name` in `user?.name`,
 * this expands start backwards past `?.` and the receiver to get `user?.name`.
 */
function expandToFullSafeNavExpression(
  text: string,
  diagStart: number,
  diagLength: number,
): {start: number; length: number} {
  let start = diagStart;

  // Walk backwards: skip `?.` then the receiver identifier chain
  while (start > 0) {
    // Check for `?.` immediately before current start
    if (start >= 2 && text[start - 2] === '?' && text[start - 1] === '.') {
      start -= 2;
      // Now skip receiver identifier backwards (letters, digits, $, _, and dots for chains)
      while (start > 0 && /[\w$.]/.test(text[start - 1])) {
        start--;
      }
    } else {
      break;
    }
  }

  const end = diagStart + diagLength;
  return {start, length: end - start};
}

/**
 * Converts a safe navigation expression like `a?.b` into a ternary that
 * preserves the legacy `null` return: `a != null ? a.b : null`.
 *
 * Only handles simple property chains (dotted access). Returns `null` for
 * expressions that can't be safely converted (e.g. method calls, keyed access).
 */
function safeConvert(expr: string): string | null {
  // Match chains like `a?.b`, `a?.b?.c`, `a.b?.c?.d`
  if (!/^[a-zA-Z_$][\w$]*([.?][.][a-zA-Z_$][\w$]*)*$/.test(expr)) {
    return null;
  }

  const parts = expr.split('?.');
  if (parts.length < 2) {
    return null;
  }

  let result = parts.join('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const guard = parts.slice(0, i).join('.');
    result = `${guard} != null ? ${result} : null`;
  }
  return result;
}

function createChange(
  file: ts.SourceFile,
  diagStart: number,
  diagLength: number,
  bestEffort: boolean,
): ts.TextChange | null {
  const {start, length} = expandToFullSafeNavExpression(file.text, diagStart, diagLength);
  const original = file.text.slice(start, start + length);

  if (bestEffort) {
    return {
      span: {start, length},
      newText: `${original} ?? null`,
    };
  }

  const safeResult = safeConvert(original);
  if (safeResult === null) {
    return null;
  }

  return {
    span: {start, length},
    newText: safeResult,
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

    const safeChange = createChange(fileDiag.file, fileDiag.start, fileDiag.length, false);
    const bestEffortChange = createChange(fileDiag.file, fileDiag.start, fileDiag.length, true);

    const actions: ts.CodeFixAction[] = [];
    if (safeChange !== null) {
      actions.push({
        fixName: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_SAFE,
        fixId: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_SAFE,
        fixAllDescription:
          'Migrate all legacy safe navigation usages in this file (safe conversion only)',
        description: 'Migrate this safe navigation expression (safe)',
        changes: [
          {
            fileName,
            textChanges: [safeChange],
          },
        ],
      });
    }

    if (bestEffortChange !== null && bestEffortChange.newText !== safeChange?.newText) {
      actions.push({
        fixName: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_BEST_EFFORT,
        fixId: FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_BEST_EFFORT,
        fixAllDescription:
          'Migrate all legacy safe navigation usages in this file (best effort, may require review)',
        description: 'Migrate this safe navigation expression (best effort)',
        changes: [
          {
            fileName,
            textChanges: [bestEffortChange],
          },
        ],
      });
    }

    return actions;
  },
  fixIds: [
    FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_SAFE,
    FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_BEST_EFFORT,
  ],
  getAllCodeActions({diagnostics, fixId}) {
    const bestEffort = fixId === FixIdForCodeFixesAll.FIX_LEGACY_SAFE_NAVIGATION_USAGE_BEST_EFFORT;

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

      const change = createChange(diag.file, diag.start, diag.length, bestEffort);
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
