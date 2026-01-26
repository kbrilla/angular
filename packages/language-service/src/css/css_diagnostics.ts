/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  AST,
  ASTWithSource,
  BindingType,
  LiteralMap,
  PropertyRead,
  Call,
  TmplAstBoundAttribute,
  TmplAstDeferredBlock,
  TmplAstDeferredBlockError,
  TmplAstDeferredBlockLoading,
  TmplAstDeferredBlockPlaceholder,
  TmplAstElement,
  TmplAstForLoopBlock,
  TmplAstForLoopBlockEmpty,
  TmplAstIfBlock,
  TmplAstIfBlockBranch,
  TmplAstNode,
  TmplAstSwitchBlock,
  TmplAstSwitchBlockCaseGroup,
  TmplAstTemplate,
  tmplAstVisitAll,
  TmplAstVisitor,
  TmplAstHostElement,
} from '@angular/compiler';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import ts from 'typescript';

import {
  isValidCSSProperty,
  findSimilarCSSProperties,
  isValidCSSUnit,
  kebabToCamelCase,
} from './css_properties';

/**
 * CSS diagnostic codes for the Angular Language Service.
 * These are in a separate range from Angular's core diagnostic codes.
 */
export const enum CssDiagnosticCode {
  /** Unknown CSS property name in style binding. */
  UNKNOWN_CSS_PROPERTY = 99001,
  /** Invalid CSS unit suffix in style binding. */
  INVALID_CSS_UNIT = 99002,
  /** Unknown CSS property name in style object literal. */
  UNKNOWN_CSS_PROPERTY_IN_OBJECT = 99003,
  /** Unknown CSS property name in host binding. */
  UNKNOWN_CSS_PROPERTY_IN_HOST = 99004,
  /** Invalid CSS unit suffix in host binding. */
  INVALID_CSS_UNIT_IN_HOST = 99005,
}

/**
 * Configuration for CSS diagnostics.
 */
export interface CssDiagnosticsConfig {
  /** Whether CSS property validation is enabled. */
  enabled: boolean;
  /** Severity level for unknown CSS property diagnostics. */
  severity: 'error' | 'warning' | 'suggestion';
}

/**
 * Default configuration for CSS diagnostics.
 */
export const DEFAULT_CSS_DIAGNOSTICS_CONFIG: CssDiagnosticsConfig = {
  enabled: true,
  severity: 'warning',
};

/**
 * Gets CSS-related diagnostics for a component's template and host bindings.
 *
 * This validates CSS property names in style bindings like `[style.propertyName]`
 * and reports diagnostics for unknown properties.
 *
 * Validates:
 * - Template style bindings: `[style.propertyName]`, `[style]="{...}"`
 * - Host bindings: `@HostBinding('style.propertyName')` and `host: { '[style.propertyName]': ... }`
 *
 * @param component The component class declaration.
 * @param compiler The Angular compiler instance.
 * @param config Optional configuration for diagnostics.
 * @returns Array of CSS diagnostics.
 */
export function getCssDiagnostics(
  component: ts.ClassDeclaration,
  compiler: NgCompiler,
  config: CssDiagnosticsConfig = DEFAULT_CSS_DIAGNOSTICS_CONFIG,
): ts.Diagnostic[] {
  if (!config.enabled) {
    return [];
  }

  const templateTypeChecker = compiler.getTemplateTypeChecker();
  const diagnostics: ts.Diagnostic[] = [];
  const severity = getDiagnosticCategory(config.severity);

  // Validate template style bindings
  const template = templateTypeChecker.getTemplate(component);
  if (template !== null) {
    const visitor = new CssBindingVisitor(component, diagnostics, severity);
    tmplAstVisitAll(visitor, template);
  }

  // Validate host element bindings (@HostBinding and host: {...})
  const hostElement = templateTypeChecker.getHostElement(component);
  if (hostElement !== null) {
    validateHostBindings(hostElement, component, diagnostics, severity);
  }

  return diagnostics;
}

/**
 * Validates CSS properties in host element bindings.
 * This includes @HostBinding('style.propertyName') and host: { '[style.propertyName]': ... }
 */
function validateHostBindings(
  hostElement: TmplAstHostElement,
  component: ts.ClassDeclaration,
  diagnostics: ts.Diagnostic[],
  severity: ts.DiagnosticCategory,
): void {
  for (const binding of hostElement.bindings) {
    // Check if this is a style binding
    if (binding.type === BindingType.Style) {
      validateHostStyleBinding(binding, component, diagnostics, severity);
    }
  }
}

/**
 * Validates a single host style binding for valid CSS property and unit.
 */
