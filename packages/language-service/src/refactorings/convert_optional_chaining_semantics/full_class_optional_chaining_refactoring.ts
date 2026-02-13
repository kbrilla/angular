/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {CompilerOptions} from '@angular/compiler-cli';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import {MigrationConfig} from '@angular/core/schematics/migrations/optional-chaining-semantics-migration/optional-chaining-semantics-migration';
import {ApplyRefactoringProgressFn, ApplyRefactoringResult} from '../../../api';
import ts from 'typescript';
import {isTypeScriptFile} from '../../utils';
import {findTightestNode, getParentClassDeclaration} from '../../utils/ts_utils';
import {isDirectiveOrComponent} from '../../utils/decorators';
import type {ActiveRefactoring} from '../refactoring';
import {applyOptionalChainingSemanticsRefactoring} from './apply_optional_chaining_refactoring';

abstract class BaseConvertFullClassOptionalChainingRefactoring implements ActiveRefactoring {
  abstract config: MigrationConfig;

  constructor(private project: ts.server.Project) {}

  static isApplicable(
    compiler: NgCompiler,
    fileName: string,
    positionOrRange: number | ts.TextRange,
  ): boolean {
    if (!isTypeScriptFile(fileName)) {
      return false;
    }

    const sf = compiler.getCurrentProgram().getSourceFile(fileName);
    if (sf === undefined) {
      return false;
    }

    const start = typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos;
    const node = findTightestNode(sf, start);
    if (node === undefined) {
      return false;
    }

    const classDecl = getParentClassDeclaration(node);
    if (classDecl === undefined) {
      return false;
    }

    const {reflector} = compiler['ensureAnalyzed']();
    if (!isDirectiveOrComponent(classDecl, reflector)) {
      return false;
    }

    return classDecl.getText().includes('?.');
  }

  async computeEditsForFix(
    compiler: NgCompiler,
    compilerOptions: CompilerOptions,
    fileName: string,
    positionOrRange: number | ts.TextRange,
    reportProgress: ApplyRefactoringProgressFn,
  ): Promise<ApplyRefactoringResult> {
    const sf = compiler.getCurrentProgram().getSourceFile(fileName);
    if (sf === undefined) {
      return {edits: []};
    }

    const start = typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos;
    const node = findTightestNode(sf, start);
    if (node === undefined) {
      return {edits: []};
    }

    const containingClass = getParentClassDeclaration(node);
    if (containingClass === undefined) {
      return {edits: [], errorMessage: 'Could not find a class for the refactoring.'};
    }

    const className = containingClass.name?.text;
    if (className === undefined) {
      return {edits: [], errorMessage: 'Could not determine class name for migration.'};
    }

    return await applyOptionalChainingSemanticsRefactoring(
      compiler,
      compilerOptions,
      this.config,
      this.project,
      reportProgress,
      (result) => result.componentName === className,
    );
  }
}

export class ConvertFullClassOptionalChainingRefactoring extends BaseConvertFullClassOptionalChainingRefactoring {
  static id = 'convert-full-class-optional-chaining-safe-mode';
  static description =
    'Full class: Migrate optional chaining semantics in templates/host (safe, with TODOs)';
  override config: MigrationConfig = {
    insertTodosForSkippedExpressions: true,
  };
}

export class ConvertFullClassOptionalChainingBestEffortRefactoring extends BaseConvertFullClassOptionalChainingRefactoring {
  static id = 'convert-full-class-optional-chaining-best-effort-mode';
  static description =
    'Full class: Migrate optional chaining semantics in templates/host (best effort)';
  override config: MigrationConfig = {
    bestEffortMode: true,
    insertTodosForSkippedExpressions: true,
  };
}
