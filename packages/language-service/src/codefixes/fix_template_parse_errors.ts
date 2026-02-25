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

const REGEXP_LITERAL_RE = /\/((?:\\.|[^/\\\n])+?)\/([a-z]*)/g;
const DUPLICATE_REGEX_FLAG_SUBCODE = 'duplicate_regex_flag';
const MISSING_UNICODE_ESCAPE_BRACE_SUBCODE = 'missing_unicode_escape_brace';

interface TemplateParseMetadata {
  subcode: string;
  payload?: {
    flag?: string;
  };
}

type TemplateParseDiagnostic = ts.Diagnostic & {
  templateParseMetadata?: TemplateParseMetadata;
};

export const fixTemplateParseErrorsMeta: CodeActionMeta = {
  errorCodes: [ngErrorCode(ErrorCode.TEMPLATE_PARSE_ERROR)],
  getCodeActions({fileName, start, tsLs, diagnostics}) {
    const source = tsLs.getProgram()?.getSourceFile(fileName)?.text;
    if (source === undefined) {
      return [];
    }

    const diagnosticAtPosition = findDiagnosticAtPosition(diagnostics, start);
    const metadata = getTemplateParseMetadata(diagnosticAtPosition);
    if (metadata === undefined) {
      return [];
    }

    return getTemplateParseFixes(source, fileName, start, metadata);
  },
  fixIds: [FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS],
  getAllCodeActions({diagnostics}) {
    const fileNameToChanges = new Map<string, ts.TextChange[]>();
    const fileNameToSeenChange = new Map<string, Set<string>>();
    const filesHandledForGlobalRegexFix = new Set<string>();

    for (const diagnostic of diagnostics) {
      const fileName = diagnostic.file?.fileName;
      const source = diagnostic.file?.text;
      const start = diagnostic.start;
      if (fileName === undefined || source === undefined || start === undefined) {
        continue;
      }

      const metadata = getTemplateParseMetadata(diagnostic);
      if (metadata === undefined) {
        continue;
      }

      if (
        !filesHandledForGlobalRegexFix.has(fileName) &&
        metadata.subcode === DUPLICATE_REGEX_FLAG_SUBCODE
      ) {
        filesHandledForGlobalRegexFix.add(fileName);
        const globalRegexFixes = createDuplicateRegexFlagFixesForWholeSource(source, fileName);
        for (const fix of globalRegexFixes) {
          for (const fileChange of fix.changes) {
            appendFileTextChanges(fileNameToChanges, fileNameToSeenChange, fileChange);
          }
        }
      }

      const fixes = getTemplateParseFixes(source, fileName, start, metadata);
      for (const fix of fixes) {
        for (const fileChange of fix.changes) {
          appendFileTextChanges(fileNameToChanges, fileNameToSeenChange, fileChange);
        }
      }
    }

    return {
      changes: Array.from(fileNameToChanges.entries()).map(([fileName, textChanges]) => ({
        fileName,
        textChanges,
      })),
    };
  },
};

function getTemplateParseFixes(
  source: string,
  fileName: string,
  start: number,
  metadata: TemplateParseMetadata,
): ts.CodeFixAction[] {
  const fixes: ts.CodeFixAction[] = [];

  if (metadata.subcode === DUPLICATE_REGEX_FLAG_SUBCODE) {
    const duplicateFlagFix = createDuplicateRegexFlagFix(
      source,
      fileName,
      start,
      metadata.payload?.flag,
    );
    if (duplicateFlagFix !== null) {
      fixes.push(duplicateFlagFix);
    }
  }

  if (metadata.subcode === MISSING_UNICODE_ESCAPE_BRACE_SUBCODE) {
    const missingBraceFix = createMissingUnicodeBraceFix(source, fileName, start);
    if (missingBraceFix !== null) {
      fixes.push(missingBraceFix);
    }
  }

  return fixes;
}

