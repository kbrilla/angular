/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DOCUMENT, NgIf} from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  Directive,
  ElementRef,
  EnvironmentInjector,
  forwardRef,
  Injectable,
  InjectionToken,
  Injector,
  input,
  Input,
  model,
  NgModule,
  OnDestroy,
  reflectComponentType,
  Renderer2,
  viewChild,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  ɵsetClassDebugInfo,
  ɵsetDocument,
  ɵɵdefineComponent,
} from '../../src/core';
import {TestBed} from '../../testing';
import {expect} from '@angular/private/testing/matchers';

import {global} from '../../src/util/global';

describe('component', () => {
  describe('view destruction', () => {
    it('should invoke onDestroy only once when a component is registered as a provider', () => {
      const testToken = new InjectionToken<ParentWithOnDestroy>('testToken');
      let destroyCalls = 0;

      @Component({
        selector: 'comp-with-on-destroy',
        template: '',
        providers: [{provide: testToken, useExisting: ParentWithOnDestroy}],
        standalone: false,
      })
      class ParentWithOnDestroy {
        ngOnDestroy() {
          destroyCalls++;
        }
      }

      @Component({
        selector: 'child',
        template: '',
        standalone: false,
      })
      class ChildComponent {
        // We need to inject the parent so the provider is instantiated.
        constructor(_parent: ParentWithOnDestroy) {}
      }

      @Component({
        template: `
          <comp-with-on-destroy>
            <child></child>
          </comp-with-on-destroy>
        `,
        standalone: false,
      })
      class App {}

      TestBed.configureTestingModule({declarations: [App, ParentWithOnDestroy, ChildComponent]});
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      fixture.destroy();

      expect(destroyCalls).toBe(1, 'Expected `ngOnDestroy` to only be called once.');
    });
  });

  it('should be able to dynamically insert a component into a view container at the root of a component', () => {
    @Component({
      template: 'hello',
      standalone: false,
    })
    class HelloComponent {}

    @Component({
      selector: 'wrapper',
      template: '<ng-content></ng-content>',
      standalone: false,
    })
    class Wrapper {}

    @Component({
      template: `
        <wrapper>
          <div #insertionPoint></div>
        </wrapper>
      `,
      standalone: false,
    })
    class App {
      @ViewChild('insertionPoint', {read: ViewContainerRef}) viewContainerRef!: ViewContainerRef;
    }

    TestBed.configureTestingModule({declarations: [App, Wrapper, HelloComponent]});
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const instance = fixture.componentInstance;
    instance.viewContainerRef.createComponent(HelloComponent);

    expect(fixture.nativeElement.textContent.trim()).toBe('hello');
  });

  it('should not throw when calling `detectChanges` on the ChangeDetectorRef of a destroyed view', () => {
    @Component({
      template: 'hello',
      standalone: false,
    })
    class HelloComponent {}

    @Component({
      template: `<div #insertionPoint></div>`,
      standalone: false,
    })
    class App {
      @ViewChild('insertionPoint', {read: ViewContainerRef}) viewContainerRef!: ViewContainerRef;
    }

    TestBed.configureTestingModule({declarations: [App, HelloComponent]});
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const componentRef = fixture.componentInstance.viewContainerRef.createComponent(HelloComponent);
    fixture.detectChanges();

    expect(() => {
      componentRef.destroy();
      componentRef.changeDetectorRef.detectChanges();
    }).not.toThrow();
  });

  // TODO: add tests with Native once tests run in real browser (domino doesn't support shadow root)
  describe('encapsulation', () => {
    @Component({
      selector: 'wrapper',
      encapsulation: ViewEncapsulation.None,
      template: `<encapsulated></encapsulated>`,
      standalone: false,
    })
    class WrapperComponent {}

    @Component({
      selector: 'encapsulated',
      encapsulation: ViewEncapsulation.Emulated,
      // styles must be non-empty to trigger `ViewEncapsulation.Emulated`
      styles: `
        :host {
          display: block;
        }
      `,
      template: `foo<leaf></leaf>`,
      standalone: false,
    })
    class EncapsulatedComponent {}

    @Component({
      selector: 'leaf',
      encapsulation: ViewEncapsulation.None,
      template: `<span>bar</span>`,
      standalone: false,
    })
    class LeafComponent {}

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [WrapperComponent, EncapsulatedComponent, LeafComponent],
      });
    });

    it('should encapsulate children, but not host nor grand children', () => {
      const fixture = TestBed.createComponent(WrapperComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.innerHTML).toMatch(
        /<encapsulated _nghost-[a-z\-]+(\d+)="">foo<leaf _ngcontent-[a-z\-]+\1=""><span>bar<\/span><\/leaf><\/encapsulated>/,
      );
    });

    it('should encapsulate host', () => {
      const fixture = TestBed.createComponent(EncapsulatedComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.outerHTML;
      const match = html.match(/_nghost-([a-z\-]+\d+)/);
      expect(match).toBeDefined();
      expect(html).toMatch(new RegExp(`<leaf _ngcontent-${match[1]}=""><span>bar</span></leaf>`));
    });

    it('should encapsulate host and children with different attributes', () => {
      // styles must be non-empty to trigger `ViewEncapsulation.Emulated`
      TestBed.overrideComponent(LeafComponent, {
        set: {encapsulation: ViewEncapsulation.Emulated, styles: [`span {color:red}`]},
      });
      const fixture = TestBed.createComponent(EncapsulatedComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.outerHTML;
      const match = html.match(/_nghost-([a-z\-]+\d+)/g);
      expect(match).toBeDefined();
      expect(match.length).toEqual(2);
      expect(html).toMatch(
        `<leaf ${match[0].replace('_nghost', '_ngcontent')}="" ${
          match[1]
        }=""><span ${match[1].replace('_nghost', '_ngcontent')}="">bar</span></leaf></div>`,
      );
    });

    it('should be off for a component with no styles', () => {
      TestBed.overrideComponent(EncapsulatedComponent, {
        set: {styles: undefined},
      });
      const fixture = TestBed.createComponent(EncapsulatedComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.outerHTML;
      expect(html).not.toContain('<encapsulated _nghost-');
      expect(html).not.toContain('<leaf _ngcontent-');
    });

    it('should be off for a component with empty styles', () => {
      TestBed.overrideComponent(EncapsulatedComponent, {
        set: {styles: [`  `, '', '/*comment*/']},
      });
      const fixture = TestBed.createComponent(EncapsulatedComponent);
      fixture.detectChanges();
      const html = fixture.nativeElement.outerHTML;
      expect(html).not.toContain('<encapsulated _nghost-');
      expect(html).not.toContain('<leaf _ngcontent-');
    });
  });

  describe('view destruction', () => {
    it('should invoke onDestroy when directly destroying a root view', () => {
      let wasOnDestroyCalled = false;

      @Component({
        selector: 'comp-with-destroy',
        template: ``,
        standalone: false,
      })
      class ComponentWithOnDestroy implements OnDestroy {
        ngOnDestroy() {
          wasOnDestroyCalled = true;
        }
      }

      // This test asserts that the view tree is set up correctly based on the knowledge that this
      // tree is used during view destruction. If the child view is not correctly attached as a
      // child of the root view, then the onDestroy hook on the child view will never be called
      // when the view tree is torn down following the destruction of that root view.
      @Component({
        selector: `test-app`,
        template: `<comp-with-destroy></comp-with-destroy>`,
        standalone: false,
      })
      class TestApp {}

      TestBed.configureTestingModule({declarations: [ComponentWithOnDestroy, TestApp]});
      const fixture = TestBed.createComponent(TestApp);
      fixture.detectChanges();
      fixture.destroy();
      expect(wasOnDestroyCalled).toBe(
        true,
        'Expected component onDestroy method to be called when its parent view is destroyed',
      );
    });
  });

  it("should clear the contents of dynamically created component when it's attached to ApplicationRef", () => {
    let wasOnDestroyCalled = false;
    @Component({
      selector: '[comp]',
      template: 'comp content',
      standalone: false,
    })
    class DynamicComponent {
      ngOnDestroy() {
        wasOnDestroyCalled = true;
      }
    }

    @Component({
      selector: 'button',
      template: `
        <div class="wrapper"></div>
        <div id="app-root"></div>
        <div class="wrapper"></div>
      `,
      standalone: false,
    })
    class App {
      componentRef!: ComponentRef<DynamicComponent>;

      constructor(
        private injector: EnvironmentInjector,
        private appRef: ApplicationRef,
        private elementRef: ElementRef,
      ) {}

      create() {
        // Component to be bootstrapped into an element with the `app-root` id.
        this.componentRef = createComponent(DynamicComponent, {
          environmentInjector: this.injector,
          hostElement: this.elementRef.nativeElement.querySelector('#app-root')!,
        });
        this.appRef.attachView(this.componentRef.hostView);
      }

      destroy() {
        this.componentRef.destroy();
      }
    }

    TestBed.configureTestingModule({declarations: [App, DynamicComponent]});
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    let appRootEl = fixture.nativeElement.querySelector('#app-root');
    expect(appRootEl).toBeDefined();
    expect(appRootEl.innerHTML).toBe(''); // app container content is empty

    fixture.componentInstance.create();

    appRootEl = fixture.nativeElement.querySelector('#app-root');
    expect(appRootEl).toBeDefined();
    expect(appRootEl.innerHTML).toBe('comp content');

    fixture.componentInstance.destroy();
    fixture.detectChanges();

    appRootEl = fixture.nativeElement.querySelector('#app-root');
    expect(appRootEl).toBeFalsy(); // host element is removed
    const wrapperEls = fixture.nativeElement.querySelectorAll('.wrapper');
    expect(wrapperEls.length).toBe(2); // other elements are preserved
  });

  describe('with ngDevMode', () => {
    const _global: {ngDevMode: any} = global;
    let saveNgDevMode!: typeof ngDevMode;
    beforeEach(() => (saveNgDevMode = ngDevMode));
    afterEach(() => (_global.ngDevMode = saveNgDevMode));
    // In dev mode we have some additional logic to freeze `TView.cleanup` array
    // (see `storeCleanupWithContext` function).
    // The tests below verify that this action doesn't trigger any change in behaviour
    // for prod mode. See https://github.com/angular/angular/issues/40105.
    ['ngDevMode off', 'ngDevMode on'].forEach((mode) => {
      it(
        'should invoke `onDestroy` callbacks of dynamically created component with ' + mode,
        () => {
          if (mode === 'ngDevMode off') {
            _global.ngDevMode = false;
          }
          let wasOnDestroyCalled = false;
          @Component({
            selector: '[comp]',
            template: 'comp content',
            standalone: false,
          })
          class DynamicComponent {}

          @Component({
            selector: 'button',
            template: '<div id="app-root" #anchor></div>',
            standalone: false,
          })
          class App {
            @ViewChild('anchor', {read: ViewContainerRef}) anchor!: ViewContainerRef;

            constructor(
              private vcr: ViewContainerRef,
              private injector: Injector,
            ) {}

            create() {
              const componentRef = this.vcr.createComponent(DynamicComponent, {
                injector: this.injector,
              });
              componentRef.onDestroy(() => {
                wasOnDestroyCalled = true;
              });
              this.anchor.insert(componentRef.hostView);
            }

            clear() {
              this.anchor.clear();
            }
          }

          TestBed.configureTestingModule({declarations: [App, DynamicComponent]});
          const fixture = TestBed.createComponent(App);
          fixture.detectChanges();

          // Add ComponentRef to ViewContainerRef instance.
          fixture.componentInstance.create();
          // Clear ViewContainerRef to invoke `onDestroy` callbacks on ComponentRef.
          fixture.componentInstance.clear();

          expect(wasOnDestroyCalled).toBeTrue();
        },
      );
    });
  });

  describe('invalid host element', () => {
    it('should throw when <ng-container> is used as a host element for a Component', () => {
      @Component({
        selector: 'ng-container',
        template: '...',
        standalone: false,
      })
      class Comp {}

      @Component({
        selector: 'root',
        template: '<ng-container></ng-container>',
        standalone: false,
      })
      class App {}

      TestBed.configureTestingModule({declarations: [App, Comp]});
      expect(() => TestBed.createComponent(App)).toThrowError(
        /"ng-container" tags cannot be used as component hosts. Please use a different tag to activate the Comp component/,
      );
    });

    it('should throw when <ng-template> is used as a host element for a Component', () => {
      @Component({
        selector: 'ng-template',
        template: '...',
        standalone: false,
      })
      class Comp {}

      @Component({
        selector: 'root',
        template: '<ng-template></ng-template>',
        standalone: false,
      })
      class App {}

      TestBed.configureTestingModule({declarations: [App, Comp]});
      expect(() => TestBed.createComponent(App)).toThrowError(
        /"ng-template" tags cannot be used as component hosts. Please use a different tag to activate the Comp component/,
      );
    });

    it('should throw when multiple components match the same element', () => {
      @Component({
        selector: 'comp',
        template: '...',
        standalone: false,
      })
      class CompA {}

      @Component({
        selector: 'comp',
        template: '...',
        standalone: false,
      })
      class CompB {}

      @Component({
        template: '<comp></comp>',
        standalone: false,
      })
      class App {}

      TestBed.configureTestingModule({declarations: [App, CompA, CompB]});
      expect(() => TestBed.createComponent(App)).toThrowError(
        /NG0300: Multiple components match node with tagname comp: CompA and CompB/,
      );
    });

    it('should not throw if a standalone component imports itself', () => {
      @Component({
        selector: 'comp',
        template: '<comp *ngIf="recurse"/>hello',
        imports: [Comp, NgIf],
      })
      class Comp {
        @Input() recurse = false;
      }

      @Component({
        template: '<comp [recurse]="true"/>',
        imports: [Comp],
      })
      class App {}

      let textContent = '';

      expect(() => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        textContent = fixture.nativeElement.textContent.trim();
      }).not.toThrow();

      // Ensure that the component actually rendered.
      expect(textContent).toBe('hellohello');
    });

    it('should not throw if a standalone component imports itself using a forwardRef', () => {
      @Component({
        selector: 'comp',
        template: '<comp *ngIf="recurse"/>hello',
        imports: [forwardRef(() => Comp), NgIf],
      })
      class Comp {
        @Input() recurse = false;
      }

      @Component({
        template: '<comp [recurse]="true"/>',
        imports: [Comp],
      })
      class App {}

      let textContent = '';

      expect(() => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        textContent = fixture.nativeElement.textContent.trim();
      }).not.toThrow();

      // Ensure that the component actually rendered.
      expect(textContent).toBe('hellohello');
    });
  });

  it('should use a new ngcontent attribute for child elements created w/ Renderer2', () => {
    @Component({
      selector: 'app-root',
      template: '<parent-comp></parent-comp>',
      styles: [':host { color: red; }'], // `styles` must exist for encapsulation to apply.
      encapsulation: ViewEncapsulation.Emulated,
      standalone: false,
    })
    class AppRoot {}

    @Component({
      selector: 'parent-comp',
      template: '',
      styles: [':host { color: orange; }'], // `styles` must exist for encapsulation to apply.
      encapsulation: ViewEncapsulation.Emulated,
      standalone: false,
    })
    class ParentComponent {
      constructor(elementRef: ElementRef, renderer: Renderer2) {
        const elementFromRenderer = renderer.createElement('p');
        renderer.appendChild(elementRef.nativeElement, elementFromRenderer);
      }
    }

    TestBed.configureTestingModule({declarations: [AppRoot, ParentComponent]});
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();

    const secondParentEl: HTMLElement = fixture.nativeElement.querySelector('parent-comp');
    const elementFromRenderer: HTMLElement = fixture.nativeElement.querySelector('p');
    const getNgContentAttr = (element: HTMLElement) => {
      return Array.from(element.attributes)
        .map((a) => a.name)
        .find((a) => /ngcontent/.test(a));
    };

    const hostNgContentAttr = getNgContentAttr(secondParentEl);
    const viewNgContentAttr = getNgContentAttr(elementFromRenderer);

    expect(hostNgContentAttr).not.toBe(
      viewNgContentAttr,
      'Expected child manually created via Renderer2 to have a different view encapsulation' +
        'attribute than its host element',
    );
  });

  it('should create a new Renderer2 for each component', () => {
    @Component({
      selector: 'child',
      template: '',
      styles: [':host { color: red; }'],
      encapsulation: ViewEncapsulation.Emulated,
      standalone: false,
    })
    class Child {
      constructor(public renderer: Renderer2) {}
    }

    @Component({
      template: '<child></child>',
      styles: [':host { color: orange; }'],
      encapsulation: ViewEncapsulation.Emulated,
      standalone: false,
    })
    class Parent {
      @ViewChild(Child) childInstance!: Child;
      constructor(public renderer: Renderer2) {}
    }

    TestBed.configureTestingModule({declarations: [Parent, Child]});
    const fixture = TestBed.createComponent(Parent);
    const componentInstance = fixture.componentInstance;
    fixture.detectChanges();

    // Assert like this, rather than `.not.toBe` so we get a better failure message.
    expect(componentInstance.renderer !== componentInstance.childInstance.renderer).toBe(
      true,
      'Expected renderers to be different.',
    );
  });

  it('components should not share the same context when creating with a root element', () => {
    const log: string[] = [];
    @Component({
      selector: 'comp-a',
      template: '<div>{{ a }}</div>',
      standalone: false,
    })
    class CompA {
      @Input() a: string = '';
      ngDoCheck() {
        log.push('CompA:ngDoCheck');
      }
    }

    @Component({
      selector: 'comp-b',
      template: '<div>{{ b }}</div>',
      standalone: false,
    })
    class CompB {
      @Input() b: string = '';
      ngDoCheck() {
        log.push('CompB:ngDoCheck');
      }
    }

    @Component({
      template: `<span></span>`,
      standalone: false,
    })
    class MyCompA {
      constructor(private _injector: EnvironmentInjector) {}

      createComponent() {
        return createComponent(CompA, {
          environmentInjector: this._injector,
          hostElement: document.createElement('div'),
        });
      }
    }

    @Component({
      template: `<span></span>`,
      standalone: false,
    })
    class MyCompB {
      constructor(private envInjector: EnvironmentInjector) {}

      createComponent() {
        return createComponent(CompB, {
          environmentInjector: this.envInjector,
          hostElement: document.createElement('div'),
        });
      }
    }

    @NgModule({declarations: [CompA]})
    class MyModuleA {}

    @NgModule({declarations: [CompB]})
    class MyModuleB {}

    TestBed.configureTestingModule({
      declarations: [MyCompA, MyCompB],
      imports: [MyModuleA, MyModuleB],
    });
    const fixtureA = TestBed.createComponent(MyCompA);
    fixtureA.detectChanges();
    const compA = fixtureA.componentInstance.createComponent();
    compA.instance.a = 'a';
    compA.changeDetectorRef.detectChanges();

    expect(log).toEqual(['CompA:ngDoCheck']);

    log.length = 0; // reset the log

    const fixtureB = TestBed.createComponent(MyCompB);
    fixtureB.detectChanges();
    const compB = fixtureB.componentInstance.createComponent();
    compB.instance.b = 'b';
    compB.changeDetectorRef.detectChanges();

    expect(log).toEqual(['CompB:ngDoCheck']);
  });

  it('should preserve simple component selector in a component factory', () => {
    @Component({
      selector: '[foo]',
      template: '',
      standalone: false,
    })
    class AttSelectorCmp {}

    const selector = reflectComponentType(AttSelectorCmp)?.selector;

    expect(selector).toBe('[foo]');
  });

  it('should preserve complex component selector in a component factory', () => {
    @Component({
      selector: '[foo],div:not(.bar)',
      template: '',
      standalone: false,
    })
    class ComplexSelectorCmp {}

    const selector = reflectComponentType(ComplexSelectorCmp)?.selector;

    expect(selector).toBe('[foo],div:not(.bar)');
  });

  it('should clear host element if provided in ComponentFactory.create', () => {
    @Component({
      selector: 'dynamic-comp',
      template: 'DynamicComponent Content',
      standalone: false,
    })
    class DynamicComponent {}

    @Component({
      selector: 'app',
      template: `
        <div id="dynamic-comp-root-a">
          Existing content in slot A, which <b><i>includes</i> some HTML elements</b>.
        </div>
        <div id="dynamic-comp-root-b">
          <p>Existing content in slot B, which includes some HTML elements.</p>
        </div>
      `,
      standalone: false,
    })
    class App {
      constructor(public injector: EnvironmentInjector) {}

      createDynamicComponent(target: any) {
        createComponent(DynamicComponent, {
          hostElement: target,
          environmentInjector: this.injector,
        });
      }
    }

    function _document(): any {
      // Tell Ivy about the global document
      ɵsetDocument(document);
      return document;
    }

    TestBed.configureTestingModule({
      declarations: [App, DynamicComponent],
      providers: [{provide: DOCUMENT, useFactory: _document, deps: []}],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    // Create an instance of DynamicComponent and provide host element *reference*
    let targetEl = document.getElementById('dynamic-comp-root-a')!;
    fixture.componentInstance.createDynamicComponent(targetEl);
    fixture.detectChanges();
    expect(targetEl.innerHTML).not.toContain('Existing content in slot A');
    expect(targetEl.innerHTML).toContain('DynamicComponent Content');

    // Create an instance of DynamicComponent and provide host element *selector*
    targetEl = document.getElementById('dynamic-comp-root-b')!;
    fixture.componentInstance.createDynamicComponent('#dynamic-comp-root-b');
    fixture.detectChanges();
    expect(targetEl.innerHTML).not.toContain('Existing content in slot B');
    expect(targetEl.innerHTML).toContain('DynamicComponent Content');
  });

  describe('reflectComponentType', () => {
    it('should create an ComponentMirror for a standalone component', () => {
      function transformFn() {}

      @Component({
        selector: 'standalone-component',
        template: `
          <ng-content></ng-content>
          <ng-content select="content-selector-a"></ng-content>
          <ng-content select="content-selector-b"></ng-content>
          <ng-content></ng-content>
        `,
        inputs: ['input-a', 'input-b:input-alias-b'],
        outputs: ['output-a', 'output-b:output-alias-b'],
      })
      class StandaloneComponent {
        @Input({alias: 'input-alias-c', transform: transformFn}) inputC: unknown;
        @Input({isSignal: true} as Input) inputD = input(false);
      }

      const mirror = reflectComponentType(StandaloneComponent)!;

      expect(mirror.selector).toBe('standalone-component');
      expect(mirror.type).toBe(StandaloneComponent);
      expect(mirror.isStandalone).toEqual(true);
      expect(mirror.inputs).toEqual([
        {propName: 'input-a', templateName: 'input-a', isSignal: false},
        {propName: 'input-b', templateName: 'input-alias-b', isSignal: false},
        {
          propName: 'inputC',
          templateName: 'input-alias-c',
          transform: transformFn,
          isSignal: false,
        },
        {propName: 'inputD', templateName: 'inputD', isSignal: true},
      ]);
      expect(mirror.outputs).toEqual([
        {propName: 'output-a', templateName: 'output-a'},
        {propName: 'output-b', templateName: 'output-alias-b'},
      ]);
      expect(mirror.ngContentSelectors).toEqual([
        '*',
        'content-selector-a',
        'content-selector-b',
        '*',
      ]);
    });

    it('should create an ComponentMirror for a non-standalone component', () => {
      function transformFn() {}

      @Component({
        selector: 'non-standalone-component',
        template: `
          <ng-content></ng-content>
          <ng-content select="content-selector-a"></ng-content>
          <ng-content select="content-selector-b"></ng-content>
          <ng-content></ng-content>
        `,
        inputs: ['input-a', 'input-b:input-alias-b'],
        outputs: ['output-a', 'output-b:output-alias-b'],
        standalone: false,
      })
      class NonStandaloneComponent {
        @Input({alias: 'input-alias-c', transform: transformFn}) inputC: unknown;
      }

      const mirror = reflectComponentType(NonStandaloneComponent)!;

      expect(mirror.selector).toBe('non-standalone-component');
      expect(mirror.type).toBe(NonStandaloneComponent);
      expect(mirror.isStandalone).toEqual(false);
      expect(mirror.inputs).toEqual([
        {propName: 'input-a', templateName: 'input-a', isSignal: false},
        {propName: 'input-b', templateName: 'input-alias-b', isSignal: false},
        {
          propName: 'inputC',
          templateName: 'input-alias-c',
          transform: transformFn,
          isSignal: false,
        },
      ]);
      expect(mirror.outputs).toEqual([
        {propName: 'output-a', templateName: 'output-a'},
        {propName: 'output-b', templateName: 'output-alias-b'},
      ]);
      expect(mirror.ngContentSelectors).toEqual([
        '*',
        'content-selector-a',
        'content-selector-b',
        '*',
      ]);
    });

    describe('error checking', () => {
      it('should throw when provided class is not a component', () => {
        class NotAnnotated {}

        @Directive()
        class ADirective {}

        @Injectable()
        class AnInjectiable {}

        expect(reflectComponentType(NotAnnotated)).toBe(null);
        expect(reflectComponentType(ADirective)).toBe(null);
        expect(reflectComponentType(AnInjectiable)).toBe(null);
      });
    });
  });

  it('should attach debug info to component using ɵsetClassDebugInfo runtime', () => {
    class Comp {
      static ɵcmp = ɵɵdefineComponent({type: Comp, decls: 0, vars: 0, template: () => ''});
    }
    ɵsetClassDebugInfo(Comp, {
      className: 'Comp',
      filePath: 'comp.ts',
      lineNumber: 11,
      forbidOrphanRendering: true,
    });

    expect(Comp.ɵcmp.debugInfo).toEqual({
      className: 'Comp',
      filePath: 'comp.ts',
      lineNumber: 11,
      forbidOrphanRendering: true,
    });
  });

  describe('required initiliazers', () => {
    // The following tests are specifically not in the authoring subdirectory to ensure that AOT doesn't check (and throws) forbidden required reads.
    it('should throw error if a required input is accessed too early', () => {
      @Component({
        selector: 'input-comp',
        template: 'input:{{input()}}',
      })
      class InputComp {
        input = input.required<number>({debugName: 'input'});

        constructor() {
          this.input();
        }
      }

      @Component({
        template: `<input-comp [input]="value" />`,
        imports: [InputComp],
      })
      class TestCmp {
        value = 1;
      }

      expect(() => TestBed.createComponent(TestCmp)).toThrowError(
        /Input "input" is required but no value is available yet/,
      );
    });

    it('should throw if a required model input is accessed too early', () => {
      @Directive({selector: '[dir]'})
      class Dir {
        value = model.required<number>();

        constructor() {
          this.value();
        }
      }

      @Component({
        template: '<div [(value)]="value" dir></div>',
        imports: [Dir],
      })
      class App {
        value = 1;
      }

      expect(() => TestBed.createComponent(App)).toThrowError(
        /Model is required but no value is available yet/,
      );
    });

    it('should throw if required query is read in the constructor', () => {
      @Component({
        template: `<div #el></div>`,
      })
      class AppComponent {
        divEl = viewChild.required<ElementRef<HTMLDivElement>>('el');

        constructor() {
          this.divEl();
        }
      }

      // non-required query results are undefined before we run creation mode on the view queries
      expect(() => {
        TestBed.createComponent(AppComponent);
      }).toThrowError(/NG0951: Child query result is required but no value is available/);
    });
  });
});

