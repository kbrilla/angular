import {Component} from '@angular/core';

@Component({
  selector: 'app-demo',
  host: {
    '[attr.aria-label]': 'label',
    '(click)': 'onClick($event)',
    role: 'button',
  },
  styles: [
    `
      :host {
        display: block;
      }

      .item {
        color: red;
      }
    `,
  ],
  template: `
    <button [disabled]="isDisabled" (click)="onClick($event)">{{ title }}</button>
    <p>{{ items.find(item => item.name === title)?.name ?? 'n/a' }}</p>

    @if (items.length > 0) {
      @let first = items[0];
      <span>{{ first.name }}</span>
    }
  `,
})
export class DemoComponent {
  title = 'hello';
  label = 'demo';
  isDisabled = false;
  items = [{name: 'one'}];

  onClick(_event: MouseEvent): void {}
}
