# Style Token Scope Research (host/style attribute)

Date: 2026-03-01
Context: `vscode-ng-language-service/syntaxes`

## Problem Summary

Observed in screenshots and local inspection:

- `host: { style: "border: 1px 2px 3px var(--help)" }` gets CSS-ish highlighting, but some declaration-only inputs still classify as selector scopes.
- `style="width: 2px;"` can receive `meta.selector.css` on text where we expect declaration scopes (`meta.property-name.css`, `meta.property-value.css`, etc.).
- `source.css.scss` alone is not sufficient for this case if parsing starts at stylesheet root behavior.

User expectation: declaration-only inline style content should tokenize as CSS declarations, not selectors.

## Current Grammar Wiring in Angular

### Context coverage (where these grammars apply)

- `template-tag.ts` is injected for HTML tags (`meta.tag`) and therefore applies to:
  - external templates (`.html`) parsed as Angular templates,
  - inline templates (`template: '...'` / ``template: `...` ``) because `inline-template.ts` includes `template.tag.ng`,
  - markdown fenced Angular blocks (`angular-html`, `angular-ts`) via dedicated injection selector clauses.
- `host-object-literal.ts` is injected in decorator object literals and applies to both:
  - `@Component({... host: {...} ...})`
  - `@Directive({... host: {...} ...})`

### Host object literal

- `vscode-ng-language-service/syntaxes/src/host-object-literal.ts`
  - `ngHostStyleStaticUnquoted` uses:
    - `contentName: 'source.css meta.embedded.line.css'`
    - `patterns: [{include: 'source.css'}]`
  - `ngHostStyleStatic` uses the same.
  - `ngHostStyleBindingCssStringValue` uses `source.css.scss` for string-literal values in style bindings.

### Template tag style attribute

- `vscode-ng-language-service/syntaxes/src/template-tag.ts`
  - `styleAttribute` uses:
    - `contentName: 'source.css meta.embedded.line.css'`
    - `patterns: [{include: 'source.css'}]`

## Style-Binding Coverage Matrix (Current Behavior)

### Template side (`template-tag.ts`)

- `style="..."` (static style attribute)
  - Current value parsing: embedded CSS root (`source.css`)
  - Current issue: declaration-only inputs can be tokenized as selector context.
- `[style.prop]="expr"`, `[style.prop.unit]="expr"`, `[style]="expr"`
  - Current value parsing: Angular expression (`expression.ng`) by design.
  - Note: this research does **not** propose converting expression payloads into CSS token streams.

### Host side (`host-object-literal.ts`)

- `style: '...';` and `'style': '...';`
  - Current value parsing: embedded CSS root (`source.css`)
  - Current issue: same declaration-vs-selector mismatch as template style attribute.
- `'[style.prop]': '...';`, `'[style.prop.unit]': '...';`
  - Current value parsing: dedicated style-binding handling with CSS string embedding for quoted inner values (`source.css.scss`).
- `'[style]': 'expr';`
  - Current value parsing: Angular expression context unless it falls into the narrow CSS-string subpattern.
  - Expected to remain stable unless explicitly redesigned.

## Why `meta.selector.css` Appears for `width: 2px;`

From VS Code CSS grammar (`css.tmLanguage.json`):

- Root `source.css` patterns order is effectively:
  1. comment-block
  2. escapes
  3. combinators
  4. selector
  5. at-rules
  6. rule-list

The `selector` rule starts early and can match declaration-like starts (`width`) as selector text when parsing from root context. Inline style attributes/host static styles are declaration lists, not full stylesheet selector contexts.

So embedding full `source.css` root in declaration-only contexts can produce incorrect top-level scope classification (`meta.selector.css`).

## Key Insight

For inline declaration-only content, grammar should enter a declaration-list context (equivalent to `rule-list-innards`) instead of stylesheet-root context (`source.css`).

## Token Research Method (Required)

`source.css` vs `source.css.scss` choice by itself is not the real acceptance bar. The acceptance bar is token parity with known-good declaration contexts.

### Reference contexts for parity

1. HTML style attribute declaration context
   - `<div style="width: var(--some-var)"></div>`
2. CSS/SCSS declaration block context
   - `.dummy-class { width: var(--some-var); }`
3. Negative/invalid property example for diagnostics behavior
   - `<div style="widht: var(--some-var)"></div>`
   - `.dummy-class { widht: var(--some-var); }`

### Inspection APIs to use in VS Code

- `getTokenInformationAtPosition`
- `getScopeRangeAtPosition`
- `getScopeInformationAtPosition`

Collect token data for these spans:

- property identifier (`width` / `widht`)
- colon (`:`)
- function name (`var`)
- function argument custom property (`--some-var`)
- punctuation around function call (`(`, `)`)

### Parity principle

For declaration-only host/template style contexts, token family should match reference declaration contexts above. We do not require byte-for-byte identical full scope stacks, but semantic token classes must align.

## Expected Token Families (Reference)

For `width: var(--some-var);` in declaration context:

