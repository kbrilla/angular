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
  BindingPipe,
  BindingType,
  LiteralMap,
  LiteralMapKey,
  LiteralPrimitive,
  ParseSpan,
  RecursiveAstVisitor,
  SpreadElement,
  TmplAstBoundAttribute,
  TmplAstElement,
  TmplAstHostElement,
  TmplAstNode,
  TmplAstTemplate,
  tmplAstVisitAll,
  TmplAstVisitor,
  TmplAstIfBlock,
  TmplAstIfBlockBranch,
  TmplAstForLoopBlock,
  TmplAstForLoopBlockEmpty,
  TmplAstSwitchBlock,
  TmplAstSwitchBlockCase,
  TmplAstSwitchBlockCaseGroup,
  TmplAstDeferredBlock,
  TmplAstDeferredBlockPlaceholder,
  TmplAstDeferredBlockError,
  TmplAstDeferredBlockLoading,
} from '@angular/compiler';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import {isExternalResource} from '@angular/compiler-cli/src/ngtsc/metadata';
import {TemplateTypeChecker} from '@angular/compiler-cli/src/ngtsc/typecheck/api';
import ts from 'typescript';

import {
  isValidCSSProperty,
  findSimilarCSSProperties,
  isValidCSSUnit,
  kebabToCamelCase,
  camelToKebabCase,
  isObsoleteCSSProperty,
  getObsoleteCSSPropertyInfo,
  getShorthandLonghands,
  isShorthandProperty,
  getShorthandForLonghand,
} from './css_properties';

import {createShadowingDiagnostic, ShadowedInput} from '../binding_conflict_utils';

import {
  BaseBinding,
  BaseBindingType,
  BASE_BINDING_PRECEDENCE,
  createConflictDiagnostic,
  getBindingTypeDescription,
  groupBindingsByName,
} from '../binding_conflict_utils';

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
  /** Duplicate CSS property in style object literal. */
  DUPLICATE_CSS_PROPERTY = 99004,
  /** Same CSS property set via multiple binding types (precedence conflict). */
  CONFLICTING_STYLE_BINDING = 99005,
  /** Unknown CSS property name in host metadata. */
  UNKNOWN_CSS_PROPERTY_IN_HOST = 99006,
  /** Invalid CSS unit in host metadata. */
  INVALID_CSS_UNIT_IN_HOST = 99007,
  /** Obsolete/deprecated CSS property in style binding. */
  OBSOLETE_CSS_PROPERTY = 99008,
  /** Obsolete/deprecated CSS property in host binding. */
  OBSOLETE_CSS_PROPERTY_IN_HOST = 99009,
  /** Obsolete/deprecated CSS property in style object literal. */
  OBSOLETE_CSS_PROPERTY_IN_OBJECT = 99010,
  /** Invalid value type for CSS unit suffix (e.g., string 'red' with .px unit). */
  INVALID_UNIT_VALUE = 99011,
  /** Invalid value type for CSS unit suffix in host binding. */
  INVALID_UNIT_VALUE_IN_HOST = 99012,
  /** Invalid value type for CSS unit suffix in style object literal. */
  INVALID_UNIT_VALUE_IN_OBJECT = 99013,
  /** CSS shorthand property overrides a longhand property set elsewhere. */
  SHORTHAND_OVERRIDE = 99014,
  /** Warning when using string instead of number for unit suffix binding. */
  PREFER_NUMERIC_UNIT_VALUE = 99015,
  /** Warning when number used without unit in style binding. */
  MISSING_UNIT_FOR_NUMBER = 99016,
  /** Suggestion to migrate [ngClass] to [class]. */
  PREFER_CLASS_OVER_NGCLASS = 99017,
  /** Suggestion to convert [style] object literal to individual bindings. */
  PREFER_INDIVIDUAL_STYLE_BINDINGS = 99018,
  /** Suggestion to consolidate multiple individual [style.x] bindings into [style] object. */
  PREFER_STYLE_OBJECT_BINDING = 99019,
  /** Duplicate CSS property across multiple individual style bindings. */
  DUPLICATE_STYLE_BINDING = 99020,
  /** Comprehensive binding conflict diagnostic (combines duplicates + precedence conflicts). */
  COMPREHENSIVE_BINDING_CONFLICT = 99021,
  /** [class] binding shadows @Input('class') - both will be updated. */
  CLASS_BINDING_SHADOWS_INPUT = 99411,
  /** [style] binding shadows @Input('style') - both will be updated. */
  STYLE_BINDING_SHADOWS_INPUT = 99412,
}

/**
 * Configuration for CSS diagnostics.
 */
export interface CssDiagnosticsConfig {
  /** Whether CSS property validation is enabled. */
  enabled: boolean;
  /** Severity level for unknown CSS property diagnostics. */
  severity: 'error' | 'warning' | 'suggestion';
  /**
   * Whether to enable strict unit value validation.
   * When enabled, warns about:
   * - Using string values like '100' instead of numbers for unit suffix bindings
   * - Using numbers without units in non-unit bindings
   */
  strictUnitValues?: boolean;

  /**
   * Whether to warn when [class]/[style] bindings shadow directive @Input('class')/@Input('style').
   * Default: true
   */
  warnOnInputShadowing: boolean;

  /**
   * Use comprehensive binding conflict diagnostic (99021) instead of separate duplicates (99020) and conflicts (99005).
   * When true, emits ONE diagnostic per property showing all bindings grouped by source with Markdown formatting.
   * Default: true
   */
  useComprehensiveBindingConflict?: boolean;
}

/**
 * Default configuration for CSS diagnostics.
 */
