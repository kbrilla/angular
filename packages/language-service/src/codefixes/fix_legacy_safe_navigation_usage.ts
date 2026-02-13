/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import type ts from 'typescript';
import {migrateHostExpression} from '../../../core/schematics/migrations/optional-chaining-semantics-migration/optional-chaining-semantics-migration';

import {CodeActionMeta, FixIdForCodeFixesAll} from './utils';

function computeReplacement(original: string, bestEffort: boolean): string | null {
  const migrationResult = migrateHostExpression(original, bestEffort);
  if (migrationResult.migrated !== original) {
    return migrationResult.migrated;
  }

  if (bestEffort && !original.includes('?? null')) {
    return `(${original}) ?? null`;
  }

  return null;
}

function createChange(
  file: ts.SourceFile,
  start: number,
  length: number,
  bestEffort: boolean,
): ts.TextChange | null {
  const original = file.text.slice(start, start + length);

  const replacement = computeReplacement(original, bestEffort);
  if (replacement === null) {
    return null;
  }

  return {
    span: {start, length},
    newText: replacement,
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
