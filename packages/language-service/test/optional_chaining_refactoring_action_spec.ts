/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {initMockFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system/testing';

import {createModuleAndProjectWithDeclarations, LanguageServiceTestEnv} from '../testing';

describe('Optional chaining refactoring action', () => {
  let env: LanguageServiceTestEnv;
  beforeEach(() => {
    initMockFileSystem('Native');
    env = LanguageServiceTestEnv.setup();
  });

  it('should offer safe and best-effort full-class refactorings', () => {
    const files = {
      'app.ts': `
        import {Component} from '@angular/core';

        @Component({
          template: '{{ user?.name === null }}'
        })
        export class AppComponent {
          user: {name: string} | null = null;
        }
      `,
    };

    const project = createModuleAndProjectWithDeclarations(env, 'test', files);
    const appFile = project.openFile('app.ts');
    appFile.moveCursorToText('AppComp¦onent');

    const refactorings = project.getRefactoringsAtPosition('app.ts', appFile.cursor);
    const refactoringNames = refactorings.map((r) => r.name);

    expect(refactoringNames).toContain('convert-full-class-optional-chaining-safe-mode');
    expect(refactoringNames).toContain('convert-full-class-optional-chaining-best-effort-mode');
  });

  it('should apply safe full-class optional chaining migration edits', async () => {
    const files = {
      'app.ts': `
        import {Component} from '@angular/core';

        @Component({
          template: '{{ user?.name === null }}'
        })
        export class AppComponent {
          user: {name: string} | null = null;
        }
      `,
    };

    const project = createModuleAndProjectWithDeclarations(env, 'test', files);
    const appFile = project.openFile('app.ts');
    appFile.moveCursorToText('AppComp¦onent');

    const edits = await project.applyRefactoring(
      'app.ts',
      appFile.cursor,
      'convert-full-class-optional-chaining-safe-mode',
      () => {},
    );

    expect(edits?.errorMessage).toBeUndefined();
    expect(edits?.edits.length).toBeGreaterThan(0);
    expect(edits?.edits.some((f) => f.textChanges.length > 0)).toBeTrue();
  });

  it('should apply best-effort full-class optional chaining migration edits', async () => {
    const files = {
      'app.ts': `
        import {Component} from '@angular/core';

        @Component({
          template: '{{ "x" + user?.method() }}'
        })
        export class AppComponent {
          user: {method(): string} | null = null;
        }
      `,
    };

    const project = createModuleAndProjectWithDeclarations(env, 'test', files);
    const appFile = project.openFile('app.ts');
    appFile.moveCursorToText('AppComp¦onent');

    const edits = await project.applyRefactoring(
      'app.ts',
      appFile.cursor,
      'convert-full-class-optional-chaining-best-effort-mode',
      () => {},
    );

    expect(edits?.errorMessage).toBeUndefined();
    expect(edits?.edits.length).toBeGreaterThan(0);
    expect(edits?.edits.some((f) => f.textChanges.length > 0)).toBeTrue();
  });
});