export const DEFAULT_CSS_DIAGNOSTICS_CONFIG: CssDiagnosticsConfig = {
  enabled: true,
  severity: 'warning',
  strictUnitValues: false,
  warnOnInputShadowing: true,
  useComprehensiveBindingConflict: true,
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
 * @param templateSourceFile Optional source file for external templates. If provided, diagnostics
 *                           will point to this file instead of the component's TypeScript file.
 * @param skipTemplateBindings If true, skip template binding diagnostics and only check host bindings.
 *                             Use this when processing TS files for components with external templates.
 * @returns Array of CSS diagnostics.
 */
export function getCssDiagnostics(
  component: ts.ClassDeclaration,
  compiler: NgCompiler,
  config: CssDiagnosticsConfig = DEFAULT_CSS_DIAGNOSTICS_CONFIG,
  templateSourceFile?: ts.SourceFile,
  skipTemplateBindings: boolean = false,
): ts.Diagnostic[] {
  const componentName = component.name?.getText() || '<anonymous>';
  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG] getCssDiagnostics called for component: ${componentName}`);
  // @ts-ignore DEBUG
  console.log(
    `[CSS_DIAG] Config: enabled=${config.enabled}, severity=${config.severity}, strictUnitValues=${config.strictUnitValues}`,
  );
  // @ts-ignore DEBUG
  console.log(
    `[CSS_DIAG] templateSourceFile provided: ${templateSourceFile ? 'YES (' + templateSourceFile.fileName + ')' : 'NO'}`,
  );

  if (!config.enabled) {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] CSS diagnostics DISABLED, returning empty array`);
    return [];
  }

  const templateTypeChecker = compiler.getTemplateTypeChecker();
  const diagnostics: ts.Diagnostic[] = [];
  const severity = getDiagnosticCategory(config.severity);

  // Determine the source file to use for diagnostics:
  // - For external templates, use the provided templateSourceFile
  // - For inline templates, use the component's TypeScript file
  const diagnosticSourceFile = templateSourceFile ?? component.getSourceFile();
  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG] Using source file for diagnostics: ${diagnosticSourceFile.fileName}`);

  // Validate template style bindings (skip if skipTemplateBindings is true)
  const template = !skipTemplateBindings ? templateTypeChecker.getTemplate(component) : null;
  // @ts-ignore DEBUG
  console.log(
    `[CSS_DIAG] Template retrieved: ${template !== null ? 'YES' : 'NO'} (skipTemplateBindings=${skipTemplateBindings})`,
  );
  if (template !== null) {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] Template has ${template.length} root nodes`);
    const visitor = new CssBindingVisitor(
      component,
      templateTypeChecker,
      diagnostics,
      severity,
      config,
      diagnosticSourceFile,
    );
    tmplAstVisitAll(visitor, template);
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] After visitor: ${diagnostics.length} diagnostics found`);
  }

  // Validate host element style bindings (from @Component host: { '[style.prop]': ... })
  const hostElement = templateTypeChecker.getHostElement(component);
  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG] Host element retrieved: ${hostElement !== null ? 'YES' : 'NO'}`);
  if (hostElement !== null) {
    validateHostStyleBindings(component, hostElement, diagnostics, severity);

    // Host binding conflict diagnostics should only be added when processing the TS file,
    // not when processing an external HTML template, since host binding diagnostics
    // always point to the component's TypeScript file.
    const isProcessingTsFile = diagnosticSourceFile === component.getSourceFile();
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] isProcessingTsFile: ${isProcessingTsFile}`);
    if (isProcessingTsFile) {
      // Also detect conflicts within host bindings
      detectHostStyleBindingConflicts(component, hostElement, diagnostics, severity, config);
    }
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] After host validation: ${diagnostics.length} diagnostics`);
  }

  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG] TOTAL diagnostics returned: ${diagnostics.length}`);
  for (const diag of diagnostics) {
    // @ts-ignore DEBUG
    console.log(
      `[CSS_DIAG]   - code=${diag.code}, msg=${String(diag.messageText).substring(0, 80)}...`,
    );
  }
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
 * Validates CSS properties in host style bindings.
 * These come from @Component({ host: { '[style.prop]': 'value' } })
 */
function validateHostStyleBindings(
  component: ts.ClassDeclaration,
  hostElement: TmplAstHostElement,
  diagnostics: ts.Diagnostic[],
  severity: ts.DiagnosticCategory,
): void {
  for (const binding of hostElement.bindings) {
    // Only validate style bindings [style.prop]
    if (binding.type !== BindingType.Style) {
      continue;
    }

    // Skip bindings with invalid spans (dummy spans from internal processing)
    if (!binding.keySpan || binding.keySpan.start.offset < 0) {
      continue;
    }

    // Parse the style binding name - format: "propertyName" or "propertyName.unit"
    const fullName = binding.name;
    const parts = fullName.split('.');
    const propertyName = parts[0];
    const camelCasePropertyName = kebabToCamelCase(propertyName);
    const unit = binding.unit;

    // Check for obsolete CSS property first (takes priority)
    const obsoleteInfo = getObsoleteCSSPropertyInfo(camelCasePropertyName);
    if (obsoleteInfo !== undefined) {
      const displayName = propertyName.includes('-')
        ? camelToKebabCase(camelCasePropertyName)
        : camelCasePropertyName;
      let message = `CSS property '${displayName}' is deprecated. ${obsoleteInfo.message}`;
      if (obsoleteInfo.replacement) {
        const replacementDisplay = propertyName.includes('-')
          ? camelToKebabCase(obsoleteInfo.replacement)
          : obsoleteInfo.replacement;
        message += ` Consider using '${replacementDisplay}' instead.`;
      }
      message += ` See: ${obsoleteInfo.mdnUrl}`;

      diagnostics.push({
        category: ts.DiagnosticCategory.Warning, // Always warning for obsolete
        code: CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_HOST,
        messageText: message,
        file: component.getSourceFile(),
        start: binding.keySpan.start.offset,
        length: binding.keySpan.end.offset - binding.keySpan.start.offset,
        source: 'angular',
      });
      continue; // Skip unknown check if obsolete
    }

    // Validate CSS property name
    if (!isValidCSSProperty(camelCasePropertyName)) {
      const suggestions = findSimilarCSSProperties(camelCasePropertyName);
      let message = `Unknown CSS property '${propertyName}' in host binding.`;
      if (suggestions.length > 0) {
        // Convert suggestion to kebab-case if original was kebab-case
        const suggestionForDisplay = propertyName.includes('-')
          ? camelToKebabCase(suggestions[0])
          : suggestions[0];
        message += ` Did you mean '${suggestionForDisplay}'?`;
        if (suggestions.length > 1) {
          const otherSuggestions = suggestions
            .slice(1)
            .map((s) => (propertyName.includes('-') ? camelToKebabCase(s) : s));
          message += ` Other suggestions: ${otherSuggestions.join(', ')}.`;
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
}

/**
 * Detects conflicts within host style bindings.
 * This includes conflicts between:
 * - host: { '[style.width]': ... } and @HostBinding('style.width')
 * - host: { '[style.width]': ... } and host: { '[style]': { width: ... } }
 * - Multiple @HostBinding decorators for the same property
 */

/**
 * Emit comprehensive diagnostic for host binding conflicts (99021).
 */
function emitComprehensiveHostBindingConflict(
  component: ts.ClassDeclaration,
  property: string,
  bindings: Array<{
    property: string;
    bindingType: BaseBindingType;
    binding: TmplAstBoundAttribute;
    originalPropertyName: string;
  }>,
  diagnostics: ts.Diagnostic[],
  severity: ts.DiagnosticCategory,
): void {
  const sourceFile = component.getSourceFile();

  // Build message with file locations
  let messageLines: string[] = [];
  const totalBindings = bindings.length;
  messageLines.push(
    `CSS property '${camelToKebabCase(property)}' is bound ${totalBindings} time${totalBindings > 1 ? 's' : ''} via component/directive host bindings:`,
  );
  messageLines.push('');

  // Get file location for first binding
  const fileName = sourceFile.fileName.split('/').pop() || sourceFile.fileName;
  const getLocation = (binding: TmplAstBoundAttribute): string => {
    if (binding.keySpan) {
      const pos = sourceFile.getLineAndCharacterOfPosition(binding.keySpan.start.offset);
      return `${fileName}(${pos.line + 1}, ${pos.character + 1})`;
    }
    return fileName;
  };

  messageLines.push(`Component/Directive host bindings ${getLocation(bindings[0].binding)}:`);
  for (let i = 0; i < bindings.length; i++) {
    const b = bindings[i];
    const bindingName = `[${b.binding.name}]`;
    let valueSnippet = '';
    if (b.binding.valueSpan) {
      const text = sourceFile.getFullText();
      const start = b.binding.valueSpan.start.offset;
      const end = b.binding.valueSpan.end.offset;
      const value = text.slice(start, end).trim();
      valueSnippet = value ? ` = ${value}` : '';
    }
    const status = i === 0 ? ' [WINS]' : ' [duplicate, ignored]';
    messageLines.push(`  ${i + 1}. ${bindingName}${valueSnippet}${status}`);
  }

  messageLines.push('');
  messageLines.push(`Result: First binding wins, duplicates are ignored`);

  const messageText = messageLines.join('\n');

  // Report on the subsequent bindings (they will be ignored)
  for (let i = 1; i < bindings.length; i++) {
    const subsequent = bindings[i];
    diagnostics.push({
      category: severity,
      code: CssDiagnosticCode.COMPREHENSIVE_BINDING_CONFLICT,
      messageText: messageText,
      file: sourceFile,
      start: subsequent.binding.keySpan!.start.offset,
      length: subsequent.binding.keySpan!.end.offset - subsequent.binding.keySpan!.start.offset,
      source: 'angular',
      relatedInformation: [
        {
          category: ts.DiagnosticCategory.Message,
          code: 0,
          file: sourceFile,
          start: bindings[0].binding.keySpan!.start.offset,
          length:
            bindings[0].binding.keySpan!.end.offset - bindings[0].binding.keySpan!.start.offset,
          messageText: `[${bindings[0].binding.name}] (component/directive host binding) - WINS`,
        },
      ],
    });
  }
}

function detectHostStyleBindingConflicts(
  component: ts.ClassDeclaration,
  hostElement: TmplAstHostElement,
  diagnostics: ts.Diagnostic[],
  severity: ts.DiagnosticCategory,
  config: CssDiagnosticsConfig,
): void {
  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG_HOST] detectHostStyleBindingConflicts for ${component.name?.getText()}`);
  // @ts-ignore DEBUG
  console.log(`[CSS_DIAG_HOST]   hostElement.bindings.length = ${hostElement.bindings.length}`);
  // Collect all host style bindings by normalized property name
  const bindingsByProperty = new Map<
    string,
    Array<{
      property: string;
      bindingType: BaseBindingType;
      binding: TmplAstBoundAttribute;
      originalPropertyName: string;
    }>
  >();

  for (const binding of hostElement.bindings) {
    // Individual host style binding: [style.prop]
    if (binding.type === BindingType.Style) {
      // Skip bindings with invalid spans
      if (!binding.keySpan || binding.keySpan.start.offset < 0) {
        continue;
      }

      const propertyName = binding.name.split('.')[0];
      const normalized = normalizeCSSPropertyName(propertyName);
      const entry = {
        property: normalized,
        bindingType: 'hostIndividual' as BaseBindingType,
        binding,
        originalPropertyName: propertyName,
      };
      const existing = bindingsByProperty.get(normalized) || [];
      existing.push(entry);
      bindingsByProperty.set(normalized, existing);
    }
    // Host object style binding: [style]="..."
    else if (binding.type === BindingType.Property && binding.name === 'style') {
      // Skip bindings with invalid spans
      if (!binding.keySpan || binding.keySpan.start.offset < 0) {
        continue;
      }

      // Note: We can't easily extract properties from host style objects
      // because they're usually component properties, not literals.
      // We'll just track that there's a general [style] binding.
      const entry = {
        property: '__style_object__',
        bindingType: 'hostObjectLiteral' as BaseBindingType,
        binding,
        originalPropertyName: 'style',
      };
      const existing = bindingsByProperty.get('__style_object__') || [];
      existing.push(entry);
      bindingsByProperty.set('__style_object__', existing);
    }
  }

  // Check for conflicts (same property defined multiple times)
  // For host bindings, we report conflicts even for the same binding type
  // because they come from different sources (host: {} vs @HostBinding)
  for (const [property, bindings] of bindingsByProperty) {
    if (bindings.length <= 1 || property === '__style_object__') continue;

    // @ts-ignore DEBUG
    console.log(
      `[CSS_DIAG_HOST] Found conflict for '${property}' with ${bindings.length} bindings`,
    );
    for (const b of bindings) {
      // @ts-ignore DEBUG
      console.log(
        `[CSS_DIAG_HOST]   binding: keySpan=${JSON.stringify({start: b.binding.keySpan?.start?.offset, end: b.binding.keySpan?.end?.offset})}`,
      );
    }

    // Use comprehensive format if enabled
    if (config.useComprehensiveBindingConflict) {
      emitComprehensiveHostBindingConflict(component, property, bindings, diagnostics, severity);
      continue;
    }

    // LEGACY: Build detailed message for duplicates (99020)
    const sortedBindings = bindings.map((b, idx) => ({
      ...b,
      index: idx + 1,
    }));

    const bindingsList = sortedBindings
      .map((b) => {
        const propName = b.originalPropertyName;
        const source = `[${b.binding.name}]`;
        // Try to get value snippet
        let valueSnippet = '';
        if (b.binding.valueSpan) {
          const sourceFile = component.getSourceFile();
          const text = sourceFile.getFullText();
          const start = b.binding.valueSpan.start.offset;
          const end = b.binding.valueSpan.end.offset;
          const value = text.slice(start, end).trim();
          if (value) {
            valueSnippet = ` — value: ${value}`;
          }
        }
        return `${b.index}. ${propName} from ${source}${valueSnippet}`;
      })
      .join('\n');

    const messageText =
      `CSS property '${property}' is set ${bindings.length} times via component/directive host bindings.\n` +
      `The first occurrence wins, subsequent bindings are ignored:\n${bindingsList}`;

    // Report diagnostics on subsequent bindings (they will be overridden)
    for (let i = 1; i < bindings.length; i++) {
      const subsequent = bindings[i];
      // @ts-ignore DEBUG
      console.log(
        `[CSS_DIAG_HOST]   Creating diagnostic at start=${subsequent.binding.keySpan!.start.offset}, length=${subsequent.binding.keySpan!.end.offset - subsequent.binding.keySpan!.start.offset}`,
      );

      diagnostics.push({
        category: severity,
        code: CssDiagnosticCode.DUPLICATE_STYLE_BINDING,
        messageText: messageText,
        file: component.getSourceFile(),
        start: subsequent.binding.keySpan!.start.offset,
        length: subsequent.binding.keySpan!.end.offset - subsequent.binding.keySpan!.start.offset,
        source: 'angular',
      });
    }
  }
}

/**
 * Normalizes a CSS property name to a consistent format for duplicate detection.
 * Converts kebab-case to camelCase and lowercases for comparison.
 * Examples:
 *   - 'background-color' -> 'backgroundcolor'
 *   - 'backgroundColor' -> 'backgroundcolor'
 *   - 'BACKGROUND-COLOR' -> 'backgroundcolor'
 */
function normalizeCSSPropertyName(propertyName: string): string {
  // Convert kebab-case to camelCase, then lowercase for comparison
  return propertyName.replace(/-([a-z])/gi, (_, char) => char.toUpperCase()).toLowerCase();
}

/**
 * Represents a style binding found on an element.
 * Extends BaseBinding from binding_conflict_utils for consistent conflict detection.
 */
