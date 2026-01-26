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
  SafePropertyRead,
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
  TmplAstLetDeclaration,
  ParseSourceSpan,
} from '@angular/compiler';
import {ErrorCode, ngErrorCode} from '@angular/compiler-cli/src/ngtsc/diagnostics';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import {TemplateTypeChecker} from '@angular/compiler-cli/src/ngtsc/typecheck/api';
import ts from 'typescript';

import {
  isValidCSSProperty,
  findSimilarCSSProperties,
  isValidCSSUnit,
  kebabToCamelCase,
} from './css_properties';

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
    const visitor = new CssBindingVisitor(component, templateTypeChecker, diagnostics, severity);
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
      code: ngErrorCode(ErrorCode.UNKNOWN_CSS_PROPERTY_IN_HOST),
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
      code: ngErrorCode(ErrorCode.INVALID_CSS_UNIT_IN_HOST),
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
    private readonly templateTypeChecker: TemplateTypeChecker,
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

    // The keySpan covers "style.propertyName" or "style.propertyName.unit"
    // We want to highlight just the CSS property name (after "style.")
    const stylePrefix = 'style.';

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

      // Create a span that covers just the property name (skip "style." prefix)
      const propertySpan = new ParseSourceSpan(
        attribute.keySpan.start.moveBy(stylePrefix.length),
        attribute.keySpan.start.moveBy(stylePrefix.length + propertyName.length),
      );

      const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
        this.component,
        propertySpan,
        this.severity,
        ErrorCode.UNKNOWN_CSS_PROPERTY,
        message,
      );
      this.diagnostics.push(diagnostic);
    }

    // Validate CSS unit suffix (if present)
    if (unit !== null && !isValidCSSUnit(unit)) {
      // Create a span that covers just the unit (at the end of keySpan)
      // The keySpan covers "style.propertyName.unit", unit is at the end
      const unitSpan = new ParseSourceSpan(
        attribute.keySpan.end.moveBy(-unit.length),
        attribute.keySpan.end,
      );

      const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
        this.component,
        unitSpan,
        this.severity,
        ErrorCode.INVALID_CSS_UNIT,
        `Unknown CSS unit '${unit}'. Valid units include: px, em, rem, %, vh, vw, s, ms, deg, etc.`,
      );
      this.diagnostics.push(diagnostic);
    }
  }

  /**
   * Validates style object bindings like [style]="{backgroundColor: 'red'}"
   * or [ngStyle]="{'background-color': 'red'}" or [style]="styleConst"
   */
  private validateStyleObjectBinding(attribute: TmplAstBoundAttribute): void {
    const value = attribute.value;

    // Unwrap ASTWithSource to get the actual expression
    const expr = value instanceof ASTWithSource ? value.ast : value;

    // Handle object literals (LiteralMap) - may contain spreads
    if (expr instanceof LiteralMap) {
      // First validate regular keys in the literal map
      this.validateStyleLiteralMap(expr, attribute);
      // Then validate any spread expressions
      this.validateStyleSpreads(expr, attribute);
      return;
    }

    // Handle variable references: [style]="styleConst" or [style]="this.styleObj"
    if (expr instanceof PropertyRead || expr instanceof SafePropertyRead) {
      this.validateStyleVariableReferenceExpr(expr, attribute, attribute.valueSpan ?? null);
    }
  }

  /**
   * Validates spread expressions within a LiteralMap.
   * Examples: [style]="{...myStyles}", [style]="{color: 'red', ...myStyles}"
   */
  private validateStyleSpreads(literalMap: LiteralMap, attribute: TmplAstBoundAttribute): void {
    for (let i = 0; i < literalMap.keys.length; i++) {
      const key = literalMap.keys[i];
      if (key.kind === 'spread') {
        // For LiteralMap spreads, the value is the expression directly (not wrapped in SpreadElement)
        const spreadExpr = literalMap.values[i];
        // Validate the spread expression (e.g., myStyles in {...myStyles})
        this.validateStyleVariableReferenceExpr(spreadExpr, attribute, attribute.valueSpan ?? null);
      }
    }
  }

  /**
   * Validates a single expression that should resolve to a style object.
   * Uses the type checker to get the object's type and validate its CSS properties.
   */
  private validateStyleVariableReferenceExpr(
    expr: AST,
    attribute: TmplAstBoundAttribute,
    varSpan: ParseSourceSpan | null,
  ): void {
    // Get the symbol for this expression
    const symbol = this.templateTypeChecker.getSymbolOfNode(expr, this.component);
    if (!symbol || !('tsType' in symbol)) {
      return;
    }

    const tsType = symbol.tsType;
    if (!tsType) {
      return;
    }

    // Get the properties of the type - tsType is ts.Type which has getProperties() directly
    const properties = tsType.getProperties();

    // Track invalid properties for a single combined diagnostic
    const invalidProperties: {name: string; suggestion?: string}[] = [];

    for (const prop of properties) {
      const propertyName = prop.getName();

      // Skip CSS custom properties (--var-name)
      if (propertyName.startsWith('--')) {
        continue;
      }

      // Convert kebab-case to camelCase for validation
      const normalizedName = propertyName.includes('-')
        ? kebabToCamelCase(propertyName)
        : propertyName;

      if (!isValidCSSProperty(normalizedName)) {
        const suggestions = findSimilarCSSProperties(normalizedName);
        invalidProperties.push({
          name: propertyName,
          suggestion: suggestions.length > 0 ? suggestions[0] : undefined,
        });
      }
    }

    // If there are invalid properties, create a diagnostic on the variable reference
    if (invalidProperties.length > 0) {
      const span = varSpan ?? attribute.sourceSpan;

      let message: string;
      if (invalidProperties.length === 1) {
        const {name, suggestion} = invalidProperties[0];
        message = `Variable contains unknown CSS property '${name}'.`;
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`;
        }
      } else {
        const names = invalidProperties.map((p) => `'${p.name}'`).join(', ');
        message = `Variable contains unknown CSS properties: ${names}.`;
        const suggestions = invalidProperties
          .filter((p) => p.suggestion)
          .map((p) => `'${p.name}' → '${p.suggestion}'`);
        if (suggestions.length > 0) {
          message += ` Suggestions: ${suggestions.join(', ')}.`;
        }
      }

      const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
        this.component,
        span,
        this.severity,
        ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
        message,
      );
      this.diagnostics.push(diagnostic);
    }
  }

  /**
   * Validates a LiteralMap expression used as a style object.
   * Checks each key to ensure it's a valid CSS property name and detects duplicate properties.
   */
  private validateStyleLiteralMap(literalMap: LiteralMap, attribute: TmplAstBoundAttribute): void {
    // Get the valueSpan to use as a reference for creating key spans
    const valueSpan = attribute.valueSpan ?? attribute.sourceSpan;

    // Track seen property names (normalized to catch both 'background-color' and 'backgroundColor')
    const seenProperties = new Map<
      string,
      {originalName: string; sourceSpanStart: number; sourceSpanEnd: number}
    >();

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

      // Convert kebab-case to camelCase for validation and duplicate detection
      // Both 'backgroundColor' and 'background-color' are valid in [ngStyle]
      const normalizedName = propertyName.includes('-')
        ? kebabToCamelCase(propertyName)
        : propertyName;

      // Check for duplicate property (after normalization)
      const previousOccurrence = seenProperties.get(normalizedName);
      if (previousOccurrence) {
        // Create a span for the duplicate key
        const keyStartOffset = key.sourceSpan.start - valueSpan.start.offset;
        const keyEndOffset = key.sourceSpan.end - valueSpan.start.offset;
        const keySpan = new ParseSourceSpan(
          valueSpan.start.moveBy(keyStartOffset),
          valueSpan.start.moveBy(keyEndOffset),
        );

        // Check if it's the same name or different naming conventions
        let message: string;
        if (propertyName === previousOccurrence.originalName) {
          message = `Duplicate CSS property '${propertyName}'. Only the last value will be used.`;
        } else {
          // Different formats like 'backgroundColor' and 'background-color'
          message = `Duplicate CSS property: '${propertyName}' and '${previousOccurrence.originalName}' refer to the same property. Only the last value will be used.`;
        }

        const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
          this.component,
          keySpan,
          this.severity,
          ErrorCode.DUPLICATE_CSS_PROPERTY,
          message,
        );
        this.diagnostics.push(diagnostic);
      }

      // Record this occurrence (will overwrite if it's a duplicate, which is fine)
      seenProperties.set(normalizedName, {
        originalName: propertyName,
        sourceSpanStart: key.sourceSpan.start,
        sourceSpanEnd: key.sourceSpan.end,
      });

      // Validate CSS property name (skip if it's a duplicate - we already flagged that)
      if (!previousOccurrence && !isValidCSSProperty(normalizedName)) {
        const suggestions = findSimilarCSSProperties(normalizedName);
        let message = `Unknown CSS property '${propertyName}'.`;
        if (suggestions.length > 0) {
          message += ` Did you mean '${suggestions[0]}'?`;
          if (suggestions.length > 1) {
            message += ` Other suggestions: ${suggestions.slice(1).join(', ')}.`;
          }
        }

        // Create a span that covers just the property key using the key's sourceSpan.
        // The key.sourceSpan has absolute offsets within the template.
        // We calculate the relative offset from valueSpan.start to create the span.
        const keyStartOffset = key.sourceSpan.start - valueSpan.start.offset;
        const keyEndOffset = key.sourceSpan.end - valueSpan.start.offset;
        const keySpan = new ParseSourceSpan(
          valueSpan.start.moveBy(keyStartOffset),
          valueSpan.start.moveBy(keyEndOffset),
        );

        const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
          this.component,
          keySpan,
          this.severity,
          ErrorCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
          message,
        );
        this.diagnostics.push(diagnostic);
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
  visitLetDeclaration(decl: TmplAstLetDeclaration): void {
    // Validate @let declarations that contain style object literals
    // This allows us to detect invalid CSS properties and duplicates directly in the declaration
    const value = decl.value;

    // Unwrap ASTWithSource to get the actual expression
    const expr = value instanceof ASTWithSource ? value.ast : value;

    // Check if it's an object literal
    if (expr instanceof LiteralMap) {
      // We validate the literal map for potential style usage
      // Since @let declarations are general-purpose, we only report CSS-specific issues
      // when the object is actually used in a [style] or [ngStyle] binding
      // However, we can still validate for duplicates now
      this.validateLetDeclStyleLiteralMap(expr, decl);
    }
  }

  /**
   * Validates a LiteralMap in a @let declaration for CSS-related issues.
   * We validate duplicate properties here since TypeScript's type system collapses duplicates.
   */
  private validateLetDeclStyleLiteralMap(
    literalMap: LiteralMap,
    decl: TmplAstLetDeclaration,
  ): void {
    // Get the valueSpan to use as a reference for creating key spans
    const valueSpan = decl.valueSpan ?? decl.sourceSpan;

    // Track seen property names (normalized to catch both 'background-color' and 'backgroundColor')
    const seenProperties = new Map<
      string,
      {originalName: string; sourceSpanStart: number; sourceSpanEnd: number}
    >();

    for (const key of literalMap.keys) {
      // Skip spread keys
      if (key.kind === 'spread') {
        continue;
      }

      const propertyName = key.key;

      // Skip CSS custom properties (--var-name)
      if (propertyName.startsWith('--')) {
        continue;
      }

      // Convert kebab-case to camelCase for duplicate detection
      const normalizedName = propertyName.includes('-')
        ? kebabToCamelCase(propertyName)
        : propertyName;

      // Check for duplicate property (after normalization)
      const previousOccurrence = seenProperties.get(normalizedName);
      if (previousOccurrence) {
        // Create a span for the duplicate key
        const keyStartOffset = key.sourceSpan.start - valueSpan.start.offset;
        const keyEndOffset = key.sourceSpan.end - valueSpan.start.offset;
        const keySpan = new ParseSourceSpan(
          valueSpan.start.moveBy(keyStartOffset),
          valueSpan.start.moveBy(keyEndOffset),
        );

        // Check if it's the same name or different naming conventions
        let message: string;
        if (propertyName === previousOccurrence.originalName) {
          message = `Duplicate CSS property '${propertyName}' in @let declaration. Only the last value will be used.`;
        } else {
          message = `Duplicate CSS property: '${propertyName}' and '${previousOccurrence.originalName}' refer to the same property. Only the last value will be used.`;
        }

        const diagnostic = this.templateTypeChecker.makeTemplateDiagnostic(
          this.component,
          keySpan,
          this.severity,
          ErrorCode.DUPLICATE_CSS_PROPERTY,
          message,
        );
        this.diagnostics.push(diagnostic);
      }

      // Record this occurrence
      seenProperties.set(normalizedName, {
        originalName: propertyName,
        sourceSpanStart: key.sourceSpan.start,
        sourceSpanEnd: key.sourceSpan.end,
      });
    }
  }
  visitComponent(): void {}
  visitDirective(): void {}
}
