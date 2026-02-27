# Markdown fence embedding

```angular-ts
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

    @if (items.length > 0) {
      @let first = items[0];
      <span>{{ first.name }}</span>
    } @else {
      <span>No items</span>
    }
  `,
})
export class DemoComponent {
  title = 'hello';
  isDisabled = false;
  items = [{name: 'one'}];

  onClick(_event: MouseEvent): void {}
}
```

```angular-html
<section [class.active]="items.some(item => item.selected)">
  @if (items.length > 0) {
    @let first = items[0];
    <p>{{ first.name }}</p>
  }
</section>
```

```angularts
const x = items.find(item => item.name === 'x');
```

```angular.html
<div>{{ items.find(item => item.id === selectedId)?.name }}</div>
```
