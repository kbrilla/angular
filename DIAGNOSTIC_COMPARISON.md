# Complete Diagnostic Feature Comparison: STYLE vs ATTR vs CLASS

## Executive Summary

| Feature Area         | Diagnostic Codes | Template Detection | Host Detection | Directive Host Detection | Tests      |
| -------------------- | ---------------- | ------------------ | -------------- | ------------------------ | ---------- |
| **STYLE** ⭐⭐⭐⭐⭐ | 20               | ✅ Full            | ✅ Full        | ✅ Full                  | ✅ Partial |
| **ATTR** ⭐⭐⭐      | 2                | ✅ Full            | ❌ None        | ✅ Full                  | ❌ None    |
| **CLASS** ⭐         | 1                | ⚠️ Suggestion only | ❌ None        | ❌ None                  | ❌ None    |

---

## STYLE Diagnostics (CSS) - Most Complete

### Diagnostic Codes (20 total)

| Code  | Feature                      | What It Detects                        | Template | Component Host | Directive Host | Tested |
| ----- | ---------------------------- | -------------------------------------- | -------- | -------------- | -------------- | ------ |
| 99001 | Unknown CSS property         | Typos in `[style.baground]`            | ✅       | ✅             | ✅             | ✅     |
| 99002 | Invalid CSS unit             | Wrong unit like `.abc`                 | ✅       | ✅             | ✅             | ✅     |
| 99003 | Unknown property in object   | Typos in `[style]="{baground: 'red'}"` | ✅       | ❌             | ❌             | ✅     |
| 99004 | Duplicate in object          | Same property twice in object          | ✅       | ❌             | ❌             | ✅     |
| 99005 | **Conflicting bindings**     | **Template vs host conflicts**         | ✅       | ✅             | ✅             | ❌     |
| 99006 | Unknown in host              | Typos in `host: {'[style.x]': ...}`    | ❌       | ✅             | ❌             | ✅     |
| 99007 | Invalid unit in host         | Wrong unit in host                     | ❌       | ✅             | ❌             | ✅     |
| 99008 | Obsolete property            | Deprecated like `clip`                 | ✅       | ❌             | ❌             | ❌     |
| 99009 | Obsolete in host             | Deprecated in host                     | ❌       | ✅             | ❌             | ❌     |
| 99010 | Obsolete in object           | Deprecated in object                   | ✅       | ❌             | ❌             | ❌     |
| 99011 | Invalid unit value           | Wrong type for `.px` binding           | ✅       | ❌             | ❌             | ❌     |
| 99012 | Invalid unit value in host   | Wrong type in host                     | ❌       | ✅             | ❌             | ❌     |
| 99013 | Invalid unit value in object | Wrong type in object                   | ✅       | ❌             | ❌             | ❌     |
| 99014 | Shorthand override           | `margin` conflicts with `margin-top`   | ✅       | ✅             | ✅             | ❌     |
| 99015 | Prefer numeric unit          | String `'100'` instead of `100`        | ✅       | ❌             | ❌             | ❌     |
| 99016 | Missing unit                 | Number without unit                    | ✅       | ❌             | ❌             | ❌     |
| 99017 | Prefer class over ngClass    | Migration suggestion                   | ✅       | ❌             | ❌             | ❌     |
| 99018 | Prefer individual bindings   | Suggest splitting object               | ✅       | ❌             | ❌             | ❌     |
| 99019 | Prefer style object          | Suggest consolidating                  | ✅       | ❌             | ❌             | ❌     |
| 99020 | Duplicate style binding      | Multiple `[style.x]`                   | ✅       | ❌             | ❌             | ❌     |

### What STYLE Detects

**✅ Template Bindings:**

```html
<div [style.backgroundColor]="color"></div>
<div [style]="{backgroundColor: 'red'}"></div>
<div [ngStyle]="{backgroundColor: 'blue'}"></div>
```

**✅ Component Host Bindings:**

```typescript
@Component({
  host: {
    '[style.backgroundColor]': "'red'",
    '[style]': '{backgroundColor: "blue"}'
  }
})
```

**✅ Directive Host Bindings:**

```typescript
@Directive({
  selector: '[highlight]',
  host: {'[style.backgroundColor]': "'yellow'"}
})
```

**✅ Conflicts Detected:**

- `[style.color]="'red'"` in template vs `host: {'[style.color]': "'blue'"}` in directive ✅
- `[style.margin]` vs `[style.margin-top]` (shorthand conflicts) ✅
- Multiple `[style.color]` bindings ✅
- `[style]="{color: 'red'}"` overriding `[style.color]` ✅

---

## ATTR Diagnostics (Attributes) - Partially Complete

### Diagnostic Codes (2 total)

| Code  | Feature                   | What It Detects                        | Template | Component Host | Directive Host | Tested |
| ----- | ------------------------- | -------------------------------------- | -------- | -------------- | -------------- | ------ |
| 99100 | **Conflicting attribute** | **Template vs binding/host conflicts** | ✅       | ❌             | ✅             | ❌     |
| 99101 | Duplicate attribute       | Multiple `[attr.x]`                    | ✅       | ❌             | ❌             | ❌     |

### What ATTR Detects

**✅ Template Bindings:**

