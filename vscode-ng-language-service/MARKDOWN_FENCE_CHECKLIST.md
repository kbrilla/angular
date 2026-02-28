# Markdown Fence Grammar Iteration Checklist

## Goal

Deliver fenced `angular-ts` / `angular-html` support with minimal risk: preserve existing Angular-main grammar sources, use additive grammar files, and keep regression coverage green.

## Main-Branch File Change Register (Detailed)

### Existing files from main that were changed

- [x] `vscode-ng-language-service/package.json`
  - Reason: register new additive fenced grammars/languages and e2e dependency.
  - Constraint: keep existing grammar `injectTo` behavior as close to main as possible.
  - Validation: `//vscode-ng-language-service/integration/e2e:test` green.

- [x] `vscode-ng-language-service/syntaxes/src/build.ts`
  - Reason: add build outputs for additive grammar sources only (`angular-ts`, `angular-html`, `markdown-fence`).
  - Constraint: do not alter behavior of existing grammar builders.
  - Validation: `pnpm bazel run //vscode-ng-language-service/syntaxes:syntaxes` succeeds.

- [x] `vscode-ng-language-service/syntaxes/BUILD.bazel`
  - Reason: wire additive JSON outputs/source-file sync for new grammar files.
  - Constraint: keep existing output mappings untouched.
  - Validation: syntax generation succeeds and files emitted correctly.

- [x] `vscode-ng-language-service/integration/e2e/index.ts`
  - Reason: local macOS e2e stability (`/opt/X11/bin` path), keep secure auth args.
  - Constraint: retain `--password-store=basic` and `--use-mock-keychain`.
  - Validation: e2e executes locally without Xvfb spawn errors.

- [x] `vscode-ng-language-service/integration/e2e/BUILD.bazel`
  - Reason: include TextMate language-service test dependency.
  - Validation: e2e target compiles/runs.

- [x] `vscode-ng-language-service/integration/e2e/helper.ts`
  - Reason: add markdown fixture URI helpers.

- [x] `vscode-ng-language-service/integration/e2e/jasmine.ts`
  - Reason: increase timeout for reliable extension-host startup.

- [x] `vscode-ng-language-service/integration/test_constants.ts`
  - Reason: add markdown fixture path constants.

### Checkpoint Items (each change, not grouped)

#### `vscode-ng-language-service/package.json` (existing in main)

- [x] Add `contributes.languages` entry for `angular-ts`.
- [x] Add `contributes.languages` entry for `angular-html`.
- [x] Add `contributes.grammars` entry for `source.angular-ts` (`angular-ts.json`).
- [x] Add `contributes.grammars` entry for `text.angular-html` (`angular-html.json`).
- [x] Add `contributes.grammars` entry for `markdown.fence.ng` (`markdown-fence.json`).
- [x] Add `embeddedLanguages` mapping for fenced angular-ts/html scopes.
- [x] Add `tokenTypes` mapping for fenced angular-ts/html embedded scopes.
- [x] Keep existing grammar `injectTo` arrays at main-default values (post-trim checkpoint).
- [x] Add devDependency `vscode-textmate-languageservice` for e2e scope assertions.

#### `vscode-ng-language-service/syntaxes/src/build.ts` (existing in main)

- [x] Add import for `AngularTs` grammar source.
- [x] Add import for `AngularHtml` grammar source.
- [x] Add import for `MarkdownFence` grammar source.
- [x] Add build output step for `angular-ts` JSON.
- [x] Add build output step for `angular-html` JSON.
- [x] Add build output step for `markdown-fence` JSON.

#### `vscode-ng-language-service/syntaxes/BUILD.bazel` (existing in main)

- [x] Add `_angular-ts.json` to `js_run_binary.outs`.
- [x] Add `_angular-html.json` to `js_run_binary.outs`.
- [x] Add `_markdown-fence.json` to `js_run_binary.outs`.
- [x] Add `angular-ts.json` write mapping.
- [x] Add `angular-html.json` write mapping.
- [x] Add `markdown-fence.json` write mapping.

### Necessity Validation Queue (Unchecked until proven)

> Each item is validated by a dedicated micro-iteration: attempt trim/remove/change, run e2e, then keep/remove based on result.

#### `package.json`

- [ ] `contributes.languages.angular-ts` is strictly required.
- [ ] `contributes.languages.angular-html` is strictly required.
- [ ] `contributes.grammars` entry for `source.angular-ts` is strictly required.
- [ ] `contributes.grammars` entry for `text.angular-html` is strictly required.
- [ ] `contributes.grammars` entry for `markdown.fence.ng` is strictly required.
- [ ] `embeddedLanguages` mapping in `markdown.fence.ng` is strictly required.
- [ ] `tokenTypes` mapping in `markdown.fence.ng` is strictly required.
- [ ] `vscode-textmate-languageservice` dependency is strictly required for current e2e strategy.

#### `syntaxes/src/build.ts`

- [ ] `build(AngularTs, 'angular-ts')` is strictly required.
- [ ] `build(AngularHtml, 'angular-html')` is strictly required.
- [ ] `build(MarkdownFence, 'markdown-fence')` is strictly required.

#### `syntaxes/BUILD.bazel`

- [ ] `_angular-ts.json` out + write mapping is strictly required.
- [ ] `_angular-html.json` out + write mapping is strictly required.
- [ ] `_markdown-fence.json` out + write mapping is strictly required.

### Additive files (not replacing existing main grammar source files)

- [x] `vscode-ng-language-service/syntaxes/src/angular-ts.ts`
- [x] `vscode-ng-language-service/syntaxes/src/angular-html.ts`
- [x] `vscode-ng-language-service/syntaxes/src/markdown-fence.ts`

## Regression Coverage

- [x] Fenced grammar e2e suite present and green (positive + anti-bleed assertions).
- [x] `angular-html` positive case in backtick fence.
- [x] `angular-html` positive case in tilde fence.
- [x] `angular-ts` positive case in tilde fence.
- [x] `angular-ts` scoped behavior (no unexpected html/css deep-scope bleed).
- [x] Negative case: plain `ts` fence does not trigger Angular fenced scopes.
- [x] Negative case: malformed language id (`angularts`) does not trigger Angular fenced scopes.
- [x] Negative case: case-variant language id (`Angular-TS`) does not trigger Angular fenced scopes.
- [x] Negative case: plain markdown text does not trigger Angular fenced scopes.
- [x] Current status: `13 specs, 0 failures`.

## Iteration Log

- Iteration 1: Added initial fenced e2e assertions + anti-bleed checks.
- Iteration 2: Trimmed manifest/injectTo deltas to preserve main behavior.
- Iteration 3: Audited diff scope (only additive grammar + minimal wiring).
- Iteration 4: Restored required e2e auth arg (`--use-mock-keychain`).
- Iteration 5: Re-validated e2e after arg restore; first run showed unrelated flaky `definition_spec`, second run passed (9/9).
- Iteration 6: Added tilde-fence positive and malformed-language negative tests; e2e passed (11/11).
- Iteration 7: Added case-variant language-label negative test; e2e passed (12/12).
- Iteration 8: Added tilde-fence positive test for `angular-ts`; e2e passed (13/13).
