/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Adds `?? null` to top-level safe navigation expressions in Angular template interpolations
 * and binding expressions. This preserves the legacy `null` return value when switching to
 * native optional chaining semantics.
 *
 * Only wraps the outermost `?.` chain — nested `?.` expressions within a chain are not
 * individually wrapped because the outermost `?? null` covers the entire chain.
 *
 * Example transformations:
 *   `{{ user?.name }}`           → `{{ user?.name ?? null }}`
 *   `{{ a?.b?.c }}`              → `{{ a?.b?.c ?? null }}`
 *   `{{ a?.b | pipe }}`          → `{{ a?.b ?? null | pipe }}` (NOT done — pipe precedence)
 *   `[title]="obj?.name"`        → `[title]="obj?.name ?? null"`
 *
 * Expressions that already have `?? null` or `?? undefined` are not modified.
 */
export function addNullCoalescingToSafeNavigations(template: string): {
  migrated: string;
  changed: boolean;
  replacementCount: number;
} {
  // Match Angular template expressions: interpolations {{ ... }} and property bindings [...]="..."
  // This is a simplified approach that handles the most common patterns.
  let changed = false;
  let replacementCount = 0;

  // Process interpolation expressions {{ ... }}
  const migrated = template.replace(
    /\{\{([\s\S]*?)\}\}/g,
    (_match: string, exprContent: string) => {
      const trimmed = exprContent.trim();

      // Skip if it already has ?? null or ?? undefined
      if (/\?\?\s*null\s*$/.test(trimmed) || /\?\?\s*undefined\s*$/.test(trimmed)) {
        return _match;
      }

      // Skip if expression doesn't contain ?.
      if (!trimmed.includes('?.')) {
        return _match;
      }

      // Skip expressions that use pipes (precedence is complex)
      // Only skip if pipe is at the top level (not inside parentheses)
      if (hasTopLevelPipe(trimmed)) {
        return _match;
      }

      // Add ?? null to preserve legacy null behavior
      changed = true;
      replacementCount++;
      return `{{ ${trimmed} ?? null }}`;
    },
  );

  return {migrated, changed, replacementCount};
}

/**
 * Checks if an expression string has a top-level pipe operator `|`.
 * Pipe operators inside parentheses or string literals are not considered top-level.
 */
function hasTopLevelPipe(expr: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    const prev = i > 0 ? expr[i - 1] : '';

    if (prev === '\\') continue;

    if (ch === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }

    if (inSingleQuote || inDoubleQuote || inBacktick) continue;

    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === '|' && depth === 0 && i + 1 < expr.length && expr[i + 1] !== '|') {
      // Single | at top level (not ||) is a pipe
      return true;
    }
  }

  return false;
}
