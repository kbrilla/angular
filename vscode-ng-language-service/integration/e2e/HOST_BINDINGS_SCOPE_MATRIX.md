# Host Binding Scope Matrix (TDD)

Source references used for syntax research:

- https://angular.dev/guide/components/host-elements#binding-to-the-host-element
- https://angular.dev/guide/templates/binding#css-class-and-style-property-bindings
- https://angular.dev/guide/templates/event-listeners

## Forms to cover

- static host keys: `style`, `'style'`, `class`
- property binding: `[tabIndex]`, `[id]`
- attribute binding: `[attr.data-test]`, `[attr.aria-label]`
- class binding: `[class]`, `[class.active]`, `[class.foo-bar]`
- style binding: `[style]`, `[style.padding]`, `[style.padding.px]`, `[style.--help]`
- event binding: `(click)`, `(keyup.enter)`, `(window:keydown)`

## Scope contracts to enforce in e2e

- host binding keys should include Angular host-binding scopes (`hostbindings.ng`, binding-name scopes), not only plain TS string scopes.
- style static values should include CSS scopes.
- `[style.prop]` quoted value strings should include CSS scopes for value tokenization.
- `[style]` quoted declaration strings should include CSS scopes.
- style key decomposition should include property/unit-specific scopes where applicable.
