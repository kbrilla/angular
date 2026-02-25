/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import type ts from 'typescript';

import {CodeActionMeta} from './utils';

const REGEXP_LITERAL_RE = /\/((?:\\.|[^/\\\n])+?)\/([a-z]*)/g;

export const fixTemplateParseErrorsMeta: CodeActionMeta = {
  errorCodes: [ngErrorCode(ErrorCode.TEMPLATE_PARSE_ERROR)],
  getCodeActions({fileName, start, tsLs}) {
    const source = tsLs.getProgram()?.getSourceFile(fileName)?.text;
    if (source === undefined) {
      return [];
    }

    const fixes: ts.CodeFixAction[] = [];
    const duplicateFlagFix = createDuplicateRegexFlagFix(source, fileName, start);
    if (duplicateFlagFix !== null) {
      fixes.push(duplicateFlagFix);
    }

    const missingBraceFix = createMissingUnicodeBraceFix(source, fileName, start);
    if (missingBraceFix !== null) {
      fixes.push(missingBraceFix);
    }

    return fixes;
  },
  fixIds: [],
  getAllCodeActions() {
    return {changes: []};
  },
};

function createDuplicateRegexFlagFix(
  source: string,
  fileName: string,
  start: number,
): ts.CodeFixAction | null {
  REGEXP_LITERAL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REGEXP_LITERAL_RE.exec(source)) !== null) {
    const flags = match[2] ?? '';
    const duplicate = findFirstDuplicateFlag(flags);
    if (duplicate === null) {
      continue;
    }

    const flagsStart = match.index + match[0].length - flags.length;
    const duplicateFlagOffset = flagsStart + duplicate.index;

    // Only offer this fix when the selected diagnostic position overlaps the flags.
    if (start < flagsStart || start > flagsStart + flags.length) {
      continue;
    }

    return {
      fixName: 'fixDuplicateRegexFlag',
      description: `Remove duplicate regular expression flag '${duplicate.flag}'`,
      changes: [
        {
          fileName,
          textChanges: [
            {
              span: {start: duplicateFlagOffset, length: 1},
              newText: '',
            },
          ],
        },
      ],
    };
  }

  return null;
}

function createMissingUnicodeBraceFix(
  source: string,
  fileName: string,
  start: number,
): ts.CodeFixAction | null {
  if (start < 0 || start > source.length) {
    return null;
  }

  const charAtStart = source[start] ?? '';
  const looksLikeStringBoundary =
    start === source.length || charAtStart === '\'' || charAtStart === '"' || charAtStart === '`';
  if (!looksLikeStringBoundary) {
    return null;
  }

  const lookBehind = source.slice(Math.max(0, start - 16), start);
  if (!/\\u\{[0-9a-fA-F]{1,6}$/.test(lookBehind)) {
    return null;
  }

  return {
    fixName: 'fixMissingUnicodeBrace',
    description: 'Insert missing } in Unicode escape',
    changes: [
      {
        fileName,
        textChanges: [
          {
            span: {start, length: 0},
            newText: '}',
          },
        ],
      },
    ],
  };
}

function findFirstDuplicateFlag(flags: string): {flag: string; index: number} | null {
  const seen = new Set<string>();
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (seen.has(flag)) {
      return {flag, index: i};
    }
    seen.add(flag);
  }
  return null;
}
