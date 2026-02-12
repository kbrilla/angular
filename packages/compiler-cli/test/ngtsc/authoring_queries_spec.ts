/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';

import {runInEachFileSystem} from '../../src/ngtsc/file_system/testing';
import {loadStandardTestFiles} from '../../src/ngtsc/testing';

import {NgtscTestEnvironment} from './env';

const testFiles = loadStandardTestFiles();

runInEachFileSystem(() => {
  describe('signal-based queries', () => {
    let env!: NgtscTestEnvironment;

    beforeEach(() => {
      env = NgtscTestEnvironment.setup(testFiles);
      env.tsconfig({strictTemplates: true});
    });

    it('should handle a basic viewChild', () => {
      env.write(
        'test.ts',
        `
        import {Component, viewChild} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChild('myLocator');
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵviewQuerySignal(ctx.el, _c0, 5);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should support viewChild with `read` options', () => {
      env.write('other-file.ts', `export class X {}`);
      env.write(
        'test.ts',
        `
        import {Component, viewChild} from '@angular/core';
        import * as fromOtherFile from './other-file';

        class X {}

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChild('myLocator', {read: X});
          el2 = viewChild('myLocator', {read: fromOtherFile.X});
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(
        `i0.ɵɵviewQuerySignal(ctx.el, _c0, 5, X)(ctx.el2, _c0, 5, fromOtherFile.X);`,
      );
      expect(js).toContain(`i0.ɵɵqueryAdvance(2);`);
    });

    it('should support viewChild with `read` pointing to an expression with a generic', () => {
      env.write(
        'test.ts',
        `
        import {Component, viewChild, ElementRef} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChild('myLocator', {read: ElementRef<HTMLElement>});
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵviewQuerySignal(ctx.el, _c0, 5, ElementRef);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should support viewChild with `read` pointing to a parenthesized expression', () => {
      env.write(
        'test.ts',
        `
        import {Component, viewChild, ElementRef} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChild('myLocator', {read: ((((ElementRef))))});
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵviewQuerySignal(ctx.el, _c0, 5, ElementRef);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should support viewChild with `read` pointing to an `as` expression', () => {
      env.write(
        'test.ts',
        `
        import {Component, viewChild, ElementRef} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChild('myLocator', {read: ElementRef as any});
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵviewQuerySignal(ctx.el, _c0, 5, ElementRef);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should handle a basic viewChildren', () => {
      env.write(
        'test.ts',
        `
        import {Component, viewChildren} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = viewChildren('myLocator');
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵviewQuerySignal(ctx.el, _c0, 5);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should handle a basic contentChild', () => {
      env.write(
        'test.ts',
        `
        import {Component, contentChild} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = contentChild('myLocator');
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵcontentQuerySignal(dirIndex, ctx.el, _c0, 5);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    it('should handle a basic contentChildren', () => {
      env.write(
        'test.ts',
        `
        import {Component, contentChildren} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          el = contentChildren('myLocator');
        }
      `,
      );
      env.driveMain();

      const js = env.getContents('test.js');
      expect(js).toContain(`i0.ɵɵcontentQuerySignal(dirIndex, ctx.el, _c0, 4);`);
      expect(js).toContain(`i0.ɵɵqueryAdvance();`);
    });

    describe('diagnostics', () => {
      it('should report an error when used with query decorator', () => {
        env.write(
          'test.ts',
          `
        import {Component, viewChild, ViewChild} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          @ViewChild('myLocator') el = viewChild('myLocator');
        }
      `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Using @ViewChild with a signal-based query is not allowed.`,
          }),
        ]);
      });

      it('should report an error when used on a static field', () => {
        env.write(
          'test.ts',
          `
        import {Component, viewChild} from '@angular/core';

        @Component({selector: 'test', template: ''})
        export class TestDir {
          static el = viewChild('myLocator');
        }
      `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Query is incorrectly declared on a static class member.`,
          }),
        ]);
      });

      it('should report an error when declared in @Directive metadata', () => {
        env.write(
          'test.ts',
          `
        import {Directive, ViewChild, viewChild} from '@angular/core';

        @Directive({
          selector: 'test',
          queries: {
            el: new ViewChild('myLocator'),
          },
        })
        export class TestDir {
          el = viewChild('myLocator');
        }
      `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Query is declared multiple times. "@Directive" declares a query for the same property.`,
          }),
        ]);
      });

      it('should report an error when declared in @Component metadata', () => {
        env.write(
          'test.ts',
          `
        import {Component, ViewChild, viewChild} from '@angular/core';

        @Component({
          selector: 'test',
          template: '',
          queries: {
            el: new ViewChild('myLocator'),
          },
        })
        export class TestComp {
          el = viewChild('myLocator');
        }
      `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Query is declared multiple times. "@Component" declares a query for the same property.`,
          }),
        ]);
      });

      it('should report an error when a signal-based query function is used in metadata', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '',
            queries: {
              // @ts-ignore
              el: new viewChild('myLocator'),
            },
          })
          export class TestComp {}
        `,
        );

        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Decorator query metadata must be an instance of a query type`,
          }),
        ]);
      });

      it('should report an error when `read` option is complex', () => {
        env.write(
          'test.ts',
          `
          import {Directive, viewChild} from '@angular/core';

          @Directive({
            selector: 'test',
          })
          export class TestDir {
            something = null!;
            el = viewChild('myLocator', {read: this.something});
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining({
            messageText: `Query "read" option expected a literal class reference.`,
          }),
        ]);
      });

      it('should error when a query is declared using an ES private field', () => {
        env.write(
          'test.ts',
          `
          import {Directive, viewChild} from '@angular/core';

          @Directive({
            selector: 'test',
          })
          export class TestDir {
            #el = viewChild('myLocator');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics).toEqual([
          jasmine.objectContaining<ts.Diagnostic>({
            messageText: jasmine.objectContaining<ts.DiagnosticMessageChain>({
              messageText: `Cannot use "viewChild" on a class member that is declared as ES private.`,
            }),
          }),
        ]);
      });

      it('should allow query is declared on a `private` field', () => {
        env.write(
          'test.ts',
          `
          import {Directive, viewChild} from '@angular/core';

          @Directive({
            selector: 'test',
          })
          export class TestDir {
            private el = viewChild('myLocator');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should allow query is declared on a `protected` field', () => {
        env.write(
          'test.ts',
          `
          import {Directive, viewChild} from '@angular/core';

          @Directive({
            selector: 'test',
          })
          export class TestDir {
            protected el = viewChild('myLocator');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should report an error when a required viewChild targets a non-existent template ref', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div>no refs here</div>',
          })
          export class TestComp {
            el = viewChild.required('missing');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`Required view query 'el'`);
        expect(diagnostics[0].messageText).toContain(`'missing'`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      it('should not report for optional viewChild targeting a non-existent template ref', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div>no refs here</div>',
          })
          export class TestComp {
            el = viewChild('missing');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report when viewChild matches an existing template ref', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div #myRef></div>',
          })
          export class TestComp {
            el = viewChild.required('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report when viewChild matches a ref inside @if block', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@if (true) { <div #myRef></div> }',
          })
          export class TestComp {
            el = viewChild('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report when viewChild matches a ref inside @for block', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@for (item of [1]; track item) { <div #myRef></div> }',
          })
          export class TestComp {
            el = viewChild('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report for viewChild with type predicate', () => {
        env.write(
          'test.ts',
          `
          import {Component, ElementRef, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div></div>',
          })
          export class TestComp {
            el = viewChild(ElementRef);
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report for viewChildren with non-existent template ref', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChildren} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div>no refs</div>',
          })
          export class TestComp {
            els = viewChildren('missing');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      // Phase 2: read:TemplateRef mismatch detection
      it('should report error for viewChild with read:TemplateRef on a non-template element', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild, TemplateRef} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div #myDiv>hello</div>',
          })
          export class TestComp {
            tpl = viewChild.required('myDiv', {read: TemplateRef});
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`TemplateRef`);
        expect(diagnostics[0].messageText).toContain(`#myDiv`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      it('should not report for viewChild with read:TemplateRef on ng-template', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild, TemplateRef} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<ng-template #myTpl>content</ng-template>',
          })
          export class TestComp {
            tpl = viewChild.required('myTpl', {read: TemplateRef});
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not report for viewChild with read:ElementRef on a div', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild, ElementRef} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div #myDiv>hello</div>',
          })
          export class TestComp {
            el = viewChild.required('myDiv', {read: ElementRef});
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should report error for decorator @ViewChild with read:TemplateRef on non-template', () => {
        env.write(
          'test.ts',
          `
          import {Component, ViewChild, TemplateRef} from '@angular/core';

          @Component({
            selector: 'test',
            standalone: false,
            template: '<div #myDiv>hello</div>',
          })
          export class TestComp {
            @ViewChild('myDiv', {read: TemplateRef}) tpl: any;
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`TemplateRef`);
        expect(diagnostics[0].messageText).toContain(`#myDiv`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      // Phase 4: Conditional availability warnings for required queries
      it('should warn when required viewChild targets a ref only inside @if block', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@if (cond) { <div #myRef></div> }',
          })
          export class TestComp {
            cond = true;
            el = viewChild.required('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`#myRef`);
        expect(diagnostics[0].messageText).toContain(`conditional`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      it('should warn when required viewChild targets a ref only inside @switch/@case', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@switch (val) { @case ("a") { <div #myRef></div> } }',
          })
          export class TestComp {
            val = 'a';
            el = viewChild.required('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`#myRef`);
        expect(diagnostics[0].messageText).toContain(`conditional`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      it('should warn when required viewChild targets a ref only inside @defer', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@defer { <div #myRef></div> }',
          })
          export class TestComp {
            el = viewChild.required('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].messageText).toContain(`#myRef`);
        expect(diagnostics[0].messageText).toContain(`conditional`);
        expect(diagnostics[0].category).toBe(ts.DiagnosticCategory.Error);
      });

      it('should not warn when ref exists both inside and outside @if block', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '<div #myRef></div> @if (cond) { <span #myRef></span> }',
          })
          export class TestComp {
            cond = true;
            el = viewChild.required('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should not warn for optional viewChild targeting a conditional ref', () => {
        env.write(
          'test.ts',
          `
          import {Component, viewChild} from '@angular/core';

          @Component({
            selector: 'test',
            template: '@if (cond) { <div #myRef></div> }',
          })
          export class TestComp {
            cond = true;
            el = viewChild('myRef');
          }
        `,
        );
        const diagnostics = env.driveDiagnostics();
        expect(diagnostics.length).toBe(0);
      });

      it('should capture a viewChild query in the setClasMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, viewChild} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = viewChild('myLocator');
            }
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(`i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ViewChild, args: ['myLocator', { isSignal: true }] }] });`);
      });

      it('should capture a viewChildren query in the setClasMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, viewChildren} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = viewChildren('myLocator');
            }
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(`i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ViewChildren, args: ['myLocator', { isSignal: true }] }] });`);
      });

      it('should capture a contentChild query in the setClasMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, contentChild} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = contentChild('myLocator');
            }
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(`i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ContentChild, args: ['myLocator', { isSignal: true }] }] });`);
      });

      it('should capture a contentChildren query in the setClasMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, contentChildren} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = contentChildren('myLocator');
            }
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(`i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ContentChildren, args: ['myLocator', { isSignal: true }] }] });`);
      });

      it('should capture a query with options in a setClassMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, viewChild, ElementRef} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = viewChild('myLocator', {read: ElementRef});
            }
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(
          `i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ViewChild, ` +
            `args: ['myLocator', Object.assign({ read: ElementRef }, { isSignal: true })] }] });`,
        );
      });

      it('should wrap reference in query as a forwardRef in the setClassMetadata call', () => {
        env.write(
          'test.ts',
          `
            import {Component, Directive, viewChild} from '@angular/core';

            @Component({selector: 'test', template: ''})
            export class TestDir {
              el = viewChild(Dep);
            }

            @Directive({selector: '[dep]'})
            export class Dep {}
          `,
        );
        env.driveMain();

        const js = env.getContents('test.js');
        expect(js).toContain('import * as i0 from "@angular/core";');
        expect(js).toContain(
          `i0.ɵsetClassMetadata(TestDir, [{
        type: Component,
        args: [{ selector: 'test', template: '' }]
    }], null, { el: [{ type: i0.ViewChild, args: [i0.forwardRef(() => Dep), { isSignal: true }] }] });`,
        );
      });
    });
  });
});
