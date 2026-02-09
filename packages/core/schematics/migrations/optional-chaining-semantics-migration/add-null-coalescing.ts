/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Result of attempting to migrate a single template.
 */
export interface TemplateMigrationResult {
  /** The migrated template text (only meaningful if `fullyMigrated` is true). */
  migrated: string;
  /** Whether ALL `?.` expressions in this template were successfully handled. */
  fullyMigrated: boolean;
  /** Number of `?.` expressions converted to ternaries. */
  migratedCount: number;
  /** Number of `?.` expressions safely left as-is (null/undefined equivalent context). */
  safeAsIsCount: number;
  /** Number of `?.` expressions that could NOT be safely auto-migrated. */
  skippedCount: number;
  /** Whether the template had any `?.` expressions at all. */
  hasSafeNavigation: boolean;
}

/**
 * Attempts to migrate ALL safe navigation expressions in a template.
 *
 * For each `?.` expression in an interpolation, the migration:
 * 1. Checks if the expression is in a "null-safe context" where null and undefined
 *    behave identically — if so, leaves it as-is (no change needed).
 * 2. If the expression is a simple property chain, converts to a ternary:
 *    `a?.b?.c` → `a != null ? (a.b != null ? a.b.c : null) : null`
 * 3. Otherwise marks it as skipped (needs manual review).
 *
 * A template is only modified if ALL expressions were either converted or safe-as-is.
 *
 * **Null-safe contexts (left as-is, no migration needed):**
 * - `{{ a?.b }}` standalone interpolation — Angular renders null/undefined as ""
 * - `a?.b ?? 'fallback'` — `??` catches both null and undefined
 * - `a?.b || 'fallback'` — `||` treats both as falsy
 * - `!a?.b` / `!!a?.b` — negation, both produce same boolean
 * - `a?.b ? x : y` — condition position, truthiness check
 * - `a?.b == null` — loose equality matches both
 *
 * **Must be converted:**
 * - `'prefix' + a?.b` — string concat differs: "prefixnull" vs "prefixundefined"
 * - `a?.b === null` — strict equality differs
 *
 * **Why ternary (not `?? null`):**
 *   `a?.b?.c` where c is genuinely `undefined`:
 *     - `?? null` changes the real `undefined` to `null` — WRONG
 *     - Ternary replicates legacy compiler output exactly
 *   Runtime values don't always match types, so type-aware `?? null` is also unsafe.
 */
export function migrateTemplate(template: string): TemplateMigrationResult {
  let hasSafeNavigation = false;
  let migratedCount = 0;
  let safeAsIsCount = 0;
  let skippedCount = 0;
  let fullyMigrated = true;

  const migrated = template.replace(
    /\{\{([\s\S]*?)\}\}/g,
    (_match: string, exprContent: string) => {
      const trimmed = exprContent.trim();

      if (!trimmed.includes('?.')) {
        return _match;
      }

      hasSafeNavigation = true;

      // Check if the expression is in a null-safe context where null/undefined are equivalent
      if (isNullSafeContext(trimmed)) {
        safeAsIsCount++;
        return _match; // Leave as-is, no change needed
      }

      // Try to convert simple property chain to ternary
      const converted = tryConvertExpression(trimmed);
      if (converted !== null) {
        migratedCount++;
        return `{{ ${converted} }}`;
      }

      // Can't safely migrate
      skippedCount++;
      fullyMigrated = false;
      return _match;
    },
  );

  return {
    migrated: fullyMigrated ? migrated : template,
    fullyMigrated,
    migratedCount,
    safeAsIsCount,
    skippedCount,
    hasSafeNavigation,
  };
}

/**
 * Checks if an expression containing `?.` is in a context where the difference
 * between `null` and `undefined` doesn't matter.
 */
function isNullSafeContext(expr: string): boolean {
  // Standalone expression with no operators — Angular interpolation renders
  // both null and undefined as empty string ""
  if (isSimpleSafeChain(expr)) {
    return true;
  }

  // Has nullish coalescing: a?.b ?? 'fallback' — ?? catches both
  if (expr.includes('??')) {
    return true;
  }

  // Leading negation: !a?.b or !!a?.b — both null/undefined are falsy
  const negStripped = expr.replace(/^!+\s*/, '');
  if (negStripped !== expr && isSimpleSafeChain(negStripped)) {
    return true;
  }

  // Logical OR fallback: a?.b || 'default' — both null/undefined trigger fallback
  if (/\|\|/.test(expr) && !hasTopLevelPipe(expr)) {
    return true;
  }

  // Logical AND: a?.b && x — both null/undefined are falsy, short-circuit same way
  if (/&&/.test(expr)) {
    return true;
  }

  // Loose equality with null: a?.b == null or a?.b != null — matches both
  if (/==\s*null\b/.test(expr) && !/===/.test(expr)) {
    return true;
  }
  if (/!=\s*null\b/.test(expr) && !/!==/.test(expr)) {
    return true;
  }

  // Ternary where ?. is only in condition position: a?.b ? x : y
  // Also handles negated: !a?.b?.c ? x : y
  // Both null/undefined are falsy, so condition evaluates the same
  if (isSafeNavInTernaryCondition(expr)) {
    return true;
  }

  return false;
}

/**
 * Checks if expr is a simple safe chain like `a?.b?.c.d`, `a?.b!.c`, `a?.[0]`
 * (no binary operators, calls, pipes — only property/keyed access with ?. and !.)
 */
