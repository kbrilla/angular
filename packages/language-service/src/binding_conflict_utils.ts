/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {TmplAstBoundAttribute} from '@angular/compiler';
import ts from 'typescript';

/**
 * Shared binding types across different binding kinds (style, attribute, class).
 * Template bindings always have higher precedence (lower number) than host bindings.
 */
export type BaseBindingType =
  | 'individual' // Template individual binding (e.g., [style.color], [attr.disabled], [class.foo])
  | 'objectLiteral' // Template object binding (e.g., [style]="...", [attr]="..." if supported)
  | 'directive' // Template structural directive binding (e.g., [ngStyle], [ngClass])
  | 'hostIndividual' // Component host individual binding
  | 'hostObjectLiteral' // Component host object binding
  | 'hostDirectiveIndividual' // Host directive individual binding (from hostDirectives: [...])
  | 'directiveHostIndividual'; // Directive host individual binding (from regular directives in template)

/**
 * Maps binding types to their precedence order.
 * Lower numbers = higher precedence (wins in conflicts).
 * Template bindings (1-3) always win over host bindings (4-6).
 */
export const BASE_BINDING_PRECEDENCE: Record<BaseBindingType, number> = {
  individual: 1,
  objectLiteral: 2,
  directive: 3,
  hostIndividual: 4,
  hostObjectLiteral: 5,
  hostDirectiveIndividual: 6,
  directiveHostIndividual: 7,
};

/**
 * Base binding information that can be extended for specific binding types.
 */
export interface BaseBinding {
  /** The binding type determines precedence */
  bindingType: BaseBindingType;
  /** The original property/attribute/class name as written */
  originalName: string;
  /** The normalized property/attribute/class name (for grouping conflicts) */
  normalizedName: string;
  /** The bound attribute from the template AST */
  attribute: TmplAstBoundAttribute;
  /** For directive host bindings, the directive name */
  directiveName?: string;
  /** For directive host bindings, the element span where the directive is applied */
  elementSpan?: {start: number; end: number};
}

/**
 * Gets a human-readable description of a binding type for diagnostic messages.
 */
export function getBindingTypeDescription(
  type: BaseBindingType,
  directiveName?: string,
  prefix: string = 'binding',
): string {
  switch (type) {
    case 'individual':
      return `template [${prefix}.property]`;
    case 'objectLiteral':
      return `template [${prefix}]`;
    case 'directive':
      // For directives, capitalize (ngStyle, ngClass)
      return `template [ng${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}]`;
    case 'hostIndividual':
      return `component host [${prefix}.property]`;
    case 'hostObjectLiteral':
      return `component host [${prefix}]`;
    case 'hostDirectiveIndividual':
      return directiveName ? `host directive ${directiveName} binding` : 'host directive binding';
    case 'directiveHostIndividual':
      return directiveName ? `directive ${directiveName} host binding` : 'directive host binding';
  }
}

/**
 * Configuration for creating conflict diagnostics.
 */
export interface ConflictDiagnosticConfig<T extends BaseBinding> {
  /** All bindings for a single property/attribute/class */
  bindings: T[];
  /** The property/attribute/class name for display (may be kebab-cased or camelCased) */
  displayName: string;
  /** The diagnostic code to use */
  diagnosticCode: number;
  /** The severity level */
  severity: ts.DiagnosticCategory;
  /** The source file for diagnostics */
  diagnosticSourceFile: ts.SourceFile;
  /** The binding type prefix for messages (e.g., "style", "attr", "class") */
  bindingPrefix: string;
  /** Optional function to format the value snippet for each binding */
  formatValueSnippet?: (binding: T, sourceFile: ts.SourceFile) => string;
  /** Optional function to get the span for a binding (defaults to attribute.keySpan) */
  getBindingSpan?: (binding: T, fallbackBinding?: T) => {start: number; end: number};
}

/**
 * Creates a conflict diagnostic when multiple bindings for the same property have different precedence.
 *
 * This generates a detailed diagnostic message with:
 * - Total count of conflicting bindings
 * - Numbered list showing precedence order (first wins)
 * - Value snippets for each binding
 * - Summary explaining which binding type wins
 * - Related information for all non-losing bindings
 *
 * Example output:
 * ```
 * CSS property 'background-color' is set via 3 different bindings with conflicting precedence.
 * Precedence order (first wins):
 * 1. background-color from [style.background-color] — value: 'red' (template [style.property]) - WINS
 * 2. backgroundColor from [style]="..." (component host [style.property])
 * 3. backgroundColor from directive MyDirective host binding
 *
 * The template [style.property] binding takes precedence over component host [style.property].
 * ```
 */
