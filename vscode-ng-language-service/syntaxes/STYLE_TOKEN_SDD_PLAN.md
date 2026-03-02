# SDD Plan: Correct Inline Style Tokenization Context

Date: 2026-03-01
Scope: `vscode-ng-language-service/syntaxes`
Method: SDD (Specification-Driven Development)

## 1) Specification

### Functional requirement

Inline declaration-only style content must tokenize as CSS declarations, not selectors.

### Token parity requirement

For declaration-only style content, semantic token families for `width: var(--some-var);` must match known-good declaration contexts (HTML inline style and CSS/SCSS rule-body declaration list), measured using token-inspection APIs.

### In-scope inputs

- HTML template style attribute values:
  - `style="width: 2px;"`
- Host static style values in decorator host object:
  - `host: { style: "width: 2px;" }`
  - `host: { 'style': 'width: 2px;' }`

### Required context coverage

- External templates (`.html`)
- Inline templates (`template: '...'` / ``template: `...` ``)
- `host` in `@Component` decorators
- `host` in `@Directive` decorators

### Style-binding variants to preserve (non-regression)

- Template: `[style]`, `[style.prop]`, `[style.prop.unit]`
- Host: `'[style]'`, `'[style.prop]'`, `'[style.prop.unit]'`

### Out-of-scope (for this change)

- Full stylesheet tokenization (`.class { ... }`) outside inline declaration contexts.
- Angular expression semantics of `[style]` binding object-literal values (keep existing behavior unless explicitly changed).

### Acceptance criteria

1. No `meta.selector.css` on declaration-only inline style text.
2. Property/value punctuation and numeric scopes appear for simple declarations (`width: 2px;`).
3. Existing grammar behavior for all style binding expression forms remains unchanged.
4. Behavior is consistent across external templates, inline templates, and host objects in both `@Component` and `@Directive`.
5. Token parity checks pass for `width`, `:`, `var`, `--some-var` against reference declaration contexts.

## 2) Design

### Design decision

Switch inline declaration contexts from stylesheet root embedding to declaration-list embedding.

### Upstream alignment rule

Token semantics should stay aligned with upstream `microsoft/vscode-css` grammar concepts (`css.cson`), especially declaration-list constructs (`rule-list` / `rule-list-innards`) and related property/value/function scope families.

### Target grammar areas

- `syntaxes/src/template-tag.ts`
  - `styleAttribute`
- `syntaxes/src/host-object-literal.ts`
  - `ngHostStyleStaticUnquoted`
  - `ngHostStyleStatic`
- Validation scope touches:
  - `syntaxes/src/inline-template.ts` (context propagation via `template.tag.ng` include)

### Proposed embedding model

- Prefer including CSS declaration-list subrule (e.g., `source.css#rule-list-innards`) for inline style values.
- Preserve `meta.embedded.line.css` envelope to keep editor embedded-language behavior.
- Keep string delimiters and Angular/TS scopes unchanged around the embedded style region.
- Validate design by token parity outcome, not by choosing `source.css` vs `source.css.scss` alone.

### Risk management

- External grammar subrule naming may vary.
- If subrule include is unstable, use a minimal wrapper pattern that safely enters declaration parsing semantics while preserving existing integration.

## 3) Verification Plan

### Grammar generation

- Regenerate JSON grammars from `syntaxes/src`.

### Snapshot coverage (minimum)

- Update/add test data to explicitly include:
  - `style="width: 2px;"`
  - `style="width: var(--some-var);"`
  - `style="widht: var(--some-var);"`
  - `host: { style: "width: 2px;" }`
  - `host: { 'style': 'width: 2px;' }`
- Assert deep token scopes for `width`, `:`, `2px`, `;`.
- Ensure equivalent assertions exist in:
  - external-template-oriented cases,
  - inline-template-oriented cases,
  - host-object cases representative of both component/directive usage.

### Regression checks

- Existing host binding cases: `[style.padding]`, `[style.padding.px]`, `[style]`, non-style bindings.
- Existing template bindings and event/property/template syntax.
- Specific style non-regression checks:
  - template `[style]="expr"` remains expression-tokenized,
  - template `[style.width]="expr"` and `[style.width.px]="expr"` keep current binding-key scopes,
  - host `'[style]'`, `'[style.width]'`, `'[style.width.px]'` keep current behavior.

### Token-inspection validation pass

- Use VS Code token-inspection APIs to collect/compare:
  - `getTokenInformationAtPosition`
  - `getScopeRangeAtPosition`
  - `getScopeInformationAtPosition`
- Compare these contexts:
  1. Template `style="width: var(--some-var);"`
  2. Host static `style: "width: var(--some-var);"`
  3. Reference declaration context in CSS/SCSS: `.dummy-class { width: var(--some-var); }`
  4. Invalid property variant (`widht`) in each context
- Record differences and classify as:
  - acceptable contextual variation,
  - regression/blocker.

## 4) Implementation Steps (Minimal)

1. Change embedding includes for declaration-only style contexts in `template-tag.ts` and `host-object-literal.ts`.
2. Regenerate generated grammar JSON files.
3. Update snapshots only where scope changes are expected.
4. Run targeted syntax tests.
5. Run token-inspection parity checks on reference fixtures and record outcome.
6. If required by CI signal, update only affected goldens (no unrelated baseline churn).

## 5) Definition of Done

- Acceptance criteria satisfied.
- Snapshot changes are minimal and reviewed for scope correctness.
- Branch remains clean except intended syntax/test updates.
- VSIX can be rebuilt and inspected with scope inspector to verify real editor behavior on:
  - `style="width: 2px;"`
  - host static `style` value.

## 6) Open Questions

1. Should inline `style` values use `source.css` or `source.css.scss` base envelope when entering declaration-list subrules?
2. Do we want explicit distinct scopes for host static style vs template style attribute for easier theming/debugging?
3. Should `[style]="{...}"` string/object cases receive additional semantic sub-scoping in a follow-up change?

## 7) Execution Progress

Completed:

- Grammar changes applied for declaration-oriented style tokenization in:
  - `template-tag.ts` (`styleAttribute` + local declaration parsing rules)
  - `host-object-literal.ts` (`ngHostStyleStaticUnquoted`, `ngHostStyleStatic` + local declaration parsing rules)
- Fixture coverage expanded for:
  - template static style with `var(--some-var)` and invalid `widht`
  - host static style with `var(--some-var)` and invalid `widht`
  - directive host coverage
  - inline template coverage for static style + style bindings
- Generated JSON grammars refreshed.
- Snapshot goldens refreshed and syntax test target re-run successfully.
- Added token-parity e2e spec using:
  - `getScopeInformationAtPosition`
  - dedicated parity fixtures for external template, inline template, component host, and directive host.
- Re-ran full e2e target successfully.
- Added semicolon-less declaration coverage in grammar and parity fixtures for host static style values.
- Re-ran syntax snapshots and full e2e after semicolon-less hardening; both pass.

Remaining for full closure:

- Optional: extend parity coverage to additional CSS function/value edge cases and quoted/escaped declaration variants.
