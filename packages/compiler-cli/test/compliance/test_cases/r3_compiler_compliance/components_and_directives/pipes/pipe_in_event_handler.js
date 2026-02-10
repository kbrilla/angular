export class MyApp {
  // ...
  static ɵcmp = /*@__PURE__*/ $r3$.ɵɵdefineComponent({
    type: MyApp,
    selectors: [["my-app"]],
    decls: 3,
    vars: 2,
    …
    template:  function MyApp_Template(rf, ctx) {
      if (rf & 1) {
        …
        $r3$.ɵɵdomListener("click", function MyApp_Template_button_click_0_listener() {
          return ctx.handleClick(i0.ɵɵlistenerPipeBind1(2, ctx.value));
        });
        …
        $r3$.ɵɵpipe(2, "myPipe");
      }
    },
    dependencies: [MyPipe],
    encapsulation: 2
  });
}
