/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {CompilerOptions} from '@angular/compiler-cli';
import {getFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import type ts from 'typescript';
import {groupReplacementsByFile} from '@angular/core/schematics/utils/tsurge/helpers/group_replacements';
import {ApplyRefactoringProgressFn, ApplyRefactoringResult} from '../../../api';
import {
  MigrationConfig,
  OptionalChainingSemanticsMigration,
} from '@angular/core/schematics/migrations/optional-chaining-semantics-migration/optional-chaining-semantics-migration';
import {getProgramInfoFromBaseInfo} from '../../../../core/schematics/utils/tsurge';

export async function applyOptionalChainingSemanticsRefactoring(
  compiler: NgCompiler,
  compilerOptions: CompilerOptions,
  config: MigrationConfig,
  project: ts.server.Project,
  reportProgress: ApplyRefactoringProgressFn,
  shouldIncludeTemplateResult: (result: {componentName: string; filePath: string}) => boolean,
): Promise<ApplyRefactoringResult> {
  reportProgress(0, 'Starting optional chaining migration. Analyzing..');

  const fs = getFileSystem();
  const programInfo = getProgramInfoFromBaseInfo({
    ngCompiler: compiler,
    program: compiler.getCurrentProgram(),
    userOptions: compilerOptions,
    host: {
      getCanonicalFileName: (file) => project.projectService.toCanonicalFileName(file),
      getCurrentDirectory: () => project.getCurrentDirectory(),
    },
    __programAbsoluteRootFileNames: [],
  });

  const migration = new OptionalChainingSemanticsMigration({
    ...config,
    reportProgressFn: reportProgress,
  });

  const unitData = await migration.analyze(programInfo);
  const globalMeta = await migration.globalMeta(unitData);
  const filteredTemplates = globalMeta.templates.filter((t) =>
    shouldIncludeTemplateResult({
      componentName: t.componentName,
      filePath: t.file.rootRelativePath,
    }),
  );

  if (filteredTemplates.length === 0) {
    return {
      edits: [],
      errorMessage: 'Could not find optional chaining migration targets for this class.',
    };
  }

  const {replacements} = await migration.migrate({templates: filteredTemplates});
  const fileUpdates = Array.from(groupReplacementsByFile(replacements).entries());
  const edits: ts.FileTextChanges[] = fileUpdates.map(([relativePath, changes]) => ({
    fileName: fs.join(programInfo.projectRoot, relativePath),
    textChanges: changes.map((c) => ({
      newText: c.data.toInsert,
      span: {
        start: c.data.position,
        length: c.data.end - c.data.position,
      },
    })),
  }));

  return {edits};
}