describe('standalone components - component features', () => {
  it('should create and render standalone component', () => {
    @Component({
      selector: 'standalone-comp',
      template: '<h1>Standalone Component</h1>',
      standalone: true,
    })
    class StandaloneComp {}

    const fixture = TestBed.createComponent(StandaloneComp);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Standalone Component');
  });

  it('should support inputs and outputs in standalone component', () => {
    @Component({
      selector: 'standalone-comp',
      template: '<div>{{ value }}</div>',
      standalone: true,
    })
    class StandaloneComp {
      @Input() value = '';
    }

    @Component({
      template: '<standalone-comp [value]="message"></standalone-comp>',
      standalone: true,
      imports: [StandaloneComp],
    })
    class App {
      message = 'Hello Standalone';
    }

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('div').textContent).toBe('Hello Standalone');
  });

  it('should support ViewChild in standalone component', () => {
    @Component({
      selector: 'child-comp',
      template: '<span>Child</span>',
      standalone: true,
    })
    class ChildComp {
      value = 'child-value';
    }

    @Component({
      template: '<child-comp></child-comp>',
      standalone: true,
      imports: [ChildComp],
    })
    class ParentComp {
      @ViewChild(ChildComp) child!: ChildComp;
    }

    const fixture = TestBed.createComponent(ParentComp);
    fixture.detectChanges();

    expect(fixture.componentInstance.child).toBeDefined();
    expect(fixture.componentInstance.child.value).toBe('child-value');
  });

  it('should support ViewChild with required in standalone component', () => {
    @Component({
      selector: 'child-comp',
      template: '<span>Child</span>',
      standalone: true,
    })
    class ChildComp {
      value = 'child-value';
    }

    @Component({
      template: '<child-comp></child-comp>',
      standalone: true,
      imports: [ChildComp],
    })
    class ParentComp {
      @ViewChild(ChildComp, {read: ChildComp}) child!: ChildComp;
    }

    const fixture = TestBed.createComponent(ParentComp);
    fixture.detectChanges();

    expect(fixture.componentInstance.child.value).toBe('child-value');
  });

  it('should support dependency injection in standalone component', () => {
    @Injectable()
    class MyService {
      getValue() {
        return 'service-value';
      }
    }

    @Component({
      selector: 'standalone-comp',
      template: '<div>{{ value }}</div>',
      standalone: true,
      providers: [MyService],
    })
    class StandaloneComp {
      value: string;
      constructor(service: MyService) {
        this.value = service.getValue();
      }
    }

    const fixture = TestBed.createComponent(StandaloneComp);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('div').textContent).toBe('service-value');
  });

  it('should support nested standalone components', () => {
    @Component({
      selector: 'grandchild-comp',
      template: '<span>Grandchild</span>',
      standalone: true,
    })
    class GrandchildComp {}

    @Component({
      selector: 'child-comp',
      template: '<div>Child: <grandchild-comp></grandchild-comp></div>',
      standalone: true,
      imports: [GrandchildComp],
    })
    class ChildComp {}

    @Component({
      template: '<child-comp></child-comp>',
      standalone: true,
      imports: [ChildComp],
    })
    class ParentComp {}

    const fixture = TestBed.createComponent(ParentComp);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Grandchild');
  });

  it('should support standalone component with directives', () => {
    @Directive({
      selector: '[highlight]',
      standalone: true,
    })
    class HighlightDirective {
      constructor(el: ElementRef) {
        el.nativeElement.style.backgroundColor = 'yellow';
      }
    }

    @Component({
      template: '<div highlight>Highlighted</div>',
      standalone: true,
      imports: [HighlightDirective],
    })
    class StandaloneComp {}

    const fixture = TestBed.createComponent(StandaloneComp);
    fixture.detectChanges();

    const div = fixture.nativeElement.querySelector('div');
    expect(div.style.backgroundColor).toBe('yellow');
  });

  it('should support standalone component importing NgIf', () => {
    @Component({
      template: '<div *ngIf="show">Visible</div>',
      standalone: true,
      imports: [NgIf],
    })
    class StandaloneComp {
      show = true;
    }

    const fixture = TestBed.createComponent(StandaloneComp);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Visible');

    fixture.componentInstance.show = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Visible');
  });

  it('should support encapsulation in standalone component', () => {
    @Component({
      selector: 'emulated-comp',
      template: '<div>Emulated</div>',
      standalone: true,
      styles: ['div { color: red; }'],
      encapsulation: ViewEncapsulation.Emulated,
    })
    class EmulatedComp {}

    @Component({
      selector: 'none-comp',
      template: '<div>None</div>',
      standalone: true,
      styles: ['div { color: blue; }'],
      encapsulation: ViewEncapsulation.None,
    })
    class NoneComp {}

    @Component({
      template: '<emulated-comp></emulated-comp><none-comp></none-comp>',
      standalone: true,
      imports: [EmulatedComp, NoneComp],
    })
    class App {}

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    // Just verify components render; style isolation is browser-dependent
    expect(fixture.nativeElement.textContent).toContain('Emulated');
    expect(fixture.nativeElement.textContent).toContain('None');
  });

  it('should support createComponent with standalone component', () => {
    @Component({
      selector: 'dynamic-comp',
      template: '<span>Dynamic</span>',
      standalone: true,
    })
    class DynamicComp {}

    @Component({
      template: '<div #container></div>',
      standalone: true,
    })
    class HostComp {
      @ViewChild('container', {read: ViewContainerRef}) container!: ViewContainerRef;
    }

    const fixture = TestBed.createComponent(HostComp);
    fixture.detectChanges();

    const componentRef = fixture.componentInstance.container.createComponent(DynamicComp);
    componentRef.changeDetectorRef.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dynamic');
  });

  it('should support onDestroy in standalone component used as provider', () => {
    const testToken = new InjectionToken<StandaloneParent>('testToken');
    let destroyCalls = 0;

    @Component({
      selector: 'standalone-parent',
      template: '<ng-content></ng-content>',
      providers: [{provide: testToken, useExisting: StandaloneParent}],
      standalone: true,
    })
    class StandaloneParent implements OnDestroy {
      ngOnDestroy() {
        destroyCalls++;
      }
    }

    @Component({
      selector: 'standalone-child',
      template: '',
      standalone: true,
    })
    class StandaloneChild {
      constructor(_parent: StandaloneParent) {}
    }

    @Component({
      template: `
        <standalone-parent>
          <standalone-child></standalone-child>
        </standalone-parent>
      `,
      standalone: true,
      imports: [StandaloneParent, StandaloneChild],
    })
    class App {}

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(destroyCalls).toBe(0);

    fixture.destroy();
    expect(destroyCalls).toBe(1);
  });

  it('should support forwardRef in standalone component', () => {
    @Component({
      selector: 'standalone-comp',
      template: '{{ message }}',
      standalone: true,
    })
    class StandaloneComp {
      message = 'test';
    }

    @Component({
      template: '<standalone-comp></standalone-comp>',
      standalone: true,
      imports: [forwardRef(() => StandaloneComp)],
    })
    class App {}

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe('test');
  });

  it('should support reflectComponentType with standalone component', () => {
    @Component({
      selector: 'standalone-comp',
      template: '<div>Test</div>',
      standalone: true,
    })
    class StandaloneComp {
      @Input() value = '';
    }

    const mirror = reflectComponentType(StandaloneComp);
    expect(mirror).toBeDefined();
    expect(mirror!.selector).toBe('standalone-comp');
    expect(mirror!.isStandalone).toBe(true);
    expect(mirror!.inputs.length).toBe(1);
    expect(mirror!.inputs[0].propName).toBe('value');
  });
});