function validateHostStyleBinding(
  binding: TmplAstBoundAttribute,
  component: ts.ClassDeclaration,
  diagnostics: ts.Diagnostic[],
  severity: ts.DiagnosticCategory,
): void {
  const propertyName = binding.name;
  const unit = binding.unit;

  // Skip CSS custom properties (--var-name)
  if (propertyName.startsWith('--')) {
    return;
  }

  // Convert kebab-case to camelCase for validation
  const normalizedName = propertyName.includes('-') ? kebabToCamelCase(propertyName) : propertyName;

  // Validate CSS property name
  if (!isValidCSSProperty(normalizedName)) {
    const suggestions = findSimilarCSSProperties(normalizedName);
    let message = `Unknown CSS property '${propertyName}' in host binding.`;
    if (suggestions.length > 0) {
      message += ` Did you mean '${suggestions[0]}'?`;
      if (suggestions.length > 1) {
        message += ` Other suggestions: ${suggestions.slice(1).join(', ')}.`;
      }
    }

    diagnostics.push({
      category: severity,
      code: CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_HOST,
      messageText: message,
      file: component.getSourceFile(),
      start: binding.keySpan.start.offset,
      length: binding.keySpan.end.offset - binding.keySpan.start.offset,
      source: 'angular',
    });
  }

  // Validate CSS unit suffix (if present)
  if (unit !== null && !isValidCSSUnit(unit)) {
    diagnostics.push({
      category: severity,
      code: CssDiagnosticCode.INVALID_CSS_UNIT_IN_HOST,
      messageText: `Unknown CSS unit '${unit}' in host binding. Valid units include: px, em, rem, %, vh, vw, s, ms, deg, etc.`,
      file: component.getSourceFile(),
      start: binding.keySpan.end.offset - unit.length,
      length: unit.length,
      source: 'angular',
    });
  }
}

/**
 * Converts severity string to TypeScript DiagnosticCategory.
 */
function getDiagnosticCategory(
  severity: 'error' | 'warning' | 'suggestion',
): ts.DiagnosticCategory {
  switch (severity) {
    case 'error':
      return ts.DiagnosticCategory.Error;
    case 'warning':
      return ts.DiagnosticCategory.Warning;
    case 'suggestion':
      return ts.DiagnosticCategory.Suggestion;
  }
}

/**
 * AST visitor that collects CSS diagnostics from style bindings.
 */
class CssBindingVisitor implements TmplAstVisitor<void> {
  constructor(
    private readonly component: ts.ClassDeclaration,
    private readonly diagnostics: ts.Diagnostic[],
    private readonly severity: ts.DiagnosticCategory,
  ) {}

  visitBoundAttribute(attribute: TmplAstBoundAttribute): void {
    // Handle individual style property bindings: [style.width], [style.backgroundColor.px]
    if (attribute.type === BindingType.Style) {
      this.validateIndividualStyleBinding(attribute);
      return;
    }

    // Handle style object bindings: [style]="{...}" or [ngStyle]="{...}"
    if (attribute.name === 'style' || attribute.name === 'ngStyle') {
      this.validateStyleObjectBinding(attribute);
    }
  }

  /**
   * Validates individual style bindings like [style.width] or [style.backgroundColor.px]
   */
  private validateIndividualStyleBinding(attribute: TmplAstBoundAttribute): void {
    // Parse the style binding name
    // Format: "propertyName" or "propertyName.unit"
    const fullName = attribute.name;
    const parts = fullName.split('.');

    // The first part after 'style' is the property name (already parsed by Angular)
    // Note: For [style.width], attribute.name will be 'width', not 'style.width'
    const propertyName = parts[0];
    const unit = attribute.unit;

    // Skip CSS custom properties (--var-name)
    if (propertyName.startsWith('--')) {
      return;
    }

    // Convert kebab-case to camelCase for validation
    // Both 'backgroundColor' and 'background-color' are valid in style bindings
    const normalizedName = propertyName.includes('-')
      ? kebabToCamelCase(propertyName)
      : propertyName;

    // Validate CSS property name
    if (!isValidCSSProperty(normalizedName)) {
      const suggestions = findSimilarCSSProperties(normalizedName);
      let message = `Unknown CSS property '${propertyName}'.`;
      if (suggestions.length > 0) {
        message += ` Did you mean '${suggestions[0]}'?`;
        if (suggestions.length > 1) {
          message += ` Other suggestions: ${suggestions.slice(1).join(', ')}.`;
        }
      }

      this.diagnostics.push({
        category: this.severity,
        code: CssDiagnosticCode.UNKNOWN_CSS_PROPERTY,
        messageText: message,
        file: this.component.getSourceFile(),
        start: attribute.keySpan.start.offset,
        length: attribute.keySpan.end.offset - attribute.keySpan.start.offset,
        source: 'angular',
      });
    }

    // Validate CSS unit suffix (if present)
    if (unit !== null && !isValidCSSUnit(unit)) {
      this.diagnostics.push({
        category: this.severity,
        code: CssDiagnosticCode.INVALID_CSS_UNIT,
        messageText: `Unknown CSS unit '${unit}'. Valid units include: px, em, rem, %, vh, vw, s, ms, deg, etc.`,
        file: this.component.getSourceFile(),
        start: attribute.keySpan.end.offset - unit.length,
        length: unit.length,
        source: 'angular',
      });
    }
  }

