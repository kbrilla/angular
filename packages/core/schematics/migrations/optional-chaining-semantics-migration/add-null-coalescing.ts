/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Scans an Angular template for safe navigation expressions (`?.`) and returns
 * information about their locations. This is used by the migration to report
 * expressions that need manual verification when switching to native optional
 * chaining semantics.
 *
 * NOTE: We intentionally do NOT auto-transform expressions with `?? null`.
 * While `?? null` would preserve the `null` short-circuit value, it would also
 * incorrectly convert genuinely `undefined` property values to `null`:
 *
 *   `a?.b?.c` where `c` is `undefined` on the object:
 *     - Legacy: returns `undefined` (no short-circuit happened, `c` IS `undefined`)
 *     - Native: returns `undefined` (same)
 *     - Native + `?? null`: returns `null` ← WRONG, changed real `undefined` to `null`
 *
 * The correct migration strategy is to keep components on `'legacy'` semantics
 * (the default) and only opt individual components into `'native'` after manual
 * verification that their templates do not depend on the `null` return value.
 */
export function findSafeNavigationExpressions(template: string): {
  /** The number of interpolation expressions containing `?.` */
  expressionCount: number;
  /** Whether any `?.` expressions were found */
  hasSafeNavigation: boolean;
} {
  let expressionCount = 0;

  // Match Angular interpolation expressions {{ ... }}
  template.replace(/\{\{([\s\S]*?)\}\}/g, (_match: string, exprContent: string) => {
    if (exprContent.includes('?.')) {
      expressionCount++;
    }
    return _match;
  });

  return {
    expressionCount,
    hasSafeNavigation: expressionCount > 0,
  };
}

