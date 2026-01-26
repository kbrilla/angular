/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  BindingType,
  TmplAstBoundAttribute,
  TmplAstNode,
  tmplAstVisitAll,
  TmplAstVisitor,
} from '@angular/compiler';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import ts from 'typescript';

import {isValidCSSProperty, findSimilarCSSProperties, isValidCSSUnit} from './css_properties';

/**
 * CSS diagnostic codes for the Angular Language Service.
 * These are in a separate range from Angular's core diagnostic codes.
 */
export const enum CssDiagnosticCode {
  /** Unknown CSS property name in style binding. */
  UNKNOWN_CSS_PROPERTY = 99001,
  /** Invalid CSS unit suffix in style binding. */
  INVALID_CSS_UNIT = 99002,
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
 * Gets CSS-related diagnostics for a template.
 *
 * This validates CSS property names in style bindings like `[style.propertyName]`
 * and reports diagnostics for unknown properties.
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
  const template = templateTypeChecker.getTemplate(component);
  if (template === null) {
    return [];
  }

  const diagnostics: ts.Diagnostic[] = [];
  const severity = getDiagnosticCategory(config.severity);

  // Visit all style bindings in the template
  const visitor = new CssBindingVisitor(component, diagnostics, severity);
  tmplAstVisitAll(visitor, template);

  return diagnostics;
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
    // Only validate style bindings
    if (attribute.type !== BindingType.Style) {
      return;
    }

    // Parse the style binding name
    // Format: "propertyName" or "propertyName.unit"
    const fullName = attribute.name;
    const parts = fullName.split('.');

    // The first part after 'style' is the property name (already parsed by Angular)
    // Note: For [style.width], attribute.name will be 'width', not 'style.width'
    const propertyName = parts[0];
    const unit = attribute.unit;

    // Validate CSS property name
    if (!isValidCSSProperty(propertyName)) {
      const suggestions = findSimilarCSSProperties(propertyName);
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

  // Required visitor methods that do nothing for our purposes
  visitElement(): void {}
  visitTemplate(): void {}
  visitContent(): void {}
  visitVariable(): void {}
  visitReference(): void {}
  visitTextAttribute(): void {}
  visitBoundText(): void {}
  visitText(): void {}
  visitIcu(): void {}
  visitBoundEvent(): void {}
  visitDeferredBlock(): void {}
  visitDeferredBlockPlaceholder(): void {}
  visitDeferredBlockError(): void {}
  visitDeferredBlockLoading(): void {}
  visitDeferredTrigger(): void {}
  visitSwitchBlock(): void {}
  visitSwitchBlockCase(): void {}
  visitSwitchBlockCaseGroup(): void {}
  visitForLoopBlock(): void {}
  visitForLoopBlockEmpty(): void {}
  visitIfBlock(): void {}
  visitIfBlockBranch(): void {}
  visitUnknownBlock(): void {}
  visitLetDeclaration(): void {}
  visitComponent(): void {}
  visitDirective(): void {}
}
