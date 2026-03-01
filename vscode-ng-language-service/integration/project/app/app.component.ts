import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'my-app',
  template: `<h1>Hello {{ name }}</h1>`,
  host: {
    style: 'border: 1px 2px 3px var(--help)',
    'style': 'border: 1px 2px 3px var(--help)',
    '[style.padding]': '"5px"',
    '[style.border]': '"3px solid black"',
    '[style.padding.px]': '"5"',
    '[style]': '{width: "200px"; height: "50px";}',
    '[style.background-color]': 'appInput',
    '[style.backgroundColor]': 'appInput',
    '[style.width.px]': 'name.length',
  },
  standalone: false,
})
export class AppComponent {
  name = 'Angular';
  @Input() appInput = '';
  @Output() appOutput = new EventEmitter<string>();
}
