import {Component} from '@angular/core';

@Component({
  selector: 'style-token-parity-inline',
  template: `<div style="width: var(--parity-inline-var)"></div>
    <div style="widht: var(--parity-inline-var)"></div>`,
  standalone: false,
})
export class StyleTokenParityInlineComponent {}
