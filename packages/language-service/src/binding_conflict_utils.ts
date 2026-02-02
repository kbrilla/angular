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
 *
 * IMPORTANT: For bindings that can come from different source files (like host bindings
 * that may come from TypeScript files while template bindings come from HTML files),
 * implementations should set the `spanSourceFile` property to indicate which file
 * the span offsets (`attribute.keySpan`) are relative to.
 *
 * For directive host bindings applied to template elements, use `elementSpan` instead
 * of the directive's keySpan, since the diagnostic should point to the template location.
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
  /**
   * For directive host bindings, the element span where the directive is applied.
   * This ensures diagnostics point to the template location, not the directive definition.
   */
  elementSpan?: {start: number; end: number};
  /**
   * The source file that the span offsets (attribute.keySpan) are relative to.
   * If not set, assumes the diagnostic's source file will be used.
   *
   * IMPORTANT: For host bindings from @HostBinding decorators or host: {} metadata,
   * this should be set to the TypeScript source file, NOT the template file.
   */
  spanSourceFile?: ts.SourceFile;
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
 *
 * IMPORTANT FILE HANDLING:
 * When bindings come from different source files (e.g., template bindings from HTML
 * and host bindings from TypeScript), the diagnostic must use consistent file/span pairs:
 *
 * - `diagnosticSourceFile`: The PRIMARY file where the main diagnostic should appear
 * - Each binding's `spanSourceFile` (if set): Override for that specific binding's span
 * - `getBindingSpan`: Custom function to compute correct spans for each binding
 *
 * For directive host bindings, the `elementSpan` should be used instead of the
 * directive's `keySpan` to keep diagnostics in the template file.
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
  /** The PRIMARY source file for diagnostics (main diagnostic and related info without spanSourceFile) */
  diagnosticSourceFile: ts.SourceFile;
  /** The binding type prefix for messages (e.g., "style", "attr", "class") */
  bindingPrefix: string;
  /** Optional function to format the value snippet for each binding */
  formatValueSnippet?: (binding: T, sourceFile: ts.SourceFile) => string;
  /**
   * Optional function to get the span for a binding (defaults to attribute.keySpan).
   * For directive host bindings, should return elementSpan to keep diagnostic in template.
   * The returned span MUST be consistent with the diagnostic's source file.
   */
  getBindingSpan?: (binding: T, fallbackBinding?: T) => {start: number; end: number};
  /**
   * Optional function to get the source file for a binding's span.
   * Used for `relatedInformation` when bindings come from different files.
   * Defaults to `diagnosticSourceFile` if not provided.
   */
  getBindingSourceFile?: (binding: T) => ts.SourceFile;
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

  // Default source file getter - uses binding's spanSourceFile if available, otherwise diagnostic source file
  const getSourceFile =
    config.getBindingSourceFile || ((b: T) => b.spanSourceFile || diagnosticSourceFile);

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
      // Use per-binding source file for related information to support cross-file diagnostics
      const bindingFile = getSourceFile(b);
      return {
        category: ts.DiagnosticCategory.Message,
        code: 0,
        file: bindingFile,
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

/**
 * Represents information about an @Input that is being shadowed by a binding.
 */
export interface ShadowedInput {
  /** The directive/component class declaration */
  classDecl: ts.ClassDeclaration;
  /** The directive/component name */
  directiveName: string;
  /** The input's property name in the class (e.g., 'className' for @Input('class')) */
  classPropertyName: string;
  /** The input's public alias (e.g., 'class' for @Input('class')) */
  inputAlias: string;
}

/**
 * Configuration for creating shadowing diagnostics.
 * Shadowing occurs when a binding (like [class] or [style]) updates BOTH:
 * 1. A directive's @Input (e.g., @Input('class'))
 * 2. The DOM attribute/property
 *
 * Unlike conflict diagnostics where one binding "wins", in shadowing scenarios
 * BOTH targets are updated with the same value.
 */
export interface ShadowingDiagnosticConfig<T> {
  /** The template binding that shadows the directive input(s) */
  templateBinding: T;
  /** Information about the shadowed directive input(s) */
  shadowedInputs: ShadowedInput[];
  /** The diagnostic code to use */
  diagnosticCode: number;
  /** The severity level */
  severity: ts.DiagnosticCategory;
  /** The source file for diagnostics */
  diagnosticSourceFile: ts.SourceFile;
  /** The binding prefix for messages (e.g., "class", "style") */
  bindingPrefix: string;
  /** Span for the diagnostic (start offset, length) */
  span: {start: number; length: number};
  /** Optional function to find the @Input declaration node for related information */
  findInputDeclaration?: (classDecl: ts.ClassDeclaration, propertyName: string) => ts.Node | null;
}

/**
 * Creates a shadowing diagnostic when a template binding updates both a directive's @Input
 * and the DOM attribute/property.
 *
 * Unlike conflict diagnostics, shadowing diagnostics are INFORMATIONAL - they explain that
 * BOTH targets receive the same value, which is Angular's intentional behavior but may be unexpected.
 *
 * Example diagnostic:
 * ```
 * The [class] binding shadows @Input('class') on directive MyDirective.
 * BOTH the directive input AND the DOM class attribute will be updated with the same value.
 * This is Angular's intentional behavior, but may be unexpected.
 * ```
 */
export function createShadowingDiagnostic<T>(config: ShadowingDiagnosticConfig<T>): ts.Diagnostic {
  const {
    shadowedInputs,
    diagnosticCode,
    severity,
    diagnosticSourceFile,
    bindingPrefix,
    span,
    findInputDeclaration,
  } = config;

  const count = shadowedInputs.length;
  const directiveNames = shadowedInputs.map((s) => s.directiveName).join(', ');

  const messageText =
    `The [${bindingPrefix}] binding shadows @Input('${bindingPrefix}') on ${count === 1 ? 'directive' : count + ' directives'} (${directiveNames}). ` +
    `BOTH the directive input AND the DOM ${bindingPrefix} attribute will be updated with the same value. ` +
    `This is Angular's intentional behavior, but may be unexpected.`;

  const relatedInformation: ts.DiagnosticRelatedInformation[] = [];

  // Add related information pointing to each shadowed @Input declaration
  if (findInputDeclaration) {
    for (const shadowedInput of shadowedInputs) {
      const inputDecl = findInputDeclaration(
        shadowedInput.classDecl,
        shadowedInput.classPropertyName,
      );
      if (inputDecl) {
        relatedInformation.push({
          category: ts.DiagnosticCategory.Message,
          code: 0,
          messageText: `@Input('${shadowedInput.inputAlias}') is declared on directive ${shadowedInput.directiveName}`,
          file: shadowedInput.classDecl.getSourceFile(),
          start: inputDecl.getStart(),
          length: inputDecl.getWidth(),
        });
      }
    }
  }

  const diagnostic: ts.Diagnostic = {
    category: severity,
    code: diagnosticCode,
    messageText,
    file: diagnosticSourceFile,
    start: span.start,
    length: span.length,
    source: 'angular',
    relatedInformation: relatedInformation.length > 0 ? relatedInformation : undefined,
  };

  return diagnostic;
}

/**
 * Configuration for inter-directive shadowing diagnostics.
 * This is when multiple directives on the same element set the same binding.
 */
export interface InterDirectiveShadowingConfig {
  /** The binding name (e.g., 'class', 'style.color') */
  bindingName: string;
  /** List of directives that all set this binding */
  directives: Array<{
    directiveName: string;
    bindingValue?: string;
    sourceFile?: ts.SourceFile;
    span?: {start: number; length: number};
  }>;
  /** The diagnostic code to use */
  diagnosticCode: number;
  /** The severity level */
  severity: ts.DiagnosticCategory;
  /** The source file for diagnostics */
  diagnosticSourceFile: ts.SourceFile;
  /** Span for the diagnostic */
  span: {start: number; length: number};
  /** The binding prefix for messages */
  bindingPrefix: string;
}

/**
 * Creates a diagnostic when multiple directives set the same class/style binding.
 *
 * Example:
 * ```
 * Multiple directives set '${bindingPrefix}.${bindingName}' on this element:
 * - Directive1
 * - Directive2
 * The last directive application order determines the final value.
 * ```
 */
export function createInterDirectiveShadowingDiagnostic(
  config: InterDirectiveShadowingConfig,
): ts.Diagnostic {
  const {bindingName, directives, diagnosticCode, severity, diagnosticSourceFile, span} = config;

  const directiveList = directives.map((d) => `  - ${d.directiveName}`).join('\n');

  const messageText =
    `Multiple directives set '${bindingName}' on this element:\n` +
    `${directiveList}\n` +
    `The last directive in application order determines the final value.`;

  const relatedInformation: ts.DiagnosticRelatedInformation[] = directives
    .filter((d) => d.sourceFile && d.span)
    .map((d) => ({
      category: ts.DiagnosticCategory.Message,
      code: 0,
      messageText: `${d.directiveName} sets ${bindingName}${d.bindingValue ? ` = ${d.bindingValue}` : ''}`,
      file: d.sourceFile!,
      start: d.span!.start,
      length: d.span!.length,
    }));

  return {
    category: severity,
    code: diagnosticCode,
    messageText,
    file: diagnosticSourceFile,
    start: span.start,
    length: span.length,
    source: 'angular',
    relatedInformation: relatedInformation.length > 0 ? relatedInformation : undefined,
  };
}