- `width`
  - expected family: property-name
  - typical scope stack includes `meta.property-name.css` + known-property scope (`support.type.property-name.css`)
- `:`
  - expected family: declaration separator
  - typical scope: `punctuation.separator.key-value.css`
- `var`
  - expected family: CSS function name
  - typical scopes include `support.function.misc.css` within `meta.function.variable.css`
- `--some-var`
  - expected family: CSS custom property reference
  - typical scope: `variable.argument.css`

For invalid property name `widht: ...`:

- `widht`
  - expected: still in property-name context (`meta.property-name.css`)
  - but generally missing known-property scope (`support.type.property-name.css`), which helps signal invalid/unknown property.

## Candidate Embedding Strategies

### A) Keep `include: 'source.css'` (current)

- Pros: simple, existing behavior.
- Cons: selector-first parsing at root causes false `meta.selector.css` classification.
- Verdict: insufficient.

### B) Replace with `include: 'source.css.scss'` only

- Pros: unified with other style-string contexts.
- Cons: still starts from language root; does not guarantee declaration-list context.
- Verdict: not enough on its own.

### C) Embed declaration-list subrule from CSS grammar

- Candidate include: `source.css#rule-list-innards` (or equivalent repository subrule path).
- Wrap with content name indicating embedded declaration context.
- Pros: aligns parser with inline style semantics.
- Cons: depends on external grammar subrule stability.
- Verdict: best technical match.

### D) Hybrid fallback

- Prefer declaration-list include; fallback to `source.css` only where needed for compatibility.
- Pros: safer migration path.
- Cons: more complexity.

## Scope Expectations (Target)

For `style="width: 2px;"` and host static style values:

- `width` -> property-name family (`meta.property-name.css`, `support.type.property-name.css`)
- `:` -> key-value separator (`punctuation.separator.key-value.css`)
- `2px` -> numeric/value scopes (`constant.numeric.css`, unit scope)
- `;` -> `punctuation.terminator.rule.css`
- No top-level `meta.selector.css` for declaration-only segments.

## Secondary Cases to Validate

- Multiple declarations: `width: 2px; height: 4px;`
- Variables/functions: `color: var(--help);`
- Nested function values: `background: linear-gradient(red, blue);`
- Host dynamic style string (`'[style.width]': '"5px"'`) should keep existing intended behavior.
- Template property bindings remain expression-based and must not regress:
  - `[style.width]="w"`
  - `[style.width.px]="w"`
  - `[style]="styleExpr"`
- Coverage must be verified in all rendering contexts:
  - external templates,
  - inline templates,
  - `@Component` host object,
  - `@Directive` host object.

## Testing Gaps Identified

Current snapshot tests primarily verify high-level embedded scope labels (e.g., `source.css meta.embedded.line.css`) and do not assert deep token scopes for property name/value inside embedded style text.

Need additional assertions/snapshots at token granularity for:

- `template-tag` style attribute declaration-only content
- `host-object-literal` static style declaration-only content

And explicit non-regression checks for style-related bindings:

- template `[style]`, `[style.prop]`, `[style.prop.unit]`
- host `'[style]'`, `'[style.prop]'`, `'[style.prop.unit]'`

Additionally, we need parity-oriented checks (via token-inspection APIs) for the `width/var(--some-var)/:` token family in:

- template `style="..."`
- host static `style` values
- reference external CSS/SCSS declaration contexts.

## Conclusion

Root cause is grammar context mismatch (stylesheet root vs declaration list).

`meta.selector.css` on declaration-only inline style text is expected from current embedding approach and should be treated as a bug for this feature. The fix should move style-attribute and host-static-style embedding to declaration-list parsing context.

## Iteration Status (2026-03-01)

Implemented in grammar sources:

- `template-tag.ts` style attribute now uses a local declaration parser (`styleAttributeDeclarationList`) that emits:
  - `meta.property-name.css`
  - `support.type.property-name.css` (for known properties)
  - `punctuation.separator.key-value.css`
  - `meta.function.variable.css`, `support.function.misc.css`, `variable.argument.css` for `var(--x)`.
- `host-object-literal.ts` static style cases (`style:` and `'style':`) now use a local declaration parser (`hostStaticStyleDeclarationList`) with the same token-family output goals.

Verification completed:

- Regenerated grammar JSON via syntaxes generation target.
- Updated snapshots for modified/expanded fixtures.
- Re-ran `//vscode-ng-language-service/syntaxes/test:test` and got PASS.
- Added and ran e2e parity assertions using real token APIs:
  - `vscode-ng-language-service/integration/e2e/style_token_parity_spec.ts`
  - validated external template, inline template, `@Component` host, and `@Directive` host contexts.
- Re-ran `//vscode-ng-language-service/integration/e2e:test` and got PASS.

Current limitation:

- Snapshot harness output is still not a full replacement for manual scope-inspector review in ad-hoc user scenarios.
- Automated parity now exists in e2e, but additional edge-case expansion (multi-line declarations, escaped quotes, uncommon CSS functions) is a follow-up opportunity.
