```angular-ts
import {Component} from '@angular/core';

@Component({
  template: `
    @if (isReady) {
      <button (click)="onClick()">{{ label }}</button>
    }
  `,
  styles: `
    button {
      border-radius: 9999px;
      color: #4b5563;
    }
  `,
})
export class DemoComponent {}
```

```angular-html
<fieldset>
  @if (isReady) {
    <span>{{ label }}</span>
  }
</fieldset>
```

```ts
@Component({
  template: `
    @if (shouldNotHighlight) {
      <div>{{ stillPlainTsFence }}</div>
    }
  `,
  styles: `
    button {
      border-radius: 2px;
    }
  `,
})
class PlainTsFenceComponent {}
```

Outside fenced block: @if should not get Angular block scopes.

```angular-html
<section>
  @if (isReady) {
    <em>{{ label }}</em>
  }
</section>
```

```angularts
@if (malformedLanguageId) {
  <span>no match expected</span>
}
```

```Angular-TS
@if (caseVariantLanguageId) {
  <span>no match expected</span>
}
```

```angular-ts
@Component({
  template: `
    @if (tildeTsFence) {
      <span>{{ label }}</span>
    }
  `,
})
class TildeTsFenceComponent {}
```
