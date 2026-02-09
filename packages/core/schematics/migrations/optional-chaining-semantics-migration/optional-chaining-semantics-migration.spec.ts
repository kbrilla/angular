/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {addNullCoalescingToSafeNavigations} from './add-null-coalescing';

describe('addNullCoalescingToSafeNavigations', () => {
  it('should add ?? null to a simple safe property read', () => {
    const result = addNullCoalescingToSafeNavigations('{{ user?.name }}');
    expect(result.migrated).toBe('{{ user?.name ?? null }}');
    expect(result.changed).toBe(true);
    expect(result.replacementCount).toBe(1);
  });

  it('should add ?? null to a chained safe property read', () => {
    const result = addNullCoalescingToSafeNavigations('{{ a?.b?.c }}');
    expect(result.migrated).toBe('{{ a?.b?.c ?? null }}');
    expect(result.changed).toBe(true);
    expect(result.replacementCount).toBe(1);
  });

  it('should add ?? null to a safe keyed read', () => {
    const result = addNullCoalescingToSafeNavigations(`{{ obj?.['key'] }}`);
    expect(result.migrated).toBe(`{{ obj?.['key'] ?? null }}`);
    expect(result.changed).toBe(true);
  });

  it('should add ?? null to a safe method call', () => {
    const result = addNullCoalescingToSafeNavigations('{{ obj?.method() }}');
    expect(result.migrated).toBe('{{ obj?.method() ?? null }}');
    expect(result.changed).toBe(true);
  });

  it('should not modify expressions without ?.', () => {
    const result = addNullCoalescingToSafeNavigations('{{ user.name }}');
    expect(result.migrated).toBe('{{ user.name }}');
    expect(result.changed).toBe(false);
    expect(result.replacementCount).toBe(0);
  });

  it('should not modify expressions that already have ?? null', () => {
    const result = addNullCoalescingToSafeNavigations('{{ user?.name ?? null }}');
    expect(result.migrated).toBe('{{ user?.name ?? null }}');
    expect(result.changed).toBe(false);
  });

  it('should not modify expressions that already have ?? undefined', () => {
    const result = addNullCoalescingToSafeNavigations('{{ user?.name ?? undefined }}');
    expect(result.migrated).toBe('{{ user?.name ?? undefined }}');
    expect(result.changed).toBe(false);
  });

  it('should skip expressions with top-level pipes', () => {
    const result = addNullCoalescingToSafeNavigations('{{ user?.name | uppercase }}');
    expect(result.migrated).toBe('{{ user?.name | uppercase }}');
    expect(result.changed).toBe(false);
  });

  it('should not treat || as a pipe', () => {
    const result = addNullCoalescingToSafeNavigations(`{{ user?.name || 'default' }}`);
    expect(result.migrated).toBe(`{{ user?.name || 'default' ?? null }}`);
    expect(result.changed).toBe(true);
  });

  it('should handle multiple interpolations in one template', () => {
    const result = addNullCoalescingToSafeNavigations(
      '<span>{{ a?.b }}</span><span>{{ c?.d }}</span>',
    );
    expect(result.migrated).toBe(
      '<span>{{ a?.b ?? null }}</span><span>{{ c?.d ?? null }}</span>',
    );
    expect(result.replacementCount).toBe(2);
  });

  it('should handle mixed interpolations (some with ?., some without)', () => {
    const result = addNullCoalescingToSafeNavigations(
      '<span>{{ a?.b }}</span><span>{{ c.d }}</span>',
    );
    expect(result.migrated).toBe('<span>{{ a?.b ?? null }}</span><span>{{ c.d }}</span>');
    expect(result.replacementCount).toBe(1);
  });

  it('should not modify plain text', () => {
    const result = addNullCoalescingToSafeNavigations('<span>Hello world</span>');
    expect(result.migrated).toBe('<span>Hello world</span>');
    expect(result.changed).toBe(false);
  });

  it('should not modify empty template', () => {
    const result = addNullCoalescingToSafeNavigations('');
    expect(result.migrated).toBe('');
    expect(result.changed).toBe(false);
  });

  it('should handle safe navigation inside a ternary expression', () => {
    const result = addNullCoalescingToSafeNavigations('{{ condition ? a?.b : c?.d }}');
    expect(result.migrated).toBe('{{ condition ? a?.b : c?.d ?? null }}');
    expect(result.changed).toBe(true);
  });
});