interface StyleBinding extends BaseBinding {
  /** Normalized CSS property name (lowercase, no hyphens) */
  property: string;
  /** Original CSS property name for error messages (preserves case and hyphens) */
  originalPropertyName: string;
  /** Optional span for the property key inside an object binding ([style] or [ngStyle]) */
  propertySpan?: {start: number; end: number};
  /** For directive/component host bindings: source file containing the host definition */
  hostSourceFile?: ts.SourceFile;
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
    private readonly config: CssDiagnosticsConfig,
    private readonly diagnosticSourceFile: ts.SourceFile,
  ) {}

  visitBoundAttribute(attribute: TmplAstBoundAttribute): void {
    // Check if this is an object-style binding: [style]="{ prop: value }" or [ngStyle]="{ prop: value }"
    // These are Property bindings, not Style bindings
    if (attribute.type === BindingType.Property) {
      if (attribute.name === 'style' || attribute.name === 'ngStyle') {
        this.validateStyleObjectLiteral(attribute);
      }
      // For all Property bindings (including style/ngStyle), we're done
      return;
    }

    // Only validate individual style bindings [style.property]
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

    // CSS custom properties (--my-var) are always valid
    if (propertyName.startsWith('--')) {
      // Still validate unit if present
      if (unit !== null && !isValidCSSUnit(unit)) {
        this.diagnostics.push({
          category: this.severity,
          code: CssDiagnosticCode.INVALID_CSS_UNIT,
          messageText: `Unknown CSS unit '${unit}'. Valid units include: px, em, rem, %, vh, vw, s, ms, deg, etc.`,
          file: this.diagnosticSourceFile,
          start: attribute.keySpan.end.offset - unit.length,
          length: unit.length,
          source: 'angular',
        });
      }
      return;
    }

    // Property names may be in kebab-case (e.g., 'background-color'), so convert to camelCase for validation
    const camelCasePropertyName = kebabToCamelCase(propertyName);

    // Check for obsolete CSS property first (takes priority)
    const obsoleteInfo = getObsoleteCSSPropertyInfo(camelCasePropertyName);
    if (obsoleteInfo !== undefined) {
      const displayName = propertyName.includes('-')
        ? camelToKebabCase(camelCasePropertyName)
        : camelCasePropertyName;
      let message = `CSS property '${displayName}' is deprecated. ${obsoleteInfo.message}`;
      if (obsoleteInfo.replacement) {
        const replacementDisplay = propertyName.includes('-')
          ? camelToKebabCase(obsoleteInfo.replacement)
          : obsoleteInfo.replacement;
        message += ` Consider using '${replacementDisplay}' instead.`;
      }
      message += ` See: ${obsoleteInfo.mdnUrl}`;

      this.diagnostics.push({
        category: ts.DiagnosticCategory.Warning, // Always warning for obsolete
        code: CssDiagnosticCode.OBSOLETE_CSS_PROPERTY,
        messageText: message,
        file: this.diagnosticSourceFile,
        start: attribute.keySpan.start.offset,
        length: attribute.keySpan.end.offset - attribute.keySpan.start.offset,
        source: 'angular',
      });
      // Continue to validate unit even for obsolete properties
    }
    // Validate CSS property name (only if not obsolete - obsolete props are known but deprecated)
    else if (!isValidCSSProperty(camelCasePropertyName)) {
      const suggestions = findSimilarCSSProperties(camelCasePropertyName);
      let message = `Unknown CSS property '${propertyName}'.`;
      if (suggestions.length > 0) {
        // Convert suggestion to kebab-case if original was kebab-case
        const suggestionForDisplay = propertyName.includes('-')
          ? camelToKebabCase(suggestions[0])
          : suggestions[0];
        message += ` Did you mean '${suggestionForDisplay}'?`;
        if (suggestions.length > 1) {
          const otherSuggestions = suggestions
            .slice(1)
            .map((s) => (propertyName.includes('-') ? camelToKebabCase(s) : s));
          message += ` Other suggestions: ${otherSuggestions.join(', ')}.`;
        }
      }

      this.diagnostics.push({
        category: this.severity,
        code: CssDiagnosticCode.UNKNOWN_CSS_PROPERTY,
        messageText: message,
        file: this.diagnosticSourceFile,
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
        file: this.diagnosticSourceFile,
        start: attribute.keySpan.end.offset - unit.length,
        length: unit.length,
        source: 'angular',
      });
    }

    // Validate value type for unit suffix bindings (e.g., [style.width.px]="'red'" is invalid)
    if (unit !== null && isValidCSSUnit(unit)) {
      this.validateUnitValueType(attribute, unit);
    }

    // In strict mode, warn when a number is used without a unit for properties that typically need units
    // For example: [style.width]="100" should probably be [style.width.px]="100" or [style.width]="'100px'"
    if (unit === null && this.config.strictUnitValues) {
      this.validateMissingUnitForNumber(attribute, camelCasePropertyName);
    }
  }

  /**
   * Properties that typically require length units.
   * When a number is used directly for these properties without a unit,
   * it might indicate a mistake.
   */
  private static readonly LENGTH_PROPERTIES = new Set([
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'top',
    'right',
    'bottom',
    'left',
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontSize',
    'letterSpacing',
    'wordSpacing',
    'textIndent',
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderRadius',
    'outlineWidth',
    'gap',
    'rowGap',
    'columnGap',
    'flexBasis',
  ]);

  /**
   * Validates that length-based properties don't have bare numbers without units.
   * In strict mode, warns when [style.width]="100" is used instead of
   * [style.width.px]="100" or [style.width]="'100px'".
   */
  private validateMissingUnitForNumber(
    attribute: TmplAstBoundAttribute,
    propertyName: string,
  ): void {
    // Only check properties that typically need length units
    if (!CssBindingVisitor.LENGTH_PROPERTIES.has(propertyName)) {
      return;
    }

    // Get the expression AST
    let ast: AST = attribute.value;
    if (ast instanceof ASTWithSource) {
      ast = ast.ast;
    }

    // We can only validate literal primitive values statically
    if (!(ast instanceof LiteralPrimitive)) {
      return;
    }

    const value = ast.value;

    // Only warn if the value is a number (not a string with unit)
    if (typeof value === 'number') {
      this.diagnostics.push({
        category: ts.DiagnosticCategory.Suggestion,
        code: CssDiagnosticCode.MISSING_UNIT_FOR_NUMBER,
        messageText:
          `Style binding '[style.${propertyName}]' has a numeric value (${value}) without a unit. ` +
          `Consider using '[style.${propertyName}.px]="${value}"' or '[style.${propertyName}]="'${value}px'"'.`,
        file: this.diagnosticSourceFile,
        start: ast.sourceSpan.start,
        length: ast.sourceSpan.end - ast.sourceSpan.start,
        source: 'angular',
      });
    }
  }

  /**
   * Validates that the value for a unit-suffixed style binding is appropriate.
   * Unit suffixes expect numeric values (or numeric strings).
   *
   * For example:
   * - [style.width.px]="100" - ✅ Valid (number)
   * - [style.width.px]="'100'" - ✅ Valid (numeric string)
   * - [style.width.px]="'red'" - ❌ Invalid (non-numeric string)
   */
  private validateUnitValueType(attribute: TmplAstBoundAttribute, unit: string): void {
    // Get the expression AST
    let ast: AST = attribute.value;
    if (ast instanceof ASTWithSource) {
      ast = ast.ast;
    }

    // We can only validate literal primitive values statically
    if (!(ast instanceof LiteralPrimitive)) {
      // If it's not a literal, we can't validate it statically
      // (could be a variable, method call, etc.)
      return;
    }

    const value = ast.value;

    // Null and undefined are valid (will result in style being removed)
    if (value === null || value === undefined) {
      return;
    }

    // Numbers are always valid for unit suffixes
    if (typeof value === 'number') {
      return;
    }

    // Strings need to be checked if they represent numeric values
    if (typeof value === 'string') {
      const trimmed = value.trim();

      // Empty string is valid (will result in style being removed)
      if (trimmed === '') {
        return;
      }

      // Check if the string is a valid numeric value
      // This includes integers, decimals, negative numbers, etc.
      const numericValue = parseFloat(trimmed);
      if (!isNaN(numericValue) && isFinite(numericValue)) {
        // It's a numeric string like '100' - valid but suboptimal
        // In strict mode, suggest using a number directly
        if (this.config.strictUnitValues) {
          const propertyName = attribute.name.split('.')[0];
          this.diagnostics.push({
            category: ts.DiagnosticCategory.Suggestion,
            code: CssDiagnosticCode.PREFER_NUMERIC_UNIT_VALUE,
            messageText:
              `Style binding '[style.${propertyName}.${unit}]' expects a numeric value. ` +
              `Consider using ${numericValue} instead of '${trimmed}' for better type safety.`,
            file: this.diagnosticSourceFile,
            start: ast.sourceSpan.start,
            length: ast.sourceSpan.end - ast.sourceSpan.start,
            source: 'angular',
          });
        }
        return;
      }

      // Non-numeric string with a unit suffix - this is an error!
      // Angular will concatenate: 'red' + 'px' = 'redpx' which is invalid CSS
      const propertyName = attribute.name.split('.')[0];

      this.diagnostics.push({
        category: ts.DiagnosticCategory.Warning,
        code: CssDiagnosticCode.INVALID_UNIT_VALUE,
        messageText:
          `Invalid value '${value}' for style binding '[style.${propertyName}.${unit}]'. ` +
          `Unit suffix '.${unit}' expects a numeric value. ` +
          `The value '${value}' will result in invalid CSS '${value}${unit}'.`,
        file: this.diagnosticSourceFile,
        start: ast.sourceSpan.start,
        length: ast.sourceSpan.end - ast.sourceSpan.start,
        source: 'angular',
      });
    }

    // Boolean values with unit suffix don't make sense
    if (typeof value === 'boolean') {
      const propertyName = attribute.name.split('.')[0];

      this.diagnostics.push({
        category: ts.DiagnosticCategory.Warning,
        code: CssDiagnosticCode.INVALID_UNIT_VALUE,
        messageText:
          `Invalid value '${value}' for style binding '[style.${propertyName}.${unit}]'. ` +
          `Unit suffix '.${unit}' expects a numeric value, not a boolean.`,
        file: this.diagnosticSourceFile,
        start: ast.sourceSpan.start,
        length: ast.sourceSpan.end - ast.sourceSpan.start,
        source: 'angular',
      });
    }
  }

  /**
   * Validates CSS properties in object-style bindings like [style]="{prop: value}".
   */
  private validateStyleObjectLiteral(attribute: TmplAstBoundAttribute): void {
    // Unwrap ASTWithSource to get the actual AST
    let ast: AST = attribute.value;
    if (ast instanceof ASTWithSource) {
      ast = ast.ast;
    }

    // Check if the expression is a LiteralMap (object literal)
    if (!(ast instanceof LiteralMap)) {
      // Not an object literal (could be a variable reference, function call, etc.)
      // We can't validate those statically
      return;
    }

    // Track seen properties for duplicate detection (normalized to camelCase)
    const seenProperties = new Map<string, {key: LiteralMapKey; index: number}>();

    // Validate each key in the object literal
    for (let i = 0; i < ast.keys.length; i++) {
      const key = ast.keys[i];

      // Handle spread operators by resolving their type
      if (key.kind === 'spread') {
        this.validateSpreadProperties(ast.values[i], key.sourceSpan, seenProperties);
        continue;
      }

      // Parse the key: could be "propertyName" or "propertyName.unit"
      const fullKey = key.key;
      const keyParts = fullKey.split('.');
      const propertyName = keyParts[0];
      const unit = keyParts.length > 1 ? keyParts[1] : null;

      // Normalize property name for duplicate detection
      const normalizedProp = normalizeCSSPropertyName(propertyName);

      // Check for duplicates (case-insensitive)
      const existingEntry = seenProperties.get(normalizedProp);
      if (existingEntry) {
        const existingKey = existingEntry.key;
        if (existingKey.kind === 'property') {
          // Report duplicate
          let message: string;
          if (existingKey.key === fullKey) {
            message = `Duplicate CSS property '${fullKey}'. Only the last value will be used.`;
          } else {
            message = `Duplicate CSS property: '${fullKey}' and '${existingKey.key}' refer to the same property.`;
          }

          this.diagnostics.push({
            category: this.severity,
            code: CssDiagnosticCode.DUPLICATE_CSS_PROPERTY,
            messageText: message,
            file: this.diagnosticSourceFile,
            start: key.sourceSpan.start,
            length: key.sourceSpan.end - key.sourceSpan.start,
            source: 'angular',
          });
        }
      } else {
        seenProperties.set(normalizedProp, {key, index: i});
      }

      // Validate CSS property name
      this.validateCssPropertyName(propertyName, fullKey, key.sourceSpan);

      // Validate CSS unit suffix (if present)
      if (unit !== null && !isValidCSSUnit(unit)) {
        this.diagnostics.push({
          category: this.severity,
          code: CssDiagnosticCode.INVALID_CSS_UNIT,
          messageText: `Unknown CSS unit '${unit}'. Valid units include: px, em, rem, %, vh, vw, s, ms, deg, etc.`,
          file: this.diagnosticSourceFile,
          // Position at the unit part of the key
          start: key.sourceSpan.start + propertyName.length + 1,
          length: unit.length,
          source: 'angular',
        });
      }
    }
  }

  /**
   * Validates CSS properties within a spread expression.
   * Uses the template type checker to resolve the type of the spread expression
   * and validates each property of that type.
   */
  private validateSpreadProperties(
    value: AST,
    spreadSpan: {start: number; end: number},
    seenProperties: Map<string, {key: LiteralMapKey; index: number}>,
  ): void {
    // The value for a spread key is the expression being spread (e.g., PropertyRead for `baseStyles`)
    // It's NOT wrapped in SpreadElement - the spread info is in the key.kind
    let spreadExpr: AST = value;

    // If it's wrapped in SpreadElement, unwrap it
    if (value instanceof SpreadElement) {
      spreadExpr = value.expression;
    }

    // Use the template type checker to resolve the type of the spread expression
    const symbol = this.templateTypeChecker.getSymbolOfNode(spreadExpr, this.component);
    if (symbol === null || !('tsType' in symbol)) {
      // Cannot resolve type - skip validation
      return;
    }

    const spreadType = symbol.tsType;

    // Get the properties of the spread type
    const properties = spreadType.getProperties();
    for (const prop of properties) {
      const propName = prop.getName();

      // Validate the property name as a CSS property
      this.validateCssPropertyName(propName, propName, spreadSpan);

      // Track for duplicate detection
      const normalizedProp = normalizeCSSPropertyName(propName);
      if (!seenProperties.has(normalizedProp)) {
        // Mark as seen but with a synthetic key since we don't have a real LiteralMapKey
        seenProperties.set(normalizedProp, {
          key: {
            kind: 'property',
            key: propName,
            quoted: false,
            span: new ParseSpan(spreadSpan.start, spreadSpan.end),
            sourceSpan: spreadSpan,
          },
          index: -1, // Spread properties don't have a specific index
        });
      }
    }
  }

  /**
   * Validates a CSS property name and reports diagnostics for unknown or obsolete properties.
   */
  private validateCssPropertyName(
    propertyName: string,
    fullKey: string,
    sourceSpan: {start: number; end: number},
  ): void {
    // CSS custom properties (--my-var) are always valid
    if (propertyName.startsWith('--')) {
      return;
    }

    // Convert to camelCase for lookup
    const camelCasePropertyName = kebabToCamelCase(propertyName);

    // Check for obsolete CSS property first (takes priority)
    const obsoleteInfo = getObsoleteCSSPropertyInfo(camelCasePropertyName);
    if (obsoleteInfo !== undefined) {
      const displayName = propertyName.includes('-')
        ? camelToKebabCase(camelCasePropertyName)
        : camelCasePropertyName;
      let message = `CSS property '${displayName}' is deprecated. ${obsoleteInfo.message}`;
      if (obsoleteInfo.replacement) {
        const replacementDisplay = propertyName.includes('-')
          ? camelToKebabCase(obsoleteInfo.replacement)
          : obsoleteInfo.replacement;
        message += ` Consider using '${replacementDisplay}' instead.`;
      }
      message += ` See: ${obsoleteInfo.mdnUrl}`;

      this.diagnostics.push({
        category: ts.DiagnosticCategory.Warning, // Always warning for obsolete
        code: CssDiagnosticCode.OBSOLETE_CSS_PROPERTY_IN_OBJECT,
        messageText: message,
        file: this.diagnosticSourceFile,
        start: sourceSpan.start,
        length: sourceSpan.end - sourceSpan.start,
        source: 'angular',
      });
      return; // Skip unknown check if obsolete
    }

    if (!isValidCSSProperty(camelCasePropertyName)) {
      const suggestions = findSimilarCSSProperties(camelCasePropertyName);
      let message = `Unknown CSS property '${propertyName}'.`;
      if (suggestions.length > 0) {
        // Convert suggestion to kebab-case if original was kebab-case
        const suggestionForDisplay = propertyName.includes('-')
          ? camelToKebabCase(suggestions[0])
          : suggestions[0];
        message += ` Did you mean '${suggestionForDisplay}'?`;
        if (suggestions.length > 1) {
          const otherSuggestions = suggestions
            .slice(1)
            .map((s) => (propertyName.includes('-') ? camelToKebabCase(s) : s));
          message += ` Other suggestions: ${otherSuggestions.join(', ')}.`;
        }
      }

      this.diagnostics.push({
        category: this.severity,
        code: CssDiagnosticCode.UNKNOWN_CSS_PROPERTY_IN_OBJECT,
        messageText: message,
        file: this.diagnosticSourceFile,
        start: sourceSpan.start,
        length: sourceSpan.end - sourceSpan.start,
        source: 'angular',
      });
    }
  }

  /**
   * Get file location string for a binding (e.g., "app.html(8, 33)").
   */
  private getBindingLocation(binding: StyleBinding): string {
    const file = binding.hostSourceFile || this.diagnosticSourceFile;
    const fileName = file.fileName.split('/').pop() || file.fileName;

    if (binding.attribute.keySpan) {
      const pos = file.getLineAndCharacterOfPosition(binding.attribute.keySpan.start.offset);
      return `${fileName}(${pos.line + 1}, ${pos.character + 1})`;
    }

    return fileName;
  }

  /**
   * Emits comprehensive binding conflict diagnostic (99021) showing all bindings grouped by source.
   */
  private emitComprehensiveBindingConflict(
    property: string,
    sorted: StyleBinding[],
    winner: StyleBinding,
  ): void {
    // Group bindings by source
    const sources = new Map<
      string,
      {label: string; bindings: StyleBinding[]; precedence: number}
    >();

    for (const binding of sorted) {
      let sourceKey: string;
      let sourceLabel: string;
      let sourcePrecedence: number;

      if (
        binding.bindingType === 'individual' ||
        binding.bindingType === 'objectLiteral' ||
        binding.bindingType === 'directive'
      ) {
        sourceKey = 'template';
        sourceLabel = 'Template bindings';
        sourcePrecedence = BASE_BINDING_PRECEDENCE[binding.bindingType];
      } else if (
        binding.bindingType === 'hostIndividual' ||
        binding.bindingType === 'hostObjectLiteral'
      ) {
        sourceKey = 'component-host';
        sourceLabel = 'Component host bindings';
        sourcePrecedence = BASE_BINDING_PRECEDENCE[binding.bindingType];
      } else if (
        binding.bindingType === 'hostDirectiveIndividual' ||
        binding.bindingType === 'directiveHostIndividual'
      ) {
        sourceKey = `directive-${binding.directiveName || 'unknown'}`;
        sourceLabel = `Directive '${binding.directiveName || 'unknown'}' host bindings`;
        sourcePrecedence = BASE_BINDING_PRECEDENCE[binding.bindingType];
      } else {
        sourceKey = 'other';
        sourceLabel = 'Other bindings';
        sourcePrecedence = 99;
      }

      if (!sources.has(sourceKey)) {
        sources.set(sourceKey, {label: sourceLabel, bindings: [], precedence: sourcePrecedence});
      }
      sources.get(sourceKey)!.bindings.push(binding);
    }

    // Sort sources by precedence (winners first)
    const sortedSources = Array.from(sources.entries()).sort(
      (a, b) => a[1].precedence - b[1].precedence,
    );

    // Build message (plain text, no Markdown - VS Code diagnostics don't support it)
    let messageLines: string[] = [];
    const totalBindings = sorted.length;
    messageLines.push(
      `CSS property '${camelToKebabCase(property)}' is bound ${totalBindings} time${totalBindings > 1 ? 's' : ''} via multiple sources:`,
    );
    messageLines.push('');

    let globalIndex = 1;
    let winnerDeclared = false;

    for (const [sourceKey, source] of sortedSources) {
      // Get file position for this source's first binding (used in header if all bindings are from same location)
      const firstBinding = source.bindings[0];
      const firstLocation = this.getBindingLocation(firstBinding);

      // If all bindings in this source are from same location, show it in the header
      const allSameLocation = source.bindings.every((b) => {
        const loc = this.getBindingLocation(b);
        return loc === firstLocation;
      });

      if (allSameLocation && firstLocation) {
        messageLines.push(`${source.label} ${firstLocation}:`);
      } else {
        messageLines.push(`${source.label}:`);
      }

      for (let i = 0; i < source.bindings.length; i++) {
        const b = source.bindings[i];

        // Get proper binding name with prefix (e.g., [style.backgroundColor])
        const bindingName =
          b.attribute.type === BindingType.Style
            ? `[style.${b.originalPropertyName}]`
            : `[${b.attribute.name}]`;

        // Get value snippet
        let valueSnippet = '';
        if (b.attribute.valueSpan) {
          const text = (b.hostSourceFile || this.diagnosticSourceFile).getFullText();
          const start = b.attribute.valueSpan.start.offset;
          const end = b.attribute.valueSpan.end.offset;
          const raw = text.slice(start, end).trim();
          valueSnippet = raw ? ` = ${raw}` : '';
        }

        // Get location for this binding (only if not shown in header)
        const locationSuffix = !allSameLocation ? ` ${this.getBindingLocation(b)}` : '';

        // Determine status
        let status = '';
        if (globalIndex === 1 && !winnerDeclared) {
          status = ' [WINS]';
          winnerDeclared = true;
        } else if (i > 0) {
          // Duplicate within same source
          status = ' [duplicate, ignored]';
        } else if (sortedSources.length > 1) {
          // First in this source but not global winner
          status = ` [overridden by ${sortedSources[0][1].label.toLowerCase()}]`;
        }

        messageLines.push(
          `  ${globalIndex}. ${bindingName}${valueSnippet}${locationSuffix}${status}`,
        );
        globalIndex++;
      }

      messageLines.push('');
    }

    // Add precedence explanation if there are conflicts
    if (sortedSources.length > 1) {
      const winnerSource = sortedSources[0][1];
      const loserSource = sortedSources[1][1];
      messageLines.push(`Precedence: ${winnerSource.label} > ${loserSource.label}`);

      // Final result line
      const winnerBinding = winnerSource.bindings[0];
      if (winnerBinding.attribute.valueSpan) {
        const text = (winnerBinding.hostSourceFile || this.diagnosticSourceFile).getFullText();
        const start = winnerBinding.attribute.valueSpan.start.offset;
        const end = winnerBinding.attribute.valueSpan.end.offset;
        const value = text.slice(start, end).trim();
        messageLines.push(
          `Result: First ${winnerSource.label.toLowerCase()} binding wins (${value})`,
        );
      }
    } else {
      // Only duplicates within same source
      messageLines.push(`Result: First binding wins, duplicates are ignored`);
    }

    const messageText = messageLines.join('\n');

    // Helper to get binding span (for directive host bindings, use elementSpan)
    const getBindingSpan = (b: StyleBinding, fallbackBinding?: StyleBinding) => {
      if (b.bindingType === 'directiveHostIndividual') {
        if (b.elementSpan) {
          return b.elementSpan;
        }
        // Fallback: use winner's span to keep diagnostic in template
        if (fallbackBinding && fallbackBinding.bindingType !== 'directiveHostIndividual') {
          return {
            start: fallbackBinding.attribute.keySpan.start.offset,
            end: fallbackBinding.attribute.keySpan.end.offset,
          };
        }
      }
      return {
        start: b.attribute.keySpan.start.offset,
        end: b.attribute.keySpan.end.offset,
      };
    };

    // Place diagnostic on the lowest precedence (losing) binding
    const lowestPrecedence = sorted[sorted.length - 1];
    const lowestSpan = getBindingSpan(lowestPrecedence, winner);

    this.diagnostics.push({
      category: this.severity,
      code: CssDiagnosticCode.COMPREHENSIVE_BINDING_CONFLICT,
      messageText: messageText,
      file: this.diagnosticSourceFile,
      start: lowestSpan.start,
      length: lowestSpan.end - lowestSpan.start,
      source: 'angular',
      relatedInformation: sorted.slice(0, -1).map((b, idx) => {
        const span = getBindingSpan(b);
        const bindingName =
          b.attribute.type === BindingType.Style
            ? `[style.${b.originalPropertyName}]`
            : `[${b.attribute.name}]`;
        const sourceDesc = getBindingTypeDescription(b.bindingType, b.directiveName, 'style');
        return {
          category: ts.DiagnosticCategory.Message,
          code: 0,
          file: this.diagnosticSourceFile,
          start: span.start,
          length: span.end - span.start,
          messageText: `${bindingName} (${sourceDesc})${idx === 0 ? ' - WINS' : ''}`,
        };
      }),
    });
  }

  /**
   * Collects all style properties being set on an element and detects conflicts.
   */
  private detectStyleBindingConflicts(element: TmplAstElement | TmplAstTemplate): void {
    const elementName = 'name' in element ? element.name : 'ng-template';
    // @ts-ignore DEBUG
    console.log(
      `[CSS_DIAG] detectStyleBindingConflicts for <${elementName}> with ${element.inputs.length} inputs`,
    );

    // Collect all style bindings by normalized property name
    const bindingsByProperty = new Map<string, StyleBinding[]>();

    for (const input of element.inputs) {
      // @ts-ignore DEBUG
      console.log(`[CSS_DIAG]   Input: type=${BindingType[input.type]}, name='${input.name}'`);

      // Individual style binding: [style.prop]
      if (input.type === BindingType.Style) {
        const propertyName = input.name.split('.')[0];
        const normalized = normalizeCSSPropertyName(propertyName);
        // @ts-ignore DEBUG
        console.log(
          `[CSS_DIAG]     -> Style binding: propertyName='${propertyName}', normalized='${normalized}'`,
        );
        const binding: StyleBinding = {
          property: normalized,
          bindingType: 'individual',
          attribute: input,
          originalName: propertyName,
          normalizedName: normalized,
          originalPropertyName: propertyName,
        };
        const existing = bindingsByProperty.get(normalized) || [];
        existing.push(binding);
        bindingsByProperty.set(normalized, existing);
      }
      // Object style binding: [style]="{}" or [ngStyle]="{}"
      else if (input.type === BindingType.Property) {
        if (input.name === 'style' || input.name === 'ngStyle') {
          const bindingType: BaseBindingType =
            input.name === 'style' ? 'objectLiteral' : 'directive';
          // Extract properties from the object literal
          const properties = this.extractPropertiesFromStyleBinding(input);
          // @ts-ignore DEBUG
          console.log(
            `[CSS_DIAG]     -> ${bindingType} binding with ${properties.length} properties`,
          );
          for (const prop of properties) {
            const normalized = normalizeCSSPropertyName(prop.name);
            const binding: StyleBinding = {
              property: normalized,
              bindingType,
              attribute: input,
              originalName: prop.name,
              normalizedName: normalized,
              originalPropertyName: prop.name,
              propertySpan: {start: prop.span.start, end: prop.span.end},
            };
            const existing = bindingsByProperty.get(normalized) || [];
            existing.push(binding);
            bindingsByProperty.set(normalized, existing);
          }
        }
      }
    }

    // Collect directive host style bindings that apply to this element
    // Only for TmplAstElement (not ng-template)
    if ('name' in element) {
      const directives = this.templateTypeChecker.getDirectivesOfNode(this.component, element);
      if (directives) {
        for (const directive of directives) {
          // Skip the component itself - we're looking for attribute directives
          if (directive.isComponent) continue;

          // Get the class declaration from the directive reference
          const dirNode = directive.ref.node;
          if (!ts.isClassDeclaration(dirNode)) continue;

          // Get the host element for this directive
          const hostElement = this.templateTypeChecker.getHostElement(dirNode);
          if (!hostElement) continue;

          // Get the directive name for error messages
          const directiveName = dirNode.name?.text ?? 'unknown';

          // Get the directive's source file for reading host binding values
          const directiveSourceFile = dirNode.getSourceFile();

          // Find the directive's selector attribute on the element for precise span
          // Parse selector like '[appBackgroundColorApplier]' to extract 'appBackgroundColorApplier'
          let directiveAttrSpan: {start: number; end: number} | undefined;
          if (directive.selector) {
            // Extract attribute name from selector (e.g., '[myAttr]' -> 'myAttr')
            const attrMatch = directive.selector.match(/\[([^\]]+)\]/);
            if (attrMatch) {
              const attrName = attrMatch[1];
              // Find matching attribute on element
              const matchingAttr = element.attributes.find((a) => a.name === attrName);
              if (matchingAttr) {
                directiveAttrSpan = {
                  start: matchingAttr.sourceSpan.start.offset,
                  end: matchingAttr.sourceSpan.end.offset,
                };
              }
            }
          }

          // Fallback to template binding that wins (first input with style binding for this property)
          // This ensures diagnostic shows on the template side, not directive definition

          for (const binding of hostElement.bindings) {
            if (binding.type === BindingType.Style) {
              const propertyName = binding.name.split('.')[0];
              const normalized = normalizeCSSPropertyName(propertyName);
              // @ts-ignore DEBUG
              console.log(
                `[CSS_DIAG]     -> Directive '${directiveName}' host style binding: propertyName='${propertyName}', normalized='${normalized}'`,
              );
              const styleBinding: StyleBinding = {
                property: normalized,
                bindingType: 'directiveHostIndividual',
                attribute: binding,
                originalName: propertyName,
                normalizedName: normalized,
                originalPropertyName: propertyName,
                directiveName,
                // Use directive attribute span if found, otherwise undefined (will use winner's span)
                elementSpan: directiveAttrSpan,
                hostSourceFile: directiveSourceFile,
              };
              const existing = bindingsByProperty.get(normalized) || [];
              existing.push(styleBinding);
              bindingsByProperty.set(normalized, existing);
            }
          }
        }
      }
    }

    // Log all collected bindings
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG]   Collected ${bindingsByProperty.size} unique properties:`);
    for (const [prop, bindings] of bindingsByProperty) {
      // @ts-ignore DEBUG
      console.log(
        `[CSS_DIAG]     '${prop}' -> ${bindings.map((b) => b.originalPropertyName + '(' + b.bindingType + ')').join(', ')}`,
      );
    }

    // Check for conflicts - produce ONE diagnostic per property that lists ALL conflicts
    for (const [property, bindings] of bindingsByProperty) {
      if (bindings.length <= 1) continue;

      // Sort by precedence (lowest number = highest precedence = wins)
      const sorted = [...bindings].sort(
        (a, b) => BASE_BINDING_PRECEDENCE[a.bindingType] - BASE_BINDING_PRECEDENCE[b.bindingType],
      );
      const winner = sorted[0];
      const losers = sorted.slice(1);

      // Check if ALL bindings are the same type (pure duplicates) vs mixed types (conflicts)
      const allSameType = bindings.every((b) => b.bindingType === winner.bindingType);

      // NEW: Comprehensive diagnostic format (99021)
      if (this.config.useComprehensiveBindingConflict) {
        this.emitComprehensiveBindingConflict(property, sorted, winner);
        continue;
      }

      // LEGACY: Separate diagnostics for duplicates (99020) and conflicts (99005)
      if (allSameType) {
        // PURE DUPLICATES: All bindings are same type (e.g., multiple [style.prop])
        const bindingDescription = getBindingTypeDescription(
          winner.bindingType,
          winner.directiveName,
          'style',
        );

        // Helper to render display name and value snippet
        const render = (b: StyleBinding, idx: number) => {
          const kebab = camelToKebabCase(b.originalPropertyName);
          const original = b.originalPropertyName;
          const nameDisplay = kebab === original ? kebab : `${kebab} (${original})`;
          // Try to get a value snippet for individual bindings
          let valueSnippet = '';
          if (b.attribute.valueSpan) {
            // For directive/component host bindings, use their source file
            // For template bindings, use the template source file
            const text = (b.hostSourceFile || this.diagnosticSourceFile).getFullText();
            const start = b.attribute.valueSpan.start.offset;
            const end = b.attribute.valueSpan.end.offset;
            const raw = text.slice(start, end).trim();
            valueSnippet = raw ? ` — value: ${raw}` : '';
          }
          // For object bindings, show a concise mention, include the exact property key if we have a span
          if (b.bindingType === 'objectLiteral' || b.bindingType === 'directive') {
            if (b.propertySpan) {
              const text = this.diagnosticSourceFile.getFullText();
              const keyRaw = text.slice(b.propertySpan.start, b.propertySpan.end).trim();
              return `${idx + 1}. ${nameDisplay} from [${b.attribute.name}]={ ${keyRaw} }`;
            }
            return `${idx + 1}. ${nameDisplay} from [${b.attribute.name}]`;
          }
          return `${idx + 1}. ${nameDisplay} from [style.${original}]${valueSnippet}`;
        };

        const allOccurrences = sorted.map((b, idx) => render(b, idx)).join('\n');
        const lastBinding = sorted[sorted.length - 1];
        const firstBinding = sorted[0]; // Winner for fallback

        // For directive host bindings, use the element span (where directive is applied in template)
        // NOT the directive definition span. For template bindings, use the attribute keySpan.
        // If elementSpan is undefined for directive, use the winner's span (keep diagnostic in template file)
        const getBindingSpan = (b: StyleBinding, fallbackBinding?: StyleBinding) => {
          if (b.bindingType === 'directiveHostIndividual') {
            if (b.elementSpan) {
              return b.elementSpan;
            }
            // Fallback: use winner's span to keep diagnostic in template
            if (fallbackBinding && fallbackBinding.bindingType !== 'directiveHostIndividual') {
              return {
                start: fallbackBinding.attribute.keySpan.start.offset,
                end: fallbackBinding.attribute.keySpan.end.offset,
              };
            }
          }
          return {
            start: b.attribute.keySpan.start.offset,
            end: b.attribute.keySpan.end.offset,
          };
        };

        const lastSpan = getBindingSpan(lastBinding, firstBinding);

        this.diagnostics.push({
          category: this.severity,
          code: CssDiagnosticCode.DUPLICATE_STYLE_BINDING,
          messageText:
            `CSS property '${camelToKebabCase(property)}' is set ${bindings.length} times via ${bindingDescription}.\n` +
            `The first occurrence wins, subsequent bindings are ignored:\n${allOccurrences}`,
          file: this.diagnosticSourceFile,
          start: lastSpan.start,
          length: lastSpan.end - lastSpan.start,
          source: 'angular',
          relatedInformation: sorted.slice(0, -1).map((b, idx) => {
            const span = getBindingSpan(b);
            return {
              category: ts.DiagnosticCategory.Message,
              code: 0,
              file: this.diagnosticSourceFile,
              start: span.start,
              length: span.end - span.start,
              messageText: `Occurrence #${idx + 1}: ${camelToKebabCase(b.originalPropertyName)} from [${b.attribute.name}]${idx === 0 ? ' (WINS)' : ''}`,
            };
          }),
        });
      } else {
        // MIXED TYPES: Different binding types with different precedence

        const render = (b: StyleBinding, idx: number) => {
          const kebab = camelToKebabCase(b.originalPropertyName);
          const original = b.originalPropertyName;
          const nameDisplay = kebab === original ? kebab : `${kebab} (${original})`;

          if (b.bindingType === 'objectLiteral' || b.bindingType === 'directive') {
            // Show property origin from object binding, include the exact key when available
            if (b.propertySpan) {
              const text = this.diagnosticSourceFile.getFullText();
              const keyRaw = text.slice(b.propertySpan.start, b.propertySpan.end).trim();
              return `${idx + 1}. ${nameDisplay} from [${b.attribute.name}]={ ${keyRaw} }`;
            }
            return `${idx + 1}. ${nameDisplay} from [${b.attribute.name}]`; // e.g., from [style]
          }

          // Individual binding
          let valueSnippet = '';
          if (b.attribute.valueSpan) {
            // For directive/component host bindings, use their source file
            // For template bindings, use the template source file
            const text = (b.hostSourceFile || this.diagnosticSourceFile).getFullText();
            const start = b.attribute.valueSpan.start.offset;
            const end = b.attribute.valueSpan.end.offset;
            const raw = text.slice(start, end).trim();
            valueSnippet = raw ? ` — value: ${raw}` : '';
          }

          return `${idx + 1}. ${nameDisplay} from [style.${original}]${valueSnippet} (${getBindingTypeDescription(b.bindingType, b.directiveName, 'style')})`;
        };

        const precedenceList = sorted.map((b, idx) => render(b, idx)).join('\n');

        const lowestPrecedence = sorted[sorted.length - 1];

        // Also include a short consensus sentence about which binding type wins over which
        const second = sorted[1];
        const summary = `The ${getBindingTypeDescription(winner.bindingType, winner.directiveName, 'style')} binding takes precedence over ${getBindingTypeDescription(second.bindingType, second.directiveName, 'style')}.`;

        // For directive host bindings, use the element span (where directive is applied in template)
        // NOT the directive definition span. For template bindings, use the attribute keySpan.
        // If elementSpan is undefined for directive, use the winner's span (keep diagnostic in template file)
        const getBindingSpan = (b: StyleBinding, fallbackBinding?: StyleBinding) => {
          // @ts-ignore DEBUG
          console.log(
            `[CSS_DIAG] getBindingSpan: type=${b.bindingType}, elementSpan=${JSON.stringify(b.elementSpan)}, keySpan=${JSON.stringify({start: b.attribute.keySpan?.start?.offset, end: b.attribute.keySpan?.end?.offset})}, fallback=${fallbackBinding?.bindingType}`,
          );
          if (b.bindingType === 'directiveHostIndividual') {
            if (b.elementSpan) {
              // @ts-ignore DEBUG
              console.log(`[CSS_DIAG]   -> Using elementSpan`);
              return b.elementSpan;
            }
            // Fallback: use winner's span to keep diagnostic in template
            if (fallbackBinding && fallbackBinding.bindingType !== 'directiveHostIndividual') {
              // @ts-ignore DEBUG
              console.log(
                `[CSS_DIAG]   -> Using fallback span from ${fallbackBinding.bindingType}`,
              );
              return {
                start: fallbackBinding.attribute.keySpan.start.offset,
                end: fallbackBinding.attribute.keySpan.end.offset,
              };
            }
            // @ts-ignore DEBUG
            console.log(
              `[CSS_DIAG]   -> FALLTHROUGH: no elementSpan, no valid fallback! Using directive's keySpan (WRONG FILE!)`,
            );
          }
          return {
            start: b.attribute.keySpan.start.offset,
            end: b.attribute.keySpan.end.offset,
          };
        };

        const lowestSpan = getBindingSpan(lowestPrecedence, winner);

        this.diagnostics.push({
          category: this.severity,
          code: CssDiagnosticCode.CONFLICTING_STYLE_BINDING,
          messageText:
            `CSS property '${camelToKebabCase(property)}' is set via ${bindings.length} different bindings with conflicting precedence.\n` +
            `Precedence order (first wins):\n${precedenceList}\n\n${summary}`,
          file: this.diagnosticSourceFile,
          start: lowestSpan.start,
          length: lowestSpan.end - lowestSpan.start,
          source: 'angular',
          relatedInformation: sorted.slice(0, -1).map((b, idx) => {
            const span = getBindingSpan(b);
            return {
              category: ts.DiagnosticCategory.Message,
              code: 0,
              file: this.diagnosticSourceFile,
              start: span.start,
              length: span.end - span.start,
              messageText: `${camelToKebabCase(b.originalPropertyName)} from [${b.attribute.name}] (${getBindingTypeDescription(b.bindingType, b.directiveName, 'style')})${idx === 0 ? ' - WINS' : ''}`,
            };
          }),
        });
      }
    }

    // Check for shorthand/longhand conflicts
    // When both a shorthand (e.g., 'background') and one of its longhands (e.g., 'backgroundColor')
    // are set, the shorthand will override the longhand values
    this.detectShorthandLonghandConflicts(bindingsByProperty);
  }

  /**
   * Detects conflicts between CSS shorthand and longhand properties.
   * For example, setting both [style.background] and [style.backgroundColor]
   * will result in backgroundColor being overridden by the background shorthand.
   */
  private detectShorthandLonghandConflicts(bindingsByProperty: Map<string, StyleBinding[]>): void {
    // Get all unique property names (these are normalized - all lowercase)
    const propertyNames = Array.from(bindingsByProperty.keys());
    // @ts-ignore DEBUG
    console.log(
      `[CSS_DIAG] detectShorthandLonghandConflicts: checking ${propertyNames.length} properties: [${propertyNames.join(', ')}]`,
    );

    // Check each shorthand property for longhand conflicts
    for (const normalizedProperty of propertyNames) {
      // Get the first binding to get the original (unnormalized) property name
      const bindings = bindingsByProperty.get(normalizedProperty);
      if (!bindings || bindings.length === 0) continue;

      // Get the original property name and convert to camelCase for shorthand lookup
      const originalName = bindings[0].originalPropertyName;
      const camelCaseName = kebabToCamelCase(originalName);
      const isShorthand = isShorthandProperty(camelCaseName);
      // @ts-ignore DEBUG
      console.log(
        `[CSS_DIAG]   Checking '${normalizedProperty}': original='${originalName}', camelCase='${camelCaseName}', isShorthand=${isShorthand}`,
      );

      // Skip if this property isn't a shorthand
      if (!isShorthand) continue;

      const shorthandBindings = bindings;

      // Get the longhands for this shorthand
      const longhands = getShorthandLonghands(camelCaseName);
      // @ts-ignore DEBUG
      console.log(`[CSS_DIAG]     '${camelCaseName}' has longhands: [${longhands.join(', ')}]`);

      // Check if any longhand is also being set
      for (const longhand of longhands) {
        // Normalize the longhand for lookup in the map
        const normalizedLonghand = longhand.toLowerCase();
        const longhandBindings = bindingsByProperty.get(normalizedLonghand);
        // @ts-ignore DEBUG
        console.log(
          `[CSS_DIAG]       Looking for longhand '${longhand}' (normalized: '${normalizedLonghand}'): found=${longhandBindings ? 'YES' : 'NO'}`,
        );
        if (!longhandBindings || longhandBindings.length === 0) continue;

        // @ts-ignore DEBUG
        console.log(
          `[CSS_DIAG]       *** CONFLICT FOUND! shorthand='${camelCaseName}' vs longhand='${longhand}'`,
        );

        // Report conflict - the shorthand will override the longhand
        // Report on the longhand binding since that's the one that will be overridden
        for (const longhandBinding of longhandBindings) {
          const shorthandBinding = shorthandBindings[0]; // Use first shorthand as reference
          const shorthandDisplay = camelToKebabCase(shorthandBinding.originalPropertyName);
          const longhandDisplay = camelToKebabCase(longhandBinding.originalPropertyName);

          // @ts-ignore DEBUG
          console.log(
            `[CSS_DIAG]       Pushing SHORTHAND_OVERRIDE diagnostic for '${longhandDisplay}'`,
          );
          // @ts-ignore DEBUG
          console.log(
            `[CSS_DIAG]       Longhand keySpan: start=${longhandBinding.attribute.keySpan?.start.offset}, end=${longhandBinding.attribute.keySpan?.end.offset}`,
          );
          // @ts-ignore DEBUG
          console.log(
            `[CSS_DIAG]       Shorthand keySpan: start=${shorthandBinding.attribute.keySpan?.start.offset}, end=${shorthandBinding.attribute.keySpan?.end.offset}`,
          );
          // @ts-ignore DEBUG
          console.log(`[CSS_DIAG]       Component file: ${this.diagnosticSourceFile.fileName}`);
          this.diagnostics.push({
            category: ts.DiagnosticCategory.Warning,
            code: CssDiagnosticCode.SHORTHAND_OVERRIDE,
            messageText:
              `CSS property '${longhandDisplay}' will be overridden by the '${shorthandDisplay}' shorthand property. ` +
              `The shorthand resets all of its longhand properties. ` +
              `Consider using only the shorthand or only the longhand properties.`,
            file: this.diagnosticSourceFile,
            start: longhandBinding.attribute.keySpan.start.offset,
            length:
              longhandBinding.attribute.keySpan.end.offset -
              longhandBinding.attribute.keySpan.start.offset,
            source: 'angular',
            relatedInformation: [
              {
                category: ts.DiagnosticCategory.Message,
                code: 0,
                file: this.diagnosticSourceFile,
                start: shorthandBinding.attribute.keySpan.start.offset,
                length:
                  shorthandBinding.attribute.keySpan.end.offset -
                  shorthandBinding.attribute.keySpan.start.offset,
                messageText: `'${shorthandDisplay}' shorthand is set here`,
              },
            ],
          });
        }
      }
    }
  }

  /**
   * Checks if an input is an [ngClass] binding and suggests migration to [class].
   */
  private checkNgClassBinding(input: TmplAstBoundAttribute): void {
    if (input.type !== BindingType.Property || input.name !== 'ngClass') {
      return;
    }
    if (!input.keySpan || input.keySpan.start.offset < 0) {
      return;
    }

    // Produce a suggestion-level diagnostic
    this.diagnostics.push({
      category: ts.DiagnosticCategory.Suggestion,
      code: CssDiagnosticCode.PREFER_CLASS_OVER_NGCLASS,
      messageText:
        `Consider using [class] instead of [ngClass]. ` +
        `The [class] binding supports all the same value types and is more direct.`,
      file: this.diagnosticSourceFile,
      start: input.keySpan.start.offset,
      length: input.keySpan.end.offset - input.keySpan.start.offset,
      source: 'angular',
    });
  }

  /**
   * Checks if an input is a [style] object binding and suggests individual bindings.
   */
  private checkStyleObjectBinding(input: TmplAstBoundAttribute): void {
    if (input.type !== BindingType.Property || input.name !== 'style') {
      return;
    }
    if (!input.keySpan || input.keySpan.start.offset < 0) {
      return;
    }

    // Unwrap to check if this is a literal map (object literal)
    let ast: AST = input.value;
    if (ast instanceof ASTWithSource) {
      ast = ast.ast;
    }

    // Only suggest for direct object literals (not variable references)
    if (!(ast instanceof LiteralMap)) {
      return;
    }

    // Don't suggest for objects with spread operators (too complex to convert)
    const hasSpread = ast.keys.some((key) => key.kind === 'spread');
    if (hasSpread) {
      return;
    }

    // Get the properties from the style object
    const properties = ast.keys
      .filter((key) => key.kind === 'property')
      .map((key) => ({name: key.key.split('.')[0], span: key.sourceSpan}));

    // Only suggest conversion for small objects (1-5 properties)
    if (properties.length === 0 || properties.length > 5) {
      return;
    }

    const propNames = properties.map((p) => p.name);
    const propList = propNames.map((p) => `[style.${p}]`).join(', ');

    this.diagnostics.push({
      category: ts.DiagnosticCategory.Suggestion,
      code: CssDiagnosticCode.PREFER_INDIVIDUAL_STYLE_BINDINGS,
      messageText:
        `Consider using individual style bindings (${propList}) instead of [style] object. ` +
        `Individual bindings are more explicit and easier to maintain.`,
      file: this.diagnosticSourceFile,
      start: input.keySpan.start.offset,
      length: input.keySpan.end.offset - input.keySpan.start.offset,
      source: 'angular',
    });
  }

  /**
   * Checks if an element has multiple individual [style.x] bindings and suggests
   * consolidating them into a single [style] object binding.
   * Only suggests if none of the bindings use pipes (pipes aren't supported in object literal values).
   */
  private checkMultipleIndividualStyleBindings(element: TmplAstElement | TmplAstTemplate): void {
    // Collect all individual style bindings
    const styleBindings = element.inputs.filter(
      (input) =>
        input.type === BindingType.Style && input.keySpan && input.keySpan.start.offset >= 0,
    );

    // Only suggest consolidation when there are 3+ bindings (minor benefit for 2)
    if (styleBindings.length < 3) {
      return;
    }

    // Check if any binding uses pipes - if so, skip (can't use pipes in object literals)
    for (const binding of styleBindings) {
      if (containsPipe(binding.value)) {
        // At least one binding uses a pipe - don't suggest consolidation
        return;
      }
    }

    // Also skip if there's already a [style] object binding (avoid conflict)
    const hasStyleObjectBinding = element.inputs.some(
      (input) => input.type === BindingType.Property && input.name === 'style',
    );
    if (hasStyleObjectBinding) {
      return;
    }

    // Report on the first binding as representative
    const firstBinding = styleBindings[0];
    const propNames = styleBindings.map((b) => b.name.split('.')[0]);
    const propList = propNames.join(', ');

    this.diagnostics.push({
      category: ts.DiagnosticCategory.Suggestion,
      code: CssDiagnosticCode.PREFER_STYLE_OBJECT_BINDING,
      messageText:
        `Consider consolidating ${styleBindings.length} individual style bindings (${propList}) into a single [style] object. ` +
        `This can make the template more concise.`,
      file: this.diagnosticSourceFile,
      start: firstBinding.keySpan!.start.offset,
      length: firstBinding.keySpan!.end.offset - firstBinding.keySpan!.start.offset,
      source: 'angular',
    });
  }

  /**
   * Extracts property names from a style object binding ([style]="{...}" or [ngStyle]="{...}").
   */
  private extractPropertiesFromStyleBinding(
    attribute: TmplAstBoundAttribute,
  ): {name: string; span: {start: number; end: number}}[] {
    const properties: {name: string; span: {start: number; end: number}}[] = [];

    // Unwrap ASTWithSource to get the actual AST
    let ast: AST = attribute.value;
    if (ast instanceof ASTWithSource) {
      ast = ast.ast;
    }

    // Check if the expression is a LiteralMap (object literal)
    if (ast instanceof LiteralMap) {
      for (const key of ast.keys) {
        if (key.kind === 'property') {
          const propName = key.key.split('.')[0]; // Handle "prop.unit" format
          properties.push({name: propName, span: key.sourceSpan});
        } else if (key.kind === 'spread') {
          // For spread, try to resolve properties via type checker
          const spreadProps = this.resolveSpreadProperties(ast.values[ast.keys.indexOf(key)]);
          properties.push(...spreadProps);
        }
      }
    }

    return properties;
  }

  /**
   * Resolves properties from a spread expression for conflict detection.
   */
  private resolveSpreadProperties(
    value: AST,
  ): {name: string; span: {start: number; end: number}}[] {
    const properties: {name: string; span: {start: number; end: number}}[] = [];

    // Get the actual spread expression
    let spreadExpr: AST = value;
    if (value instanceof SpreadElement) {
      spreadExpr = value.expression;
    }

    // Use the template type checker to resolve the type
    const symbol = this.templateTypeChecker.getSymbolOfNode(spreadExpr, this.component);
    if (symbol === null || !('tsType' in symbol)) {
      return properties;
    }

    const spreadType = symbol.tsType;
    const typeProperties = spreadType.getProperties();
    const span = {start: spreadExpr.sourceSpan.start, end: spreadExpr.sourceSpan.end};

    for (const prop of typeProperties) {
      properties.push({name: prop.getName(), span});
    }

    return properties;
  }

  // Required visitor methods
  visitElement(element: TmplAstElement): void {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] visitElement: <${element.name}> with ${element.inputs.length} inputs`);

    // Check for input shadowing (99411, 99412)
    if (this.config.warnOnInputShadowing) {
      const shadowingDiags = detectInputShadowingDiagnostics(
        this.component,
        element,
        this.diagnosticSourceFile,
        this.templateTypeChecker,
        this.severity,
      );
      this.diagnostics.push(...shadowingDiags);
    }

    // First, detect style binding conflicts on this element
    this.detectStyleBindingConflicts(element);

    // Then, process individual bindings for property/unit validation
    for (const input of element.inputs) {
      this.visitBoundAttribute(input);

      // Check for [ngClass] bindings and suggest migration to [class]
      this.checkNgClassBinding(input);

      // Check for [style] object bindings and suggest individual bindings
      this.checkStyleObjectBinding(input);
    }

    // Check for multiple individual style bindings and suggest consolidation
    this.checkMultipleIndividualStyleBindings(element);

    // Recursively visit children
    tmplAstVisitAll(this, element.children);
  }
  visitTemplate(template: TmplAstTemplate): void {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] visitTemplate with ${template.inputs.length} inputs`);

    // Check for input shadowing on <ng-template> elements too
    if (this.config.warnOnInputShadowing) {
      const shadowingDiags = detectInputShadowingDiagnostics(
        this.component,
        template,
        this.diagnosticSourceFile,
        this.templateTypeChecker,
        this.severity,
      );
      this.diagnostics.push(...shadowingDiags);
    }

    // Detect style binding conflicts on ng-template
    this.detectStyleBindingConflicts(template);

    // Process style bindings on template inputs
    for (const input of template.inputs) {
      this.visitBoundAttribute(input);

      // Check for [ngClass] bindings and suggest migration to [class]
      this.checkNgClassBinding(input);

      // Check for [style] object bindings and suggest individual bindings
      this.checkStyleObjectBinding(input);
    }

    // Check for multiple individual style bindings and suggest consolidation
    this.checkMultipleIndividualStyleBindings(template);

    // Recursively visit children
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
  visitDeferredBlock(block: TmplAstDeferredBlock): void {
    // Visit the main content and all sub-blocks
    tmplAstVisitAll(this, block.children);
    if (block.placeholder) this.visitDeferredBlockPlaceholder(block.placeholder);
    if (block.loading) this.visitDeferredBlockLoading(block.loading);
    if (block.error) this.visitDeferredBlockError(block.error);
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
    // Visit all case groups
    for (const group of block.groups) {
      this.visitSwitchBlockCaseGroup(group);
    }
  }
  visitSwitchBlockCase(): void {}
  visitSwitchBlockCaseGroup(group: TmplAstSwitchBlockCaseGroup): void {
    tmplAstVisitAll(this, group.children);
  }
  visitForLoopBlock(block: TmplAstForLoopBlock): void {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] visitForLoopBlock with ${block.children.length} children`);
    tmplAstVisitAll(this, block.children);
    if (block.empty) {
      tmplAstVisitAll(this, block.empty.children);
    }
  }
  visitForLoopBlockEmpty(): void {}
  visitIfBlock(block: TmplAstIfBlock): void {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] visitIfBlock with ${block.branches.length} branches`);
    // Visit all branches
    for (const branch of block.branches) {
      this.visitIfBlockBranch(branch);
    }
  }
  visitIfBlockBranch(branch: TmplAstIfBlockBranch): void {
    // @ts-ignore DEBUG
    console.log(`[CSS_DIAG] visitIfBlockBranch with ${branch.children.length} children`);
    tmplAstVisitAll(this, branch.children);
  }
  visitUnknownBlock(): void {}
  visitLetDeclaration(): void {}
  visitComponent(): void {}
  visitDirective(): void {}
}
/**
 * Checks whether an AST expression contains a pipe (BindingPipe).
 * Used to determine if a style binding value can be safely converted to an object literal.
 */