export function createConflictDiagnostic<T extends BaseBinding>(
  config: ConflictDiagnosticConfig<T>,
): ts.Diagnostic {
  const {bindings, displayName, diagnosticCode, severity, diagnosticSourceFile, bindingPrefix} =
    config;

  // Sort bindings by precedence (lowest number = highest precedence = wins)
  const sorted = [...bindings].sort(
    (a, b) => BASE_BINDING_PRECEDENCE[a.bindingType] - BASE_BINDING_PRECEDENCE[b.bindingType],
  );

  const winner = sorted[0];

  // Default span getter
  const defaultGetBindingSpan = (b: T, fallbackBinding?: T) => {
    // For directive host bindings, prefer the element span (where directive is applied)
    if (b.bindingType === 'directiveHostIndividual' && b.elementSpan) {
      return b.elementSpan;
    }
    // Fallback to the attribute key span
    return {
      start: b.attribute.keySpan.start.offset,
      end: b.attribute.keySpan.end.offset,
    };
  };

  const getSpan = config.getBindingSpan || defaultGetBindingSpan;

  // Default value snippet formatter
  const defaultFormatValueSnippet = (b: T, sourceFile: ts.SourceFile) => {
    if (b.attribute.valueSpan) {
      const text = sourceFile.getFullText();
      const start = b.attribute.valueSpan.start.offset;
      const end = b.attribute.valueSpan.end.offset;
      const raw = text.slice(start, end).trim();
      return raw ? ` — value: ${raw}` : '';
    }
    return '';
  };

  const formatValue = config.formatValueSnippet || defaultFormatValueSnippet;

  // Build the precedence list
  const renderBinding = (b: T, idx: number): string => {
    const nameDisplay = b.originalName;
    const valueSnippet = formatValue(b, diagnosticSourceFile);
    const typeDesc = getBindingTypeDescription(b.bindingType, b.directiveName, bindingPrefix);
    const winsLabel = idx === 0 ? ' - WINS' : '';
    return `${idx + 1}. ${nameDisplay} from [${b.attribute.name}]${valueSnippet} (${typeDesc})${winsLabel}`;
  };

  const precedenceList = sorted.map((b, idx) => renderBinding(b, idx)).join('\n');

  // Create summary sentence
  const second = sorted[1];
  const winnerDesc = getBindingTypeDescription(
    winner.bindingType,
    winner.directiveName,
    bindingPrefix,
  );
  const secondDesc = getBindingTypeDescription(
    second.bindingType,
    second.directiveName,
    bindingPrefix,
  );
  const summary = `The ${winnerDesc} binding takes precedence over ${secondDesc}.`;

  // The diagnostic is placed on the lowest precedence (losing) binding
  const lowestPrecedence = sorted[sorted.length - 1];
  const lowestSpan = getSpan(lowestPrecedence, winner);

  // Create the main diagnostic
  const diagnostic: ts.Diagnostic = {
    category: severity,
    code: diagnosticCode,
    messageText:
      `${bindingPrefix.charAt(0).toUpperCase()}${bindingPrefix.slice(1)} '${displayName}' is set via ${bindings.length} different bindings with conflicting precedence.\n` +
      `Precedence order (first wins):\n${precedenceList}\n\n${summary}`,
    file: diagnosticSourceFile,
    start: lowestSpan.start,
    length: lowestSpan.end - lowestSpan.start,
    source: 'angular',
    relatedInformation: sorted.slice(0, -1).map((b, idx) => {
      const span = getSpan(b);
      const typeDesc = getBindingTypeDescription(b.bindingType, b.directiveName, bindingPrefix);
      const winsLabel = idx === 0 ? ' - WINS' : '';
      return {
        category: ts.DiagnosticCategory.Message,
        code: 0,
        file: diagnosticSourceFile,
        start: span.start,
        length: span.end - span.start,
        messageText: `${b.originalName} from [${b.attribute.name}] (${typeDesc})${winsLabel}`,
      };
    }),
  };

  return diagnostic;
}

/**
 * Groups bindings by their normalized name and detects conflicts.
 * Returns a map of normalized names to arrays of bindings.
 */
export function groupBindingsByName<T extends BaseBinding>(bindings: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const binding of bindings) {
    const existing = grouped.get(binding.normalizedName) || [];
    existing.push(binding);
    grouped.set(binding.normalizedName, existing);
  }
  return grouped;
}

/**
 * Detects conflicts within grouped bindings and creates diagnostics for each conflict.
 * A conflict exists when multiple bindings for the same property have different precedence levels.
 */
export function detectConflicts<T extends BaseBinding>(
  groupedBindings: Map<string, T[]>,
  config: Omit<ConflictDiagnosticConfig<T>, 'bindings' | 'displayName'>,
): ts.Diagnostic[] {
  const diagnostics: ts.Diagnostic[] = [];

  for (const [normalizedName, bindings] of groupedBindings) {
    if (bindings.length < 2) continue;

    // Check if there are different precedence levels
    const precedenceLevels = new Set(bindings.map((b) => BASE_BINDING_PRECEDENCE[b.bindingType]));

    if (precedenceLevels.size > 1) {
      // There's a conflict - multiple precedence levels
      // Use the first binding's original name for display
      const displayName = bindings[0].originalName;

      const diagnostic = createConflictDiagnostic({
        ...config,
        bindings,
        displayName,
      });

      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}
