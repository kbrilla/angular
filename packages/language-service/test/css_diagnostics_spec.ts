/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {initMockFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system/testing';
import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import ts from 'typescript';

import {createModuleAndProjectWithDeclarations, LanguageServiceTestEnv} from '../testing';

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
          d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY) ||
          d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT),
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
          d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY) ||
          d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT),
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
          d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY) ||
          d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT),
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
          d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY) ||
          d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT),
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT));
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

      const cssDiags = diags.filter((d) => d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT));
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS unit 'pxs'");
    });
  });

  describe('style object binding validation', () => {
    it('should not report diagnostic for valid properties in [style] object', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{backgroundColor: \\'red\\', width: \\'100px\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic for unknown property in [style] object', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{backgrond: \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'backgrond'");
      expect(cssDiags[0].messageText).toContain("Did you mean 'background'");
    });

    it('should report diagnostics for multiple unknown properties in [style] object', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{backgrond: \\'red\\', colr: \\'blue\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(2);
    });

    it('should not report diagnostic for valid kebab-case properties in [ngStyle]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {CommonModule} from '@angular/common';

          @Component({
            imports: [CommonModule],
            template: '<div [ngStyle]="{\\'background-color\\': \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic for unknown kebab-case property in [ngStyle]', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';
          import {CommonModule} from '@angular/common';

          @Component({
            imports: [CommonModule],
            template: '<div [ngStyle]="{\\'backgrond-color\\': \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS property 'backgrond-color'");
    });

    it('should not report diagnostic for CSS custom properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{\\'--my-custom-var\\': \\'red\\'}"></div>',
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(0);
    });
  });

  describe('style variable reference validation', () => {
    it('should report diagnostic when @let variable contains unknown CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: \`
              @let styleConst = { 'backgroundColor': 'blue', 'backgroudnColor': 'red' };
              <div [style]="styleConst"></div>
            \`,
          })
          export class AppComponent {}
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      // One diagnostic for the literal object, one for the variable reference
      expect(cssDiags.length).toBeGreaterThanOrEqual(1);
      expect(cssDiags.some((d) => (d.messageText as string).includes('backgroudnColor'))).toBe(
        true,
      );
    });

    it('should report diagnostic when component property contains unknown CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="myStyles"></div>',
          })
          export class AppComponent {
            myStyles = {
              backgroundColor: 'blue',
              backgroudnColor: 'red',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('backgroudnColor');
    });

    it('should not report diagnostic when component property contains valid CSS properties', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="myStyles"></div>',
          })
          export class AppComponent {
            myStyles = {
              backgroundColor: 'blue',
              color: 'red',
              width: '100px',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic when spread object contains unknown CSS property', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="{...myStyles}"></div>',
          })
          export class AppComponent {
            myStyles = {
              backgroudnColor: 'red',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain('backgroudnColor');
    });

    it('should report multiple unknown properties in variable reference', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '<div [style]="myStyles"></div>',
          })
          export class AppComponent {
            myStyles = {
              backgroudnColor: 'red',
              colr: 'blue',
              widht: '100px',
            };
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT),
      );
      expect(cssDiags.length).toBe(1);
      // Message should contain all invalid properties
      expect(cssDiags[0].messageText).toContain('backgroudnColor');
      expect(cssDiags[0].messageText).toContain('colr');
      expect(cssDiags[0].messageText).toContain('widht');
    });
  });

  describe('host binding CSS validation', () => {
    it('should not report diagnostic for valid CSS property in host binding', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '',
          })
          export class AppComponent {
            @HostBinding('style.width') hostWidth = '100px';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should not report diagnostic for valid CSS property in host metadata', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '',
            host: {
              '[style.backgroundColor]': 'color',
            },
          })
          export class AppComponent {
            color = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should report diagnostic for unknown CSS property in @HostBinding', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '',
          })
          export class AppComponent {
            @HostBinding('style.backgroudColor') hostColor = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain(
        "Unknown CSS property 'backgroudColor' in host binding",
      );
      expect(cssDiags[0].messageText).toContain("Did you mean 'backgroundColor'?");
    });

    it('should report diagnostic for unknown CSS property in host metadata', () => {
      const files = {
        'app.ts': `
          import {Component} from '@angular/core';

          @Component({
            template: '',
            host: {
              '[style.backgroudColor]': 'color',
            },
          })
          export class AppComponent {
            color = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain(
        "Unknown CSS property 'backgroudColor' in host binding",
      );
    });

    it('should report diagnostic for invalid CSS unit in @HostBinding', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '',
          })
          export class AppComponent {
            @HostBinding('style.width.xyz') hostWidth = 100;
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.INVALID_CSS_UNIT_IN_HOST),
      );
      expect(cssDiags.length).toBe(1);
      expect(cssDiags[0].messageText).toContain("Unknown CSS unit 'xyz' in host binding");
    });

    it('should not report diagnostic for CSS custom properties in host binding', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '',
          })
          export class AppComponent {
            @HostBinding('style.--my-custom-var') customVar = 'red';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const cssDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );
      expect(cssDiags.length).toBe(0);
    });

    it('should validate both template and host bindings in the same component', () => {
      const files = {
        'app.ts': `
          import {Component, HostBinding} from '@angular/core';

          @Component({
            template: '<div [style.backgroudColor]="color"></div>',
          })
          export class AppComponent {
            color = 'red';
            @HostBinding('style.dipslay') hostDisplay = 'block';
          }
        `,
      };
      const project = createModuleAndProjectWithDeclarations(env, 'test', files);
      const diags = project.getDiagnosticsForFile('app.ts');

      const templateDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY),
      );
      const hostDiags = diags.filter(
        (d) => d.code === ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
      );

      expect(templateDiags.length).toBe(1);
      expect(templateDiags[0].messageText).toContain('backgroudColor');

      expect(hostDiags.length).toBe(1);
      expect(hostDiags[0].messageText).toContain('dipslay');
    });
  });

  // TODO: Configuration tests require updating the testing infrastructure to support
  // PluginConfig options (cssPropertyValidation). Currently, the test environment
  // always uses default config. Configuration tests should be added in a follow-up PR.
});