function createDuplicateRegexFlagFix(
  source: string,
  fileName: string,
  start: number,
  expectedFlag?: string,
): ts.CodeFixAction | null {
  REGEXP_LITERAL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REGEXP_LITERAL_RE.exec(source)) !== null) {
    const flagsLength = match[2]?.length ?? 0;
    const duplicates = getDuplicateRegexFlagsForMatch(match).filter(
      (duplicate) => expectedFlag === undefined || duplicate.flag === expectedFlag,
    );
    if (duplicates.length === 0) {
      continue;
    }

    const flagsStart = match.index + match[0].length - flagsLength;

    // Only offer this fix when the selected diagnostic position overlaps the flags.
    if (start < flagsStart || start > flagsStart + flagsLength) {
      continue;
    }

    return {
      fixName: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
      fixId: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
      fixAllDescription: 'Fix all parser/lexer syntax quick fixes',
      description: 'Remove duplicate regular expression flag(s)',
      changes: [
        {
          fileName,
          textChanges: duplicates.map((duplicate) => ({
            span: {start: flagsStart + duplicate.index, length: 1},
            newText: '',
          })),
        },
      ],
    };
  }

  return null;
}

function createDuplicateRegexFlagFixesForWholeSource(
  source: string,
  fileName: string,
): ts.CodeFixAction[] {
  const fixes: ts.CodeFixAction[] = [];
  REGEXP_LITERAL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REGEXP_LITERAL_RE.exec(source)) !== null) {
    const duplicates = getDuplicateRegexFlagsForMatch(match);
    if (duplicates.length === 0) {
      continue;
    }

    const flagsStart = match.index + match[0].length - (match[2]?.length ?? 0);
    fixes.push({
      fixName: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
      fixId: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
      fixAllDescription: 'Fix all parser/lexer syntax quick fixes',
      description: 'Remove duplicate regular expression flag(s)',
      changes: [
        {
          fileName,
          textChanges: duplicates.map((duplicate) => ({
            span: {start: flagsStart + duplicate.index, length: 1},
            newText: '',
          })),
        },
      ],
    });
  }

  return fixes;
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
    start === source.length || charAtStart === "'" || charAtStart === '"' || charAtStart === '`';
  if (!looksLikeStringBoundary) {
    return null;
  }

  const lookBehind = source.slice(Math.max(0, start - 16), start);
  if (!/\\u\{[0-9a-fA-F]{1,6}$/.test(lookBehind)) {
    return null;
  }

  return {
    fixName: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
    fixId: FixIdForCodeFixesAll.FIX_TEMPLATE_PARSE_ERRORS,
    fixAllDescription: 'Fix all parser/lexer syntax quick fixes',
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

function findDuplicateFlags(flags: string): Array<{flag: string; index: number}> {
  const seen = new Set<string>();
  const duplicates: Array<{flag: string; index: number}> = [];
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (seen.has(flag)) {
      duplicates.push({flag, index: i});
      continue;
    }
    seen.add(flag);
  }
  return duplicates;
}

function getDuplicateRegexFlagsForMatch(
  match: RegExpExecArray,
): Array<{flag: string; index: number}> {
  return findDuplicateFlags(match[2] ?? '');
}

function findDiagnosticAtPosition(
  diagnostics: ts.Diagnostic[],
  start: number,
): TemplateParseDiagnostic | undefined {
  return diagnostics.find((diagnostic) => {
    if (diagnostic.start === undefined || diagnostic.length === undefined) {
      return false;
    }
    return start >= diagnostic.start && start <= diagnostic.start + diagnostic.length;
  }) as TemplateParseDiagnostic | undefined;
}

function getTemplateParseMetadata(
  diagnostic: ts.Diagnostic | undefined,
): TemplateParseMetadata | undefined {
  const metadata = (diagnostic as TemplateParseDiagnostic | undefined)?.templateParseMetadata;
  if (metadata === undefined || typeof metadata.subcode !== 'string') {
    return undefined;
  }
  return metadata;
}

function appendFileTextChanges(
  fileNameToChanges: Map<string, ts.TextChange[]>,
  fileNameToSeenChange: Map<string, Set<string>>,
  fileChange: ts.FileTextChanges,
): void {
  if (!fileNameToChanges.has(fileChange.fileName)) {
    fileNameToChanges.set(fileChange.fileName, []);
    fileNameToSeenChange.set(fileChange.fileName, new Set<string>());
  }
  const changes = fileNameToChanges.get(fileChange.fileName)!;
  const seen = fileNameToSeenChange.get(fileChange.fileName)!;
  for (const textChange of fileChange.textChanges) {
    const key = `${textChange.span.start}:${textChange.span.length}:${textChange.newText}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    changes.push(textChange);
  }
}
