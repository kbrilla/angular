import {Component, Directive} from '@angular/core';

@Component({
  selector: 'style-token-parity',
  template: `<div></div>`,
  host: {
    style: 'width: var(--parity-component-host-var);',
    'style': 'widht: var(--parity-component-host-var);',
    '[style.width.px]': 'w',
    '[style]': 'expr',
  },
  standalone: false,
})
export class StyleTokenParityComponent {
  w = 5;
  expr = '{width: "200px"; height: "50px";}';
}

@Directive({
  selector: '[styleTokenParityDirective]',
  host: {
    style: 'width: var(--parity-directive-host-var);',
    'style': 'widht: var(--parity-directive-host-var);',
    '[style.width.px]': 'w',
    '[style]': 'expr',
  },
  standalone: false,
})
export class StyleTokenParityDirective {
  w = 5;
  expr = '{width: "200px"; height: "50px";}';
}