function containsPipe(ast: AST): boolean {
  // Unwrap ASTWithSource
  if (ast instanceof ASTWithSource) {
    ast = ast.ast;
  }

  // Check if this is a BindingPipe
  if (ast instanceof BindingPipe) {
    return true;
  }

  // Use a visitor to recursively check the AST
  const checker = new PipeDetectorVisitor();
  ast.visit(checker);
  return checker.hasPipe;
}

/**
 * AST visitor that checks for the presence of pipes in an expression.
 */
class PipeDetectorVisitor extends RecursiveAstVisitor {
  hasPipe = false;

  override visitPipe(_ast: BindingPipe, _context: any): any {
    this.hasPipe = true;
    // Don't need to continue once we find a pipe
  }
}

/**
 * Information about a directive that has @Input('class') or @Input('style').
 */
interface DirectiveWithShadowableInput {
  /** The directive's class declaration */
  classDecl: ts.ClassDeclaration;
  /** The directive's name */
  directiveName: string;
  /** The input's class property name */
  classPropertyName: string;
  /** The binding property name ('class' or 'style') */
  bindingPropertyName: string;
}

/**
 * Checks if directives on an element have @Input('class') or @Input('style')
 * that would be shadowed by [class] or [style] bindings.
 */
function getDirectivesWithShadowableInputs(
  component: ts.ClassDeclaration,
  element: TmplAstElement | TmplAstTemplate,
  inputName: 'class' | 'style',
  templateTypeChecker: TemplateTypeChecker,
): DirectiveWithShadowableInput[] {
  const result: DirectiveWithShadowableInput[] = [];

  // Get all directives on this element
  const directives = templateTypeChecker.getDirectivesOfNode(component, element);
  if (!directives) {
    return result;
  }

  for (const directive of directives) {
    if (!ts.isClassDeclaration(directive.ref.node)) {
      continue;
    }

    const classDecl = directive.ref.node;
    const meta = templateTypeChecker.getDirectiveMetadata(classDecl);
    if (!meta) {
      continue;
    }

    // Check if this directive has @Input('class') or @Input('style')
    // meta.inputs is a ClassPropertyMapping with .getByBindingPropertyName()
    const inputMatches = meta.inputs.getByBindingPropertyName(inputName);
    if (inputMatches && inputMatches.length > 0) {
      const directiveName = classDecl.name?.text ?? 'UnknownDirective';

      for (const input of inputMatches) {
        result.push({
          classDecl,
          directiveName,
          classPropertyName: input.classPropertyName,
          bindingPropertyName: input.bindingPropertyName,
        });
      }
    }

    // TODO: Also check host directives (Angular 15+)
    // They would be accessed via directive.hostDirectives
  }

  return result;
}

