/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {findSafeNavigationExpressions} from './add-null-coalescing';

describe('findSafeNavigationExpressions', () => {
  it('should detect a simple safe property read', () => {
    const result = findSafeNavigationExpressions('{{ user?.name }}');
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should detect a chained safe property read', () => {
    const result = findSafeNavigationExpressions('{{ a?.b?.c }}');
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should detect a safe keyed read', () => {
    const result = findSafeNavigationExpressions(`{{ obj?.['key'] }}`);
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should detect a safe method call', () => {
    const result = findSafeNavigationExpressions('{{ obj?.method() }}');
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should not detect expressions without ?.', () => {
    const result = findSafeNavigationExpressions('{{ user.name }}');
    expect(result.hasSafeNavigation).toBe(false);
    expect(result.expressionCount).toBe(0);
  });

  it('should detect multiple interpolations with ?.', () => {
    const result = findSafeNavigationExpressions(
      '<span>{{ a?.b }}</span><span>{{ c?.d }}</span>',
    );
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(2);
  });

  it('should count only interpolations with ?.', () => {
    const result = findSafeNavigationExpressions(
      '<span>{{ a?.b }}</span><span>{{ c.d }}</span>',
    );
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should not detect in plain text', () => {
    const result = findSafeNavigationExpressions('<span>Hello world</span>');
    expect(result.hasSafeNavigation).toBe(false);
    expect(result.expressionCount).toBe(0);
  });

  it('should not detect in empty template', () => {
    const result = findSafeNavigationExpressions('');
    expect(result.hasSafeNavigation).toBe(false);
    expect(result.expressionCount).toBe(0);
  });

  it('should detect safe navigation inside complex expressions', () => {
    const result = findSafeNavigationExpressions('{{ condition ? a?.b : c?.d }}');
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  it('should detect safe navigation with pipes', () => {
    const result = findSafeNavigationExpressions('{{ user?.name | uppercase }}');
    expect(result.hasSafeNavigation).toBe(true);
    expect(result.expressionCount).toBe(1);
  });

  describe('why ?? null is NOT used as an auto-migration', () => {
    // These tests document the correctness rationale for the analysis-only approach.

    it('should explain: genuinely undefined values must not be changed to null', () => {
      // Given: a?.b?.c where a={b: {c: undefined}}
      // Legacy: a.b is not null, so no short-circuit. Returns a.b.c = undefined.
      // Native: same — a.b is not null, so no short-circuit. Returns a.b.c = undefined.
      // If we added ?? null: undefined ?? null = null — WRONG, changed a real value.
      //
      // This is why this migration only reports, not transforms.
      const result = findSafeNavigationExpressions('{{ a?.b?.c }}');
      expect(result.hasSafeNavigation).toBe(true);
      // The migration reports but does NOT auto-transform.
    });
  });
});