```html
<div [attr.disabled]="true"></div>
<div disabled="true"></div>
```

**❌ Component Host Bindings (NOT DETECTED):**

```typescript
@Component({
  host: {
    '[attr.disabled]': 'true'  // ❌ NOT detected
  }
})
```

**✅ Directive Host Bindings:**

```typescript
@Directive({
  selector: '[myDir]',
  host: {'[attr.disabled]': 'true'}  // ✅ Detected
})
```

**Partial Conflicts Detected:**

- `[attr.disabled]` vs `disabled=""` in template ✅
- `[attr.disabled]` in template vs `host: {'[attr.disabled]': 'true'}` in directive ✅
- `[attr.disabled]` in template vs `host: {'[attr.disabled]': 'true'}` in component ❌ **NOT DETECTED**
- Multiple `[attr.disabled]` in template ✅

### Missing from ATTR

1. ❌ Component host binding detection
2. ❌ Attribute value validation
3. ❌ Boolean attribute validation
4. ❌ ARIA attribute validation (handled separately)
5. ❌ Tests

---

## CLASS Diagnostics - Minimal

### Diagnostic Codes (1 total)

| Code  | Feature                   | What It Detects      | Template | Component Host | Directive Host | Tested |
| ----- | ------------------------- | -------------------- | -------- | -------------- | -------------- | ------ |
| 99017 | Prefer class over ngClass | Migration suggestion | ⚠️       | ❌             | ❌             | ❌     |

### What CLASS Detects

**⚠️ Only Migration Suggestion:**

```html
<!-- Suggests replacing this: -->
<div [ngClass]="{'active': isActive}"></div>
<!-- With this: -->
<div [class.active]="isActive"></div>
```

**❌ NO Conflict Detection:**

```html
<!-- These conflicts are NOT detected: -->
<div class="active" [class.active]="false"></div>
<!-- ❌ Not detected -->
<div [class.active]="true" [class.active]="false"></div>
<!-- ❌ Not detected -->
```

**❌ NO Host Binding Detection:**

```typescript
// These are NOT checked:
@Component({
  host: {'[class.active]': 'true'}  // ❌ Not detected
})
```

###Missing from CLASS

1. ❌ Class name validation
2. ❌ Template vs host class conflicts
3. ❌ Duplicate class binding detection
4. ❌ Static class vs binding conflicts
5. ❌ Component host detection
6. ❌ Directive host detection
7. ❌ Tests
8. ❌ Everything except one migration suggestion!

---

## Summary: What's Implemented

### STYLE (⭐⭐⭐⭐⭐ Excellent)

**Strengths:**

- ✅ 20 comprehensive diagnostic codes
- ✅ Full template + component host + directive host detection
- ✅ Property validation (2000+ CSS properties)
- ✅ Unit validation
- ✅ Conflict detection across all binding types
- ✅ Shorthand/longhand conflict detection
- ✅ Value type validation
- ✅ Obsolete property warnings
- ✅ Code smell suggestions
- ✅ Partial test coverage

**Weaknesses:**

- ⚠️ Some diagnostics not fully tested
- ⚠️ No CSS value validation (e.g., `display: 'flexx'`)

### ATTR (⭐⭐⭐ Good but Incomplete)

**Strengths:**

- ✅ Template binding detection
- ✅ Directive host binding detection
- ✅ Basic conflict detection

**Weaknesses:**

- ❌ NO component host binding detection
- ❌ NO attribute value validation
- ❌ NO tests
- ❌ Only 2 diagnostic codes vs 20 for style
- ❌ Missing many conflict scenarios

### CLASS (⭐ Minimal - Needs Everything)

**Strengths:**

- ⚠️ One migration suggestion

**Weaknesses:**

- ❌ NO conflict detection at all
- ❌ NO validation
- ❌ NO host binding detection
- ❌ NO tests
- ❌ Only 1 diagnostic code
- ❌ Not comparable to STYLE at all

---

## Action Items to Achieve Parity

### ATTR Needs:

1. **Add component host binding detection** (like STYLE has)
   - Detect `host: {'[attr.x]': '...'}` in component
   - Detect conflicts with template bindings

2. **Add more diagnostic codes:**
   - Invalid attribute names
   - Boolean attribute validation
   - Required attribute detection

3. **Add tests** for all diagnostic codes

### CLASS Needs (Almost Everything):

1. **Add all basic diagnostics:**
   - Conflicting class bindings
   - Duplicate class bindings
   - Static vs dynamic conflicts

2. **Add template detection:**
   - `[class.active]` bindings
   - `[class]` bindings
   - Static `class="..."` attributes

3. **Add host binding detection:**
   - Component host class bindings
   - Directive host class bindings
   - Conflicts between template and host

4. **Add validation:**
   - Class name validation
   - CSS class existence checking

5. **Add tests** for everything

---

## Test Coverage

| Feature | Test File                 | Coverage                        |
| ------- | ------------------------- | ------------------------------- |
| STYLE   | `css_diagnostics_spec.ts` | ⚠️ Partial (10/20 codes tested) |
| ATTR    | ❌ None                   | ❌ 0/2 codes tested             |
| CLASS   | ❌ None                   | ❌ 0/1 codes tested             |

**Note:** ATTR and CLASS have NO dedicated test files!