/**
 * Detects and creates diagnostics when [class] or [style] bindings shadow
 * @Input('class') or @Input('style') on directives.
 *
 * Uses the shared `createShadowingDiagnostic` abstraction from binding_conflict_utils.
 *
 * Returns diagnostics for both 99411 (class shadowing) and 99412 (style shadowing).
 */
function detectInputShadowingDiagnostics(
  component: ts.ClassDeclaration,
  element: TmplAstElement | TmplAstTemplate,
  diagnosticSourceFile: ts.SourceFile,
  templateTypeChecker: TemplateTypeChecker,
  severity: ts.DiagnosticCategory,
): ts.Diagnostic[] {
  const diagnostics: ts.Diagnostic[] = [];

  // Check for [class] or static class attribute
  const hasClassBinding = element.inputs.some(
    (input) => input.type === BindingType.Class && input.name === 'class',
  );
  const hasStaticClass = element.attributes.some((attr) => attr.name === 'class');

  if (hasClassBinding || hasStaticClass) {
    const shadowedDirectives = getDirectivesWithShadowableInputs(
      component,
      element,
      'class',
      templateTypeChecker,
    );

    if (shadowedDirectives.length > 0) {
      // Find the binding to attach the diagnostic to
      const classBinding = element.inputs.find(
        (input) => input.type === BindingType.Class && input.name === 'class',
      );
      const staticClassAttr = element.attributes.find((attr) => attr.name === 'class');

      const targetNode = classBinding || staticClassAttr;
      if (targetNode && targetNode.keySpan) {
        // Convert to ShadowedInput format for abstraction
        const shadowedInputs: ShadowedInput[] = shadowedDirectives.map((d) => ({
          classDecl: d.classDecl,
          directiveName: d.directiveName,
          classPropertyName: d.classPropertyName,
          inputAlias: 'class',
        }));

        const diagnostic = createShadowingDiagnostic({
          templateBinding: targetNode,
          shadowedInputs,
          diagnosticCode: CssDiagnosticCode.CLASS_BINDING_SHADOWS_INPUT,
          severity,
          diagnosticSourceFile,
          bindingPrefix: 'class',
          span: {
            start: targetNode.keySpan.start.offset,
            length: targetNode.keySpan.end.offset - targetNode.keySpan.start.offset,
          },
          findInputDeclaration,
        });

        diagnostics.push(diagnostic);
      }
    }
  }

  // Check for [style] or static style attribute
  const hasStyleBinding = element.inputs.some(
    (input) => input.type === BindingType.Style && input.name === 'style',
  );
  const hasStaticStyle = element.attributes.some((attr) => attr.name === 'style');

  if (hasStyleBinding || hasStaticStyle) {
    const shadowedDirectives = getDirectivesWithShadowableInputs(
      component,
      element,
      'style',
      templateTypeChecker,
    );

    if (shadowedDirectives.length > 0) {
      // Find the binding to attach the diagnostic to
      const styleBinding = element.inputs.find(
        (input) => input.type === BindingType.Style && input.name === 'style',
      );
      const staticStyleAttr = element.attributes.find((attr) => attr.name === 'style');

      const targetNode = styleBinding || staticStyleAttr;
      if (targetNode && targetNode.keySpan) {
        // Convert to ShadowedInput format for abstraction
        const shadowedInputs: ShadowedInput[] = shadowedDirectives.map((d) => ({
          classDecl: d.classDecl,
          directiveName: d.directiveName,
          classPropertyName: d.classPropertyName,
          inputAlias: 'style',
        }));

        const diagnostic = createShadowingDiagnostic({
          templateBinding: targetNode,
          shadowedInputs,
          diagnosticCode: CssDiagnosticCode.STYLE_BINDING_SHADOWS_INPUT,
          severity,
          diagnosticSourceFile,
          bindingPrefix: 'style',
          span: {
            start: targetNode.keySpan.start.offset,
            length: targetNode.keySpan.end.offset - targetNode.keySpan.start.offset,
          },
          findInputDeclaration,
        });

        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

/**
 * Finds the @Input() decorator or input signal declaration for a given class property.
 * Returns the decorator node or property declaration.
 */
function findInputDeclaration(
  classDecl: ts.ClassDeclaration,
  propertyName: string,
): ts.Node | null {
  for (const member of classDecl.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      member.name &&
      ts.isIdentifier(member.name) &&
      member.name.text === propertyName
    ) {
      // Check for @Input() decorator
      if (member.modifiers) {
        for (const modifier of member.modifiers) {
          if (ts.isDecorator(modifier)) {
            const expr = modifier.expression;
            if (
              ts.isCallExpression(expr) &&
              ts.isIdentifier(expr.expression) &&
              expr.expression.text === 'Input'
            ) {
              return modifier;
            }
          }
        }
      }

      // For signal inputs (input(), model()), return the property itself
      return member;
    }

    // Check for setter with @Input decorator
    if (
      ts.isSetAccessor(member) &&
      member.name &&
      ts.isIdentifier(member.name) &&
      member.name.text === propertyName
    ) {
      if (member.modifiers) {
        for (const modifier of member.modifiers) {
          if (ts.isDecorator(modifier)) {
            const expr = modifier.expression;
            if (
              ts.isCallExpression(expr) &&
              ts.isIdentifier(expr.expression) &&
              expr.expression.text === 'Input'
            ) {
              return modifier;
            }
          }
        }
      }
    }
  }

  return null;
}