  /**
   * Validates style object bindings like [style]="{backgroundColor: 'red'}"
   * or [ngStyle]="{'background-color': 'red'}"
   */
  private validateStyleObjectBinding(attribute: TmplAstBoundAttribute): void {
    const value = attribute.value;

    // Unwrap ASTWithSource to get the actual expression
    const expr = value instanceof ASTWithSource ? value.ast : value;

    // Only validate object literals (LiteralMap)
    // For method calls or property reads, we'd need type checking
    if (expr instanceof LiteralMap) {
      this.validateStyleLiteralMap(expr, attribute);
    }
  }

  /**
   * Validates a LiteralMap expression used as a style object.
   * Checks each key to ensure it's a valid CSS property name.
   */
  private validateStyleLiteralMap(literalMap: LiteralMap, attribute: TmplAstBoundAttribute): void {
    for (const key of literalMap.keys) {
      // Skip spread keys (e.g., { ...spreadStyles })
      if (key.kind === 'spread') {
        continue;
      }

      const propertyName = key.key;

      // Skip CSS custom properties (--var-name)
      if (propertyName.startsWith('--')) {
        continue;
      }

      // Convert kebab-case to camelCase for validation
      // Both 'backgroundColor' and 'background-color' are valid in [ngStyle]
      const normalizedName = propertyName.includes('-')
        ? kebabToCamelCase(propertyName)
        : propertyName;

      if (!isValidCSSProperty(normalizedName)) {
        const suggestions = findSimilarCSSProperties(normalizedName);
        let message = `Unknown CSS property '${propertyName}'.`;
        if (suggestions.length > 0) {
          message += ` Did you mean '${suggestions[0]}'?`;
          if (suggestions.length > 1) {
            message += ` Other suggestions: ${suggestions.slice(1).join(', ')}.`;
          }
        }

        // Calculate position based on key span
        // The key sourceSpan gives us the absolute position
        const keyStart = key.sourceSpan.start;
        const keyLength = key.sourceSpan.end - key.sourceSpan.start;

        this.diagnostics.push({
          category: this.severity,
          code: CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
          messageText: message,
          file: this.component.getSourceFile(),
          start: keyStart,
          length: keyLength,
          source: 'angular',
        });
      }
    }
  }

  // Required visitor methods - must visit children to find nested style bindings
  visitElement(element: TmplAstElement): void {
    tmplAstVisitAll(this, element.attributes);
    tmplAstVisitAll(this, element.inputs);
    tmplAstVisitAll(this, element.children);
  }
  visitTemplate(template: TmplAstTemplate): void {
    tmplAstVisitAll(this, template.templateAttrs);
    tmplAstVisitAll(this, template.inputs);
    tmplAstVisitAll(this, template.children);
  }
  visitContent(): void {}
  visitVariable(): void {}
  visitReference(): void {}
  visitTextAttribute(): void {}
  visitBoundText(): void {}
  visitText(): void {}
  visitIcu(): void {}
  visitBoundEvent(): void {}
  visitDeferredBlock(deferred: TmplAstDeferredBlock): void {
    tmplAstVisitAll(this, deferred.children);
    if (deferred.placeholder) {
      tmplAstVisitAll(this, deferred.placeholder.children);
    }
    if (deferred.loading) {
      tmplAstVisitAll(this, deferred.loading.children);
    }
    if (deferred.error) {
      tmplAstVisitAll(this, deferred.error.children);
    }
  }
  visitDeferredBlockPlaceholder(block: TmplAstDeferredBlockPlaceholder): void {
    tmplAstVisitAll(this, block.children);
  }
  visitDeferredBlockError(block: TmplAstDeferredBlockError): void {
    tmplAstVisitAll(this, block.children);
  }
  visitDeferredBlockLoading(block: TmplAstDeferredBlockLoading): void {
    tmplAstVisitAll(this, block.children);
  }
  visitDeferredTrigger(): void {}
  visitSwitchBlock(block: TmplAstSwitchBlock): void {
    for (const group of block.groups) {
      tmplAstVisitAll(this, group.children);
    }
  }
  visitSwitchBlockCase(): void {}
  visitSwitchBlockCaseGroup(group: TmplAstSwitchBlockCaseGroup): void {
    tmplAstVisitAll(this, group.children);
  }
  visitForLoopBlock(block: TmplAstForLoopBlock): void {
    tmplAstVisitAll(this, block.children);
    if (block.empty) {
      tmplAstVisitAll(this, block.empty.children);
    }
  }
  visitForLoopBlockEmpty(block: TmplAstForLoopBlockEmpty): void {
    tmplAstVisitAll(this, block.children);
  }
  visitIfBlock(block: TmplAstIfBlock): void {
    for (const branch of block.branches) {
      tmplAstVisitAll(this, branch.children);
    }
  }
  visitIfBlockBranch(block: TmplAstIfBlockBranch): void {
    tmplAstVisitAll(this, block.children);
  }
  visitUnknownBlock(): void {}
  visitLetDeclaration(): void {}
  visitComponent(): void {}
  visitDirective(): void {}
}
