/* clang-format off */

/* Inline template recognition tests */
@Component({
  //// Property key/value test
  template: '<div></div>',

  //// String delimiter tests
  template: `<div></div>`,
  template: "<div></div>",
  template: '<div></div>',

  //// Parenthesization tests
  template: ( (( '<div></div>' )) ),

  //// Comments tests
  // template: '<div></div>'
  /*
   * template: '<div></div>'
   */
  /**
   * template: '<div></div>'
   */
})
export class TMComponent{}

/* Template syntax tests */
@Component({
  // Interpolation test
  template: '<div style="width: var(--some-var);"></div><div style="widht: var(--some-var);"></div><div [style.width.px]="w"></div><div [style]="{\'--x\': \'var(--some-var)\'}"></div>{{property}}',
})
export class TMComponent{}
