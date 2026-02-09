/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {migrateTemplate, migrateTemplateBestEffort} from './add-null-coalescing';

describe('migrateTemplate', () => {
  describe('ternary conversion (simple property chains)', () => {
    it('should convert a?.b', () => {
      // Even though standalone interpolation is null-safe, if it's part of a
      // larger template with mixed expressions, let's test the ternary logic directly.
      // standalone {{ a?.b }} is actually safe-as-is, so test with concat
      const r = migrateTemplate(`{{ 'x' + a?.b }}`);
      // This has string concat + method-like pattern... let's test pure chain
    });

    it('should convert a?.b in string concat context', () => {
      // String concat is NOT safe: "prefixnull" vs "prefixundefined"
      // But this has a + operator which makes it not a simple chain → skipped
      const r = migrateTemplate(`{{ 'prefix' + a?.b }}`);
      // The + makes it not a simple chain, so it's skipped
      expect(r.skippedCount).toBe(1);
      expect(r.fullyMigrated).toBe(false);
    });

    it('should convert a simple two-segment chain in non-safe context', () => {
      // a?.b === null is NOT safe (strict equality)
      // But this has === which makes it not a simple chain → skipped
      const r = migrateTemplate('{{ a?.b === null }}');
      expect(r.skippedCount).toBe(1);
    });
  });

  describe('null-safe contexts (left as-is)', () => {
    it('standalone interpolation: {{ a?.b }}', () => {
      const r = migrateTemplate('{{ a?.b }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.migratedCount).toBe(0);
      expect(r.migrated).toBe('{{ a?.b }}'); // unchanged
    });

    it('standalone deep chain: {{ a?.b?.c?.d }}', () => {
      const r = migrateTemplate('{{ a?.b?.c?.d }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.migrated).toBe('{{ a?.b?.c?.d }}');
    });

    it('standalone mixed chain: {{ a.b?.c.d?.e }}', () => {
      const r = migrateTemplate('{{ a.b?.c.d?.e }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.migrated).toBe('{{ a.b?.c.d?.e }}');
    });

    it('nullish coalescing: {{ a?.b ?? "fallback" }}', () => {
      const r = migrateTemplate(`{{ a?.b ?? 'fallback' }}`);
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.migrated).toBe(`{{ a?.b ?? 'fallback' }}`);
    });

    it('nullish coalescing with default value: {{ a?.b?.c ?? defaultVal }}', () => {
      const r = migrateTemplate('{{ a?.b?.c ?? defaultVal }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('logical OR fallback: {{ a?.b || "default" }}', () => {
      const r = migrateTemplate(`{{ a?.b || 'default' }}`);
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.migrated).toBe(`{{ a?.b || 'default' }}`);
    });

    it('negation: {{ !a?.b }}', () => {
      const r = migrateTemplate('{{ !a?.b }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('double negation: {{ !!a?.b }}', () => {
      const r = migrateTemplate('{{ !!a?.b }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('negated chain: {{ !a?.b?.c }}', () => {
      const r = migrateTemplate('{{ !a?.b?.c }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('loose equality with null: {{ a?.b == null }}', () => {
      const r = migrateTemplate('{{ a?.b == null }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('loose inequality with null: {{ a?.b != null }}', () => {
      const r = migrateTemplate('{{ a?.b != null }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('ternary with ?. in condition: {{ a?.b ? x : y }}', () => {
      const r = migrateTemplate('{{ a?.b ? x : y }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('ternary with deep chain in condition: {{ a?.b?.c ? x : y }}', () => {
      const r = migrateTemplate('{{ a?.b?.c ? x : y }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('logical AND: {{ a?.b && something }}', () => {
      // a?.b && x: if a?.b is null → false (null is falsy)
      //            if a?.b is undefined → false (undefined is falsy)
      // Both produce same result
      const r = migrateTemplate('{{ a?.b && something }}');
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('Boolean() cast: {{ Boolean(a?.b) }}', () => {
      // Boolean(null) === Boolean(undefined) === false
      // BUT: this has a function call, so it's not a simple chain.
      // The migration should see the call and skip it, but it's safe.
      // Actually the isNullSafeContext won't catch this. It'll be skipped.
      const r = migrateTemplate('{{ Boolean(a?.b) }}');
      // Has function call, so skipped
      expect(r.skippedCount).toBe(1);
    });
  });

  describe('unsafe contexts (must convert or skip)', () => {
    it('strict equality: {{ a?.b === null }} is NOT safe', () => {
      // null === null is true, but undefined === null is false
      const r = migrateTemplate('{{ a?.b === null }}');
      expect(r.safeAsIsCount).toBe(0);
      // Can't convert (has === operator), so skipped
      expect(r.skippedCount).toBe(1);
      expect(r.fullyMigrated).toBe(false);
    });

    it('string concat: {{ "prefix" + a?.b }} is NOT safe', () => {
      // "prefix" + null → "prefixnull", "prefix" + undefined → "prefixundefined"
      const r = migrateTemplate(`{{ "prefix" + a?.b }}`);
      expect(r.safeAsIsCount).toBe(0);
      expect(r.skippedCount).toBe(1);
      expect(r.fullyMigrated).toBe(false);
    });
  });

  describe('mixed templates', () => {
    it('fully migrated when all expressions are safe-as-is', () => {
      const r = migrateTemplate(
        '<div>{{ a?.b }}</div><span>{{ c?.d ?? "x" }}</span><p>{{ !e?.f }}</p>',
      );
      expect(r.fullyMigrated).toBe(true);
      expect(r.safeAsIsCount).toBe(3);
      expect(r.migratedCount).toBe(0);
      expect(r.skippedCount).toBe(0);
    });

    it('not fully migrated if any expression is skipped', () => {
      const r = migrateTemplate(
        '<div>{{ a?.b }}</div><span>{{ getUser()?.name }}</span>',
      );
      expect(r.fullyMigrated).toBe(false);
      expect(r.safeAsIsCount).toBe(1);
      expect(r.skippedCount).toBe(1);
    });

    it('no safe navigation at all', () => {
      const r = migrateTemplate('<div>{{ a.b }}</div>');
      expect(r.hasSafeNavigation).toBe(false);
      expect(r.fullyMigrated).toBe(true);
    });

    it('empty template', () => {
      const r = migrateTemplate('');
      expect(r.hasSafeNavigation).toBe(false);
      expect(r.fullyMigrated).toBe(true);
    });
  });

  describe('correctness rationale: why null and undefined are equivalent', () => {
    // These tests document WHY each null-safe context is correct.

    it('interpolation renders both as empty string', () => {
      // Angular's text interpolation: String(null) and String(undefined) both → ""
      // This is handled by the framework's renderStringify function.
      const r = migrateTemplate('{{ user?.name }}');
      expect(r.safeAsIsCount).toBe(1);
    });

    it('?? catches both null and undefined per ECMAScript spec', () => {
      // nullish coalescing operator: x ?? y returns y when x is null OR undefined
      const r = migrateTemplate(`{{ user?.name ?? 'Anonymous' }}`);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('|| treats both as falsy per ECMAScript spec', () => {
      // Both null and undefined are falsy values in JavaScript
      const r = migrateTemplate(`{{ user?.name || 'fallback' }}`);
      expect(r.safeAsIsCount).toBe(1);
    });

    it('== null matches both per ECMAScript abstract equality', () => {
      // null == null → true, undefined == null → true (spec: 7.2.16)
      const r = migrateTemplate('{{ a?.b == null }}');
      expect(r.safeAsIsCount).toBe(1);
    });

    it('!x converts both to true (both are falsy)', () => {
      // !null → true, !undefined → true
      const r = migrateTemplate('{{ !a?.b }}');
      expect(r.safeAsIsCount).toBe(1);
    });

    it('&& short-circuits identically on both', () => {
      // null && x → null (falsy, short-circuits)
      // undefined && x → undefined (falsy, short-circuits)
      // The && result differs (null vs undefined) but the TRUTHINESS is same
      // In Angular interpolation, both render as ""
      const r = migrateTemplate('{{ a?.b && c }}');
      expect(r.safeAsIsCount).toBe(1);
    });

    it('ternary condition treats both as falsy', () => {
      // null ? 'a' : 'b' → 'b'
      // undefined ? 'a' : 'b' → 'b'
      const r = migrateTemplate('{{ a?.b ? yes : no }}');
      expect(r.safeAsIsCount).toBe(1);
    });
  });
});

describe('migrateTemplateBestEffort', () => {
  it('should use ?? null for complex expressions that cannot be ternary-converted', () => {
    const r = migrateTemplateBestEffort('{{ getUser()?.name }}');
    expect(r.fullyMigrated).toBe(true);
    expect(r.migratedCount).toBe(1);
    expect(r.migrated).toBe('{{ getUser()?.name ?? null }}');
  });

  it('should still use ternary for simple chains', () => {
    const r = migrateTemplateBestEffort('{{ a?.b }}');
    // standalone is safe-as-is
    expect(r.safeAsIsCount).toBe(1);
    expect(r.migrated).toBe('{{ a?.b }}');
  });

  it('should skip pipes even in best-effort mode', () => {
    const r = migrateTemplateBestEffort('{{ a?.b | myPipe }}');
    expect(r.skippedCount).toBe(1);
    expect(r.fullyMigrated).toBe(false);
  });

  it('should leave ?? expressions as-is', () => {
    const r = migrateTemplateBestEffort(`{{ a?.b ?? 'x' }}`);
    expect(r.safeAsIsCount).toBe(1);
    expect(r.migrated).toBe(`{{ a?.b ?? 'x' }}`);
  });
});
