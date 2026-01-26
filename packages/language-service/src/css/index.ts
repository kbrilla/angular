/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * CSS Intellisense Module
 *
 * This module provides CSS property completions, validation, and quick fixes
 * for Angular's style bindings like `[style.propertyName]`.
 *
 * Features:
 * - CSS property name completions with fuzzy matching
 * - CSS property value completions for enumerated properties
 * - CSS unit suffix completions (.px, .em, .rem, etc.)
 * - Invalid property name diagnostics with suggestions
 * - Code fixes to correct typos
 * - Quick info (hover) for CSS properties
 */

export {
  // CSS Property Data
  getCSSPropertyNames,
  getCSSPropertyNameSet,
  getCSSPropertyValues,
  getCSSUnitSuffixes,
  isValidCSSProperty,
  isValidCSSUnit,
  findSimilarCSSProperties,
  analyzeStyleBinding,
  kebabToCamelCase,
  camelToKebabCase,
  CSS_UNIT_SUFFIXES,
  CSS_PROPERTY_VALUES,
  type CSSPropertyName,
  type CSSUnitSuffix,
  type StyleBindingAnalysis,
} from './css_properties';

export {
  // CSS Completions
  getCSSPropertyCompletions,
  getCSSUnitCompletions,
  getCSSValueCompletions,
  createCSSPropertyDiagnostic,
  getCSSPropertyQuickInfo,
  getCSSPropertyCodeFixes,
  DEFAULT_CSS_COMPLETIONS_CONFIG,
  type CSSCompletionsConfig,
} from './css_completions';

export {
  // CSS Diagnostics
  getCssDiagnostics,
  DEFAULT_CSS_DIAGNOSTICS_CONFIG,
  type CssDiagnosticsConfig,
} from './css_diagnostics';