function isSimpleSafeChain(expr: string): boolean {
  // Allow identifiers, dots, ?., !., brackets for keyed access, numbers, quotes for string keys
  return /^[a-zA-Z_$][a-zA-Z0-9_$.\[\]'"?!]*$/.test(expr) && expr.includes('?.');
}

/**
 * Checks if the `?.` part is only in the condition of a ternary `cond ? a : b`.
 * Also handles negated conditions: `!a?.b ? x : y`
 */
function isSafeNavInTernaryCondition(expr: string): boolean {
  // Find the first top-level ? that isn't ?. or ??
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (i > 0 && expr[i - 1] === '\\') continue;

    if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar) {
      inString = false;
    }
    if (inString) continue;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;

    if (ch === '?' && depth === 0) {
      const next = i + 1 < expr.length ? expr[i + 1] : '';
      if (next !== '.' && next !== '?') {
        // This is a ternary ?. Check if ?. only appears before this position.
        const condition = expr.substring(0, i);
        const branches = expr.substring(i + 1);
        return condition.includes('?.') && !branches.includes('?.');
      }
    }
  }
  return false;
}

/**
 * Tries to convert a single expression containing `?.` to a ternary form.
 * Returns null if conversion is not safe.
 */
function tryConvertExpression(expr: string): string | null {
  if (expr.includes('??')) return null;
  if (hasTopLevelPipe(expr)) return null;
  if (/[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(expr)) return null;
  if (expr.includes('?.[')) return null;
  // Reject ternary operator (? not followed by . or ?)
  if (/\?[^.?]/.test(expr.replace(/\?\./g, '').replace(/\?\?/g, ''))) return null;

  const segments = parsePropertyChain(expr);
  if (segments === null || segments.length < 2) return null;
  if (!segments.some((s) => s.safe)) return null;

  return buildTernaryFromSegments(segments);
}

interface ChainSegment {
  prop: string;
  safe: boolean;
}

function parsePropertyChain(expr: string): ChainSegment[] | null {
  const identRe = /^[a-zA-Z_$][a-zA-Z0-9_$]*/;
  const first = expr.match(identRe);
  if (!first) return null;

  const segments: ChainSegment[] = [{prop: first[0], safe: false}];
  let pos = first[0].length;

  while (pos < expr.length) {
    if (expr[pos] === '?' && pos + 1 < expr.length && expr[pos + 1] === '.') {
      pos += 2;
      const m = expr.substring(pos).match(identRe);
      if (!m) return null;
      segments.push({prop: m[0], safe: true});
      pos += m[0].length;
    } else if (expr[pos] === '.') {
      pos += 1;
      const m = expr.substring(pos).match(identRe);
      if (!m) return null;
      segments.push({prop: m[0], safe: false});
      pos += m[0].length;
    } else {
      return null;
    }
  }
  return segments;
}

function pathUpTo(segments: ChainSegment[], endIndex: number): string {
  let path = segments[0].prop;
  for (let i = 1; i <= endIndex; i++) {
    path += '.' + segments[i].prop;
  }
  return path;
}

function buildTernaryFromSegments(segments: ChainSegment[]): string {
  const safeIndices: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].safe) safeIndices.push(i);
  }

  const fullPath = pathUpTo(segments, segments.length - 1);
  let result = fullPath;

  for (let si = safeIndices.length - 1; si >= 0; si--) {
    const guard = pathUpTo(segments, safeIndices[si] - 1);
    result = `${guard} != null ? ${result} : null`;
  }
  return result;
}

function hasTopLevelPipe(expr: string): boolean {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (i > 0 && expr[i - 1] === '\\') continue;

    if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar) {
      inString = false;
    }
    if (inString) continue;

    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === '|' && depth === 0 && i + 1 < expr.length && expr[i + 1] !== '|') {
      return true;
    }
  }
  return false;
}

/**
 * Best-effort mode. Falls back to `?? null` for expressions that can't be
 * safely converted to ternaries.
 *
 * **⚠️ DANGEROUS**: `?? null` can incorrectly convert genuinely `undefined`
 * runtime values to `null`. Similar to signal migration's `--best-effort-mode`.
 */
export function migrateTemplateBestEffort(template: string): TemplateMigrationResult {
  let hasSafeNavigation = false;
  let migratedCount = 0;
  let safeAsIsCount = 0;
  let skippedCount = 0;

  const migrated = template.replace(
    /\{\{([\s\S]*?)\}\}/g,
    (_match: string, exprContent: string) => {
      const trimmed = exprContent.trim();
      if (!trimmed.includes('?.')) return _match;

      hasSafeNavigation = true;

      if (isNullSafeContext(trimmed)) {
        safeAsIsCount++;
        return _match;
      }

      if (trimmed.includes('??')) {
        safeAsIsCount++;
        return _match;
      }

      const converted = tryConvertExpression(trimmed);
      if (converted !== null) {
        migratedCount++;
        return `{{ ${converted} }}`;
      }

      // Best-effort fallback: ?? null (DANGEROUS)
      if (hasTopLevelPipe(trimmed)) {
        skippedCount++;
        return _match;
      }

      migratedCount++;
      return `{{ ${trimmed} ?? null }}`;
    },
  );

  return {
    migrated,
    fullyMigrated: skippedCount === 0,
    migratedCount,
    safeAsIsCount,
    skippedCount,
    hasSafeNavigation,
  };
}
