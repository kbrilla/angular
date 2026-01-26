/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {initMockFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system/testing';
import ts from 'typescript';

import {createModuleAndProjectWithDeclarations, LanguageServiceTestEnv} from '../testing';
import {CssDiagnosticCode} from '../src/css';

describe('CSS property validation diagnostics', () => {
  let env: LanguageServiceTestEnv;

  beforeEach(() => {
    initMockFileSystem('Native');
    env = LanguageServiceTestEnv.setup();
  });

  describe('valid CSS properties', () => {
    it('should not report diagnostic for valid CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width]="100"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      // Filter to only CSS diagnostics
      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.INVALID_CSS_UNIT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not report diagnostic for valid CSS property with unit', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width.px]="100"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.INVALID_CSS_UNIT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not report diagnostic for valid camelCase CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.backgroundColor]="color"></div>',
          })
          export class AppComponent {
            color = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.INVALID_CSS_UNIT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not report diagnostic for valid kebab-case CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.background-color]="color"></div>',
          })
          export class AppComponent {
            color = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.INVALID_CSS_UNIT,
      );
      expect(cssDiags.length).toBe(0);
    });
  });

  describe('invalid CSS properties', () => {
    it('should report diagnostic for unknown CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.wdith]="100"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith'");
      expect(cssDiags[0].messageText).toContain("Did you mean 'width'");
    });

    it('should report diagnostic for unknown CSS property with suggestions', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.colro]="color"></div>',
          })
          export class AppComponent {
            color = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'colro'");
      expect(cssDiags[0].messageText).toContain("Did you mean 'color'");
    });

    it('should report diagnostic for multiple unknown CSS properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.wdith]="100" [style.heigth]="100"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY);
      expect(cssDiags.length).toBe(2);
    });

    it('should report diagnostic in external template', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            templateUrl: './app.html',
          })
          export class AppComponent {}
        `,
        'app.html': '<div [style.wdith]="100"></div>',
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.html');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith'");
    });
  });

  describe('CSS unit validation', () => {
    it('should not report diagnostic for valid CSS unit', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width.px]="100"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_CSS_UNIT);
      expect(cssDiags.length).toBe(0);
    });

    it('should not report diagnostic for various valid CSS units', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.width.em]="1"></div>
              <div [style.width.rem]="1"></div>
              <div [style.width.%]="50"></div>
              <div [style.width.vh]="50"></div>
              <div [style.width.vw]="50"></div>
              <div [style.transition-duration.ms]="300"></div>
              <div [style.animation-duration.s]="1"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_CSS_UNIT);
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic for invalid CSS unit', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width.pxs]="100"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_CSS_UNIT);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS unit 'pxs'");
    });
  });

  // TODO: Configuration tests require updating the testing infrastructure to support
  // PluginConfig options (cssPropertyValidation). Currently, the test environment
  // always uses default config. Configuration tests should be added in a follow-up PR.
});
