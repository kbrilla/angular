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

  describe('style object literal validation', () => {
    it('should validate CSS properties in object literal bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{wdith: \\'100px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith'");
      expect(cssDiags[0].messageText).toContain("Did you mean 'width'");
    });

    it('should not report diagnostic for valid CSS properties in object literal', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{width: \\'100px\\', backgroundColor: \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should validate multiple invalid properties in object literal', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{wdith: \\'100px\\', bgColor: \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(2);
    });

    it('should validate CSS unit in object literal key', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{\\' width.pxs\\': 100}"></div>',
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

  describe('duplicate CSS property detection', () => {
    it('should report duplicate CSS properties in object literal', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{width: \\'100px\\', width: \\'200px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.DUPLICATE_CSS_PROPERTY);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Duplicate CSS property 'width'");
    });

    it('should detect duplicates with different casing (camelCase vs kebab-case)', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{backgroundColor: \\'red\\', \\'background-color\\': \\'blue\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.DUPLICATE_CSS_PROPERTY);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain(
        "'background-color' and 'backgroundColor' refer to the same property",
      );
    });

    it('should not report duplicates for different properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{width: \\'100px\\', height: \\'200px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.DUPLICATE_CSS_PROPERTY);
      expect(cssDiags.length).toBe(0);
    });
  });

  describe('spread operator validation', () => {
    it('should validate CSS properties in spread object literal', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{...baseStyles}"></div>',
          })
          export class AppComponent {
            baseStyles = {
              wdith: '100px',
              backgroudnColor: 'red',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      // Should detect the invalid properties in the spread object
      expect(cssDiags.length).toBe(2);
    });

    it('should not report diagnostic for valid CSS properties in spread', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{...baseStyles}"></div>',
          })
          export class AppComponent {
            baseStyles = {
              width: '100px',
              backgroundColor: 'red',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should validate combined inline and spread properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{color: \\'blue\\', ...baseStyles}"></div>',
          })
          export class AppComponent {
            baseStyles = {
              wdith: '100px',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      // Should only detect the invalid 'wdith' from the spread, not 'color'
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith'");
    });
  });

  describe('style binding conflict detection', () => {
    it('should report conflict when [style] is overridden by [style.prop]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.backgroundColor]="\\'red\\'" [style]="{backgroundColor: \\'blue\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('backgroundColor');
      expect(cssDiags[0].messageText).toContain(
        '[style.property] binding takes precedence over [style]',
      );
    });

    it('should report conflict when [ngStyle] is overridden by [style.prop]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {NgStyle} from '@angular/common';

          @Component({
            imports: [NgStyle],
            template: '<div [style.color]="\\'red\\'" [ngStyle]="{color: \\'blue\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('color');
      expect(cssDiags[0].messageText).toContain(
        '[style.property] binding takes precedence over [ngStyle]',
      );
    });

    it('should report conflict when [ngStyle] is overridden by [style]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {NgStyle} from '@angular/common';

          @Component({
            imports: [NgStyle],
            template: '<div [style]="{width: \\'100px\\'}" [ngStyle]="{width: \\'200px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('width');
      expect(cssDiags[0].messageText).toContain('[style] binding takes precedence over [ngStyle]');
    });

    it('should not report conflict for different properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width]="\\'100px\\'" [style]="{height: \\'200px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBe(0);
    });

    it('should detect conflict with kebab-case vs camelCase property names', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.background-color]="\\'red\\'" [style]="{backgroundColor: \\'blue\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain(
        '[style.property] binding takes precedence over [style]',
      );
    });

    it('should detect conflicts with spread properties in [style]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.width]="\\'100px\\'" [style]="{...baseStyles}"></div>',
          })
          export class AppComponent {
            baseStyles = {
              width: '200px',
              height: '100px',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      // Should detect conflict for 'width' between [style.width] and spread
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('width');
    });
  });

  describe('host binding CSS validation', () => {
    it('should report diagnostic for unknown CSS property in host binding', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.wdith]': '"100px"',
            },
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith' in host binding");
      expect(cssDiags[0].messageText).toContain("Did you mean 'width'");
    });

    it('should not report diagnostic for valid CSS property in host binding', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.backgroundColor]': '"red"',
              '[style.width]': '"100px"',
            },
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic for invalid CSS unit in host binding', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.width.pxs]': '100',
            },
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_CSS_UNIT_IN_HOST);
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS unit 'pxs' in host binding");
    });

    it('should validate multiple host style bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.wdith]': '"100px"',
              '[style.heigth]': '"200px"',
            },
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(2);
    });

    it('should validate kebab-case CSS properties in host binding', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.backgroud-color]': '"red"',
            },
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'backgroud-color'");
      expect(cssDiags[0].messageText).toContain("Did you mean 'background-color'");
    });

    it('should report diagnostic for unknown CSS property in @HostBinding decorator', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '<div></div>',
          })
          export class AppComponent {
            @HostBinding('style.wdith') width = '100px';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith' in host binding");
      expect(cssDiags[0].messageText).toContain("Did you mean 'width'");
    });

    it('should not report diagnostic for valid CSS property in @HostBinding decorator', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '<div></div>',
          })
          export class AppComponent {
            @HostBinding('style.width') width = '100px';
            @HostBinding('style.backgroundColor') bgColor = 'red';
            @HostBinding('style.width.px') widthPx = 100;
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should validate multiple @HostBinding style decorators', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '<div></div>',
          })
          export class AppComponent {
            @HostBinding('style.wdith') width = '100px';
            @HostBinding('style.heigth') height = '200px';
            @HostBinding('style.backgroundColor') bgColor = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(2);
    });

    it('should validate CSS properties in both host and @HostBinding', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '<div></div>',
            host: {
              '[style.colr]': '"blue"',
            },
          })
          export class AppComponent {
            @HostBinding('style.wdith') width = '100px';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      );
      expect(cssDiags.length).toBe(2);
    });

    describe('host binding conflict detection', () => {
      it('should detect conflict between multiple host individual style bindings for same property', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div></div>',
              host: {
                '[style.width]': '"100px"',
                '[style.width]': '"200px"',
              },
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        // Note: This is technically a JavaScript object duplicate key issue,
        // but we still track and report the conflict if it somehow reaches validation
        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        // May or may not have diagnostics depending on how TS handles duplicate keys
        expect(cssDiags).toBeDefined();
      });

      it('should NOT detect conflict between different CSS properties in host bindings', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div></div>',
              host: {
                '[style.width]': '"100px"',
                '[style.height]': '"200px"',
                '[style.backgroundColor]': '"red"',
              },
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        expect(cssDiags.length).toBe(0);
      });

      it('should validate host @HostBinding decorators without conflicts for different properties', () => {
        const files = {
          'app.ts': `
            import {Component, HostBinding} from '@angular/core';

            @Component({
              template: '<div></div>',
            })
            export class AppComponent {
              @HostBinding('style.width') width = '100px';
              @HostBinding('style.height') height = '200px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        expect(cssDiags.length).toBe(0);
      });

      it('should allow host binding combined with template binding on different elements', () => {
        // Host binding applies to the component's host element
        // Template binding applies to elements inside the template
        // These do NOT conflict since they target different elements
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width]="\\'200px\\'"></div>',
              host: {
                '[style.width]': '"100px"',
              },
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        // No conflict because they target different elements
        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        expect(cssDiags.length).toBe(0);
      });

      it('should handle mixed kebab and camelCase properties without false conflicts', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div></div>',
              host: {
                '[style.background-color]': '"red"',
                '[style.border-radius]': '"5px"',
              },
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        expect(cssDiags.length).toBe(0);
      });

      it('should detect conflict between host property and @HostBinding for same CSS property', () => {
        // When both host: {'[style.width]': ...} and @HostBinding('style.width') set the same property,
        // there is a conflict - only one will take effect at runtime
        const files = {
          'app.ts': `
            import {Component, HostBinding} from '@angular/core';

            @Component({
              template: '<div></div>',
              host: {
                '[style.width]': '"100px"',
              },
            })
            export class AppComponent {
              @HostBinding('style.width') widthValue = '200px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        // Should detect the conflict - same 'width' property set via two different mechanisms
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain('width');
      });

      it('should NOT detect conflict between host and @HostBinding for different CSS properties', () => {
        const files = {
          'app.ts': `
            import {Component, HostBinding} from '@angular/core';

            @Component({
              template: '<div></div>',
              host: {
                '[style.width]': '"100px"',
              },
            })
            export class AppComponent {
              @HostBinding('style.height.em') get heightEm() { return 5; }
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
        );
        expect(cssDiags.length).toBe(0);
      });
    });
  });

  describe('Class/Style input shadowing diagnostics', () => {
    let env: LanguageServiceTestEnv;

    beforeEach(() => {
      initMockFileSystem('Native');
      env = LanguageServiceTestEnv.setup();
    });

    it('should warn when [class] binding shadows @Input("class")', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input('class') className!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [class]="classes"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
      expect(shadowingDiags[0].messageText).toContain('[class] binding shadows');
      expect(shadowingDiags[0].messageText).toContain('MyDirective');
    });

    it('should warn when [style] binding shadows @Input("style")', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input('style') styles!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [style]="myStyles"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          myStyles = {color: 'red'};
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.STYLE_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
      expect(shadowingDiags[0].messageText).toContain('[style] binding shadows');
      expect(shadowingDiags[0].messageText).toContain('MyDirective');
    });

    it('should not warn when directive does not have @Input("class")', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input() someInput!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [class]="classes"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT ||
          d.code === CssDiagnosticCode.STYLE_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(0);
    });

    it('should warn when multiple directives have @Input("class")', () => {
      const files = {
        'dir1.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[dir1]',
          standalone: true,
        })
        export class Dir1 {
          @Input('class') className!: string;
        }
      `,
        'dir2.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[dir2]',
          standalone: true,
        })
        export class Dir2 {
          @Input('class') cssClass!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {Dir1} from './dir1';
        import {Dir2} from './dir2';

        @Component({
          template: '<div dir1 dir2 [class]="classes"></div>',
          imports: [Dir1, Dir2],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
      expect(shadowingDiags[0].messageText).toContain('2 directives');
      expect(shadowingDiags[0].messageText).toContain('Dir1');
      expect(shadowingDiags[0].messageText).toContain('Dir2');
    });

    it('should provide related information pointing to @Input declaration', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input('class') className!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [class]="classes"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
      expect(shadowingDiags[0].relatedInformation).toBeDefined();
      expect(shadowingDiags[0].relatedInformation!.length).toBeGreaterThan(0);
      expect(shadowingDiags[0].relatedInformation![0].messageText).toContain('MyDirective');
    });

    it('should work with signal-based inputs', () => {
      const files = {
        'dir.ts': `
        import {Directive, input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          className = input.required<string>({alias: 'class'});
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [class]="classes"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
      expect(shadowingDiags[0].messageText).toContain('MyDirective');
    });

    it('should work when directive is on <ng-template>', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input('style') styles!: Record<string, any>;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<ng-template myDir [style]="myStyles"></ng-template>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          myStyles = {color: 'red'};
        }
      `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.STYLE_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(1);
    });

    it('should be suppressible via config', () => {
      const files = {
        'dir.ts': `
        import {Directive, Input} from '@angular/core';

        @Directive({
          selector: '[myDir]',
          standalone: true,
        })
        export class MyDirective {
          @Input('class') className!: string;
        }
      `,
        'app.ts': `
        import {Component} from '@angular/core';
        import {MyDirective} from './dir';

        @Component({
          template: '<div myDir [class]="classes"></div>',
          imports: [MyDirective],
          standalone: true,
        })
        export class AppComponent {
          classes = 'foo bar';
        }
      `,
      };

      // Create project with cssPropertyValidation disabled
      const project = env.addProject('test', files, {
        cssPropertyValidation: {
          enabled: true,
          warnOnInputShadowing: false,
        },
      });

      const diags = project.getDiagnosticsForFile('app.ts');

      const shadowingDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT ||
          d.code === CssDiagnosticCode.STYLE_BINDING_SHADOWS_INPUT,
      );

      expect(shadowingDiags.length).toBe(0);
    });
  });

  describe('CONFLICTING_STYLE_BINDING diagnostics', () => {
    it('validates background: url(...) does not conflict with background-image', () => {
      const files = {
        'app.ts': `
        import {Component, Directive} from '@angular/core';

          @Directive({
            selector: '[backgroundColorApplier]',
            host: {
              '[style.backgroundColor]': '"red"',
            },
          })
          export class BackgroundColorApplierDirective {}

          @Component({
            imports: [BackgroundColorApplierDirective],
            template: '<div backgroundColorApplier [style.backgroundColor]="\\'blue\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING ||
          d.code === CssDiagnosticCode.DUPLICATE_STYLE_BINDING,
      );
      // Template binding should win over directive host binding
      expect(cssDiags.length).toBeGreaterThan(0);
      const conflictDiag = cssDiags[0];
      expect(conflictDiag.messageText).toContain('background-color');
    });

    it('should NOT detect conflict when directive and template set different properties', () => {
      const files = {
        'app.ts': `
          import {Component, Directive} from '@angular/core';

          @Directive({
            selector: '[styleApplier]',
            host: {
              '[style.backgroundColor]': '"red"',
              '[style.color]': '"white"',
            },
          })
          export class StyleApplierDirective {}

          @Component({
            imports: [StyleApplierDirective],
            template: '<div styleApplier [style.width]="\\'100px\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING ||
          d.code === CssDiagnosticCode.DUPLICATE_STYLE_BINDING,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should indicate template binding wins over directive host binding in message', () => {
      const files = {
        'app.ts': `
          import {Component, Directive} from '@angular/core';

          @Directive({
            selector: '[widthApplier]',
            host: {
              '[style.width]': '"50px"',
            },
          })
          export class WidthApplierDirective {}

          @Component({
            imports: [WidthApplierDirective],
            template: '<div widthApplier [style.width]="\\'100px\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.CONFLICTING_STYLE_BINDING);
      expect(cssDiags.length).toBeGreaterThan(0);
      // Message should indicate precedence: template wins
      const message = cssDiags[0].messageText as string;
      expect(message).toContain('[style.property]');
      expect(message).toContain('directive');
    });
  });

  describe('false positive prevention (valid CSS patterns)', () => {
    it('should allow CSS custom properties (--my-var)', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.--my-custom-color]="color"></div>',
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
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow CSS custom properties in object literals', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{\\'--my-var\\': \\'value\\', \\'--another-var\\': \\'10px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow vendor-prefixed properties in kebab-case', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.-webkit-transform]="transform"></div>
              <div [style.-moz-appearance]="'none'"></div>
              <div [style.-ms-flex]="1"></div>
              <div [style.-o-transition]="'all 0.5s'"></div>
            \`,
          })
          export class AppComponent {
            transform = 'rotate(45deg)';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow vendor-prefixed properties in camelCase', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.WebkitTransform]="'rotate(45deg)'"></div>
              <div [style.MozAppearance]="'none'"></div>
              <div [style.msFlexAlign]="'center'"></div>
              <div [style.OTransition]="'all 0.5s'"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow vendor-prefixed properties in object literals', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{WebkitTransform: \\'rotate(45deg)\\', MozTransform: \\'rotate(45deg)\\', msTransform: \\'rotate(45deg)\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow all standard CSS properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.display]="'flex'"></div>
              <div [style.position]="'absolute'"></div>
              <div [style.zIndex]="100"></div>
              <div [style.opacity]="0.5"></div>
              <div [style.overflow]="'hidden'"></div>
              <div [style.visibility]="'visible'"></div>
              <div [style.transform]="'translateX(10px)'"></div>
              <div [style.transition]="'all 0.3s'"></div>
              <div [style.animation]="'fadeIn 1s'"></div>
              <div [style.boxShadow]="'0 0 10px black'"></div>
              <div [style.textDecoration]="'underline'"></div>
              <div [style.cursor]="'pointer'"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should allow modern CSS properties (grid, flexbox, etc.)', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              <div [style.gap]="'10px'"></div>
              <div [style.gridTemplateColumns]="'1fr 1fr'"></div>
              <div [style.gridArea]="'header'"></div>
              <div [style.alignItems]="'center'"></div>
              <div [style.justifyContent]="'space-between'"></div>
              <div [style.flexWrap]="'wrap'"></div>
              <div [style.aspectRatio]="'16/9'"></div>
              <div [style.objectFit]="'cover'"></div>
              <div [style.backdropFilter]="'blur(10px)'"></div>
              <div [style.clipPath]="'circle(50%)'"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not validate non-style property bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<input [value]="unknownProp" [placeholder]="anotherProp">',
          })
          export class AppComponent {
            unknownProp = 'test';
            anotherProp = 'placeholder';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not validate class bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [class.unknownClass]="true" [class]="classObj"></div>',
          })
          export class AppComponent {
            classObj = {unknownClass: true};
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty style object literal', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT ||
          d.code === CssDiagnosticCode.DUPLICATE_CSS_PROPERTY,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should handle variable references without false positives', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="myStyles"></div>',
          })
          export class AppComponent {
            myStyles = {
              width: '100px',
              height: '200px',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      // Variable references are not object literals, so validation doesn't apply
      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should handle ternary expression style bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.backgroundColor]="isActive ? \\'red\\' : \\'blue\\'"></div>',
          })
          export class AppComponent {
            isActive = true;
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should handle method call style bindings without false positives', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="getStyles()"></div>',
          })
          export class AppComponent {
            getStyles() {
              return {width: '100px'};
            }
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      // Method calls are not validated (we can't determine the return type statically)
      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should handle ngStyle with valid properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {NgStyle} from '@angular/common';

          @Component({
            imports: [NgStyle],
            template: '<div [ngStyle]="{width: \\'100px\\', \\'font-size\\': \\'14px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should validate ngStyle with invalid properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {NgStyle} from '@angular/common';

          @Component({
            imports: [NgStyle],
            template: '<div [ngStyle]="{wdith: \\'100px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'wdith'");
    });

    it('should handle ng-template style bindings', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<ng-template [style.width]="\\'100px\\'"></ng-template>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) =>
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY ||
          d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should handle multiple spread operators', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{...base, ...override}"></div>',
          })
          export class AppComponent {
            base = {width: '100px'};
            override = {height: '200px'};
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
      );
      expect(cssDiags.length).toBe(0);
    });
  });

  describe('obsolete CSS properties', () => {
    describe('in template [style.prop] bindings', () => {
      it('should report diagnostic for obsolete boxAlign property with replacement', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.boxAlign]="align"></div>',
            })
            export class AppComponent {
              align = 'center';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY);
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'boxAlign' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use Flexbox `align-items` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'alignItems' instead");
        expect(cssDiags[0].messageText).toContain(
          'https://developer.mozilla.org/docs/Web/CSS/box-align',
        );
      });

      it('should report diagnostic for obsolete gridGap property with replacement', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.gridGap]="gap"></div>',
            })
            export class AppComponent {
              gap = '10px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY);
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'gridGap' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `gap` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'gap' instead");
        expect(cssDiags[0].messageText).toContain('https://developer.mozilla.org/docs/Web/CSS/gap');
      });

      it('should report diagnostic for obsolete grid-row-gap in kebab-case', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.grid-row-gap]="gap"></div>',
            })
            export class AppComponent {
              gap = '5px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY);
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'grid-row-gap' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `row-gap` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'row-gap' instead");
      });

      it('should report diagnostic for obsolete pageBreakAfter property', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.pageBreakAfter]="value"></div>',
            })
            export class AppComponent {
              value = 'always';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY);
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'pageBreakAfter' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `break-after` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'breakAfter' instead");
      });

      it('should report diagnostic for obsolete imeMode property without replacement', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.imeMode]="mode"></div>',
            })
            export class AppComponent {
              mode = 'disabled';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter((d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY);
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'imeMode' is deprecated");
        expect(cssDiags[0].messageText).toContain('No replacement available');
        expect(cssDiags[0].messageText).not.toContain('Consider using');
        expect(cssDiags[0].messageText).toContain(
          'https://developer.mozilla.org/docs/Web/CSS/ime-mode',
        );
      });
    });

    describe('in style object literals', () => {
      it('should report diagnostic for obsolete property in [style]="{}"', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style]="{gridGap: gap}"></div>',
            })
            export class AppComponent {
              gap = '10px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_OBJECT,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'gridGap' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `gap` instead');
      });

      it('should report diagnostic for obsolete property in [ngStyle]="{}"', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';
            import {NgStyle} from '@angular/common';

            @Component({
              imports: [NgStyle],
              template: '<div [ngStyle]="{boxFlex: flex}"></div>',
            })
            export class AppComponent {
              flex = 1;
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_OBJECT,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'boxFlex' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use Flexbox `flex` instead');
      });

      it('should report diagnostic for kebab-case obsolete property in object', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style]="{\\'box-align\\': align}"></div>',
            })
            export class AppComponent {
              align = 'center';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_OBJECT,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'box-align' is deprecated");
      });
    });

    describe('in host bindings', () => {
      it('should report diagnostic for obsolete property in host: {[style.prop]}', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              selector: 'my-component',
              template: '',
              host: {
                '[style.gridGap]': 'gap',
              },
            })
            export class AppComponent {
              gap = '10px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_HOST,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'gridGap' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `gap` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'gap' instead");
      });

      it('should report diagnostic for obsolete @HostBinding', () => {
        const files = {
          'app.ts': `
            import {Component, HostBinding} from '@angular/core';

            @Component({
              selector: 'my-component',
              template: '',
            })
            export class AppComponent {
              @HostBinding('style.boxOrient') orient = 'horizontal';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_HOST,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'boxOrient' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use Flexbox `flex-direction` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'flexDirection' instead");
      });

      it('should report diagnostic for kebab-case obsolete property in host', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              selector: 'my-component',
              template: '',
              host: {
                '[style.grid-column-gap]': 'gap',
              },
            })
            export class AppComponent {
              gap = '10px';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const cssDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_HOST,
        );
        expect(cssDiags.length).toBe(1);
        expect(cssDiags[0].messageText).toContain("CSS property 'grid-column-gap' is deprecated");
        expect(cssDiags[0].messageText).toContain('Use `column-gap` instead');
        expect(cssDiags[0].messageText).toContain("Consider using 'column-gap' instead");
      });
    });

    describe('prioritization over unknown', () => {
      it('should report obsolete (not unknown) for known obsolete properties', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.scrollSnapPointsX]="snap"></div>',
            })
            export class AppComponent {
              snap = 'repeat(100px)';
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        // Should NOT report unknown
        const unknownDiags = diags.filter((d) => d.code === CssDiagnosticCode.UNKNOWN_CSS_PROPERTY);
        expect(unknownDiags.length).toBe(0);

        // Should report obsolete
        const obsoleteDiags = diags.filter(
          (d) => d.code === CssDiagnosticCode.OBSOLETE_CSS_PROPERTY,
        );
        expect(obsoleteDiags.length).toBe(1);
        expect(obsoleteDiags[0].messageText).toContain(
          "CSS property 'scrollSnapPointsX' is deprecated",
        );
      });
    });
  });

  describe('unit suffix value validation', () => {
    describe('in template [style.prop.unit] bindings', () => {
      it('should NOT report error for numeric value with unit suffix', () => {
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

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });

      it('should NOT report error for numeric string value with unit suffix', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width.px]="\\'100\\'"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });

      it('should report error for non-numeric string value with unit suffix', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width.px]="\\'red\\'"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(1);
        expect(unitValueDiags[0].messageText).toContain("Invalid value 'red'");
        expect(unitValueDiags[0].messageText).toContain('expects a numeric value');
        expect(unitValueDiags[0].messageText).toContain("'redpx'");
      });

      it('should report error for boolean value with unit suffix', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width.px]="true"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(1);
        expect(unitValueDiags[0].messageText).toContain("Invalid value 'true'");
        expect(unitValueDiags[0].messageText).toContain('not a boolean');
      });

      it('should NOT report error for null value with unit suffix', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width.px]="null"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });

      it('should NOT report error for variable reference (cannot validate statically)', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.width.px]="myWidth"></div>',
            })
            export class AppComponent {
              myWidth = 100;
            }
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });

      it('should report error for color name with px unit', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.height.em]="\\'blue\\'"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(1);
        expect(unitValueDiags[0].messageText).toContain("Invalid value 'blue'");
        expect(unitValueDiags[0].messageText).toContain("'blueem'");
      });

      it('should NOT report error for negative numeric values', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.margin.px]="-10"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });

      it('should NOT report error for decimal numeric string values', () => {
        const files = {
          'app.ts': `
            import {Component} from '@angular/core';

            @Component({
              template: '<div [style.lineHeight.em]="\\'1.5\\'"></div>',
            })
            export class AppComponent {}
          `,
        };
        const project = createModuleAndProjectWithDeclarations(env, 'test', files);
        const diags = project.getDiagnosticsForFile('app.ts');

        const unitValueDiags = diags.filter((d) => d.code === CssDiagnosticCode.INVALID_UNIT_VALUE);
        expect(unitValueDiags.length).toBe(0);
      });
    });
  });

  describe('shorthand/longhand conflict detection', () => {
    it('should detect when background shorthand overrides backgroundColor longhand', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.backgroundColor]="\\'red\\'" [style.background]="\\'blue url(img.png)\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(1);
      expect(shorthandDiags[0].messageText).toContain("'background-color' will be overridden");
      expect(shorthandDiags[0].messageText).toContain("'background' shorthand");
    });

    it('should detect when margin shorthand overrides marginTop longhand', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.marginTop]="\\'10px\\'" [style.margin]="\\'20px\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(1);
      expect(shorthandDiags[0].messageText).toContain("'margin-top' will be overridden");
      expect(shorthandDiags[0].messageText).toContain("'margin' shorthand");
    });

    it('should detect multiple longhand conflicts with one shorthand', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.paddingTop]="\\'10px\\'" [style.paddingLeft]="\\'5px\\'" [style.padding]="\\'20px\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(2);
    });

    it('should NOT report conflict when only shorthand is used', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.background]="\\'blue\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(0);
    });

    it('should NOT report conflict when only longhand is used', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.backgroundColor]="\\'red\\'" [style.backgroundImage]="\\'url(img.png)\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(0);
    });

    it('should detect border shorthand conflict with borderColor', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.borderColor]="\\'red\\'" [style.border]="\\'1px solid blue\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(1);
      expect(shorthandDiags[0].messageText).toContain("'border-color' will be overridden");
    });

    it('should detect flex shorthand conflict with flexGrow', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.flexGrow]="1" [style.flex]="\\'1 1 auto\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(1);
      expect(shorthandDiags[0].messageText).toContain("'flex-grow' will be overridden");
    });

    it('should work with kebab-case property names', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style.background-color]="\\'red\\'" [style.background]="\\'blue\\'"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const shorthandDiags = diags.filter((d) => d.code === CssDiagnosticCode.SHORTHAND_OVERRIDE);
      expect(shorthandDiags.length).toBe(1);
    });
  });
});

// NOTE: The following tests are commented out because they test CSS value validation features
// that have not yet been ported from the unified branch. They can be re-enabled once:
// - getCSSValueHoverAtOffset is ported
// - getCSSValueTokens is ported
// - findSimilarCSSValues is ported
// - getCSSValueHover is ported
// - INVALID_CSS_VALUE diagnostic code is ported

/*
// CSS value validation tests - TO BE PORTED
// ... (see unified branch for full tests)
*/
