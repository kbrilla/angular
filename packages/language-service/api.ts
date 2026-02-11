/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * @module
 * @description
 * Entry point for all public APIs of the language service package.
 */

import type ts from 'typescript';

export interface PluginConfig {
  /**
   * If true, return only Angular results. Otherwise, return Angular + TypeScript
   * results.
   */
  angularOnly: boolean;
  /**
   * If true, enable `strictTemplates` in Angular compiler options regardless
   * of its value in tsconfig.json.
   */
  forceStrictTemplates?: true;

  /**
   * If false, disables parsing control flow blocks in the compiler. Should be used only when older
   * versions of Angular that do not support blocks (pre-v17) used with the language service.
   */
  enableBlockSyntax?: false;

  /**
   * Version of `@angular/core` that was detected in the user's workspace.
   */
  angularCoreVersion?: string;

  /**
   * If false, disables parsing of `@let` declarations in the compiler.
   */
  enableLetSyntax?: false;

  /**
   * Whether selectorless is enabled.
   */
  enableSelectorless?: true;

  /**
   * A list of diagnostic codes that should be supressed in the language service.
   */
  suppressAngularDiagnosticCodes?: number[];

  /**
   * Configuration for Angular-specific inlay hints.
   */
  inlayHints?: {
    /**
     * Show type hints for variables in @for loops.
     */
    forLoopVariableTypes?: boolean;
    /**
     * Show type hints for @if alias variables.
     */
    ifAliasTypes?: boolean;
    /**
     * Show type hints for event parameter types.
     */
    eventParameterTypes?: boolean;
    /**
     * Show type hints for pipe output types.
     */
    pipeOutputTypes?: boolean;
    /**
     * Show type hints for @let declaration types.
     */
    letDeclarationTypes?: boolean;
    /**
     * Show type hints for reference variable types.
     */
    referenceVariableTypes?: boolean;
    /**
     * Show type hints for property binding types.
     */
    propertyBindingTypes?: boolean;
    /**
     * Show type hints for DOM property binding types.
     */
    domPropertyBindingTypes?: boolean;
  };

  /**
   * Configuration for CSS property validation in style bindings.
   * When enabled, provides diagnostics for invalid CSS property names like `[style.colro]`.
   */
  cssPropertyValidation?: boolean | CssDiagnosticsConfig;
}

/**
 * Configuration for CSS property validation diagnostics.
 */
export interface CssDiagnosticsConfig {
  /** Enable or disable CSS property validation. Default: true */
  enabled?: boolean;

  /**
   * Severity level for invalid CSS property diagnostics.
   * - 'error': Show as error (red squiggly)
   * - 'warning': Show as warning (yellow squiggly)
   * - 'suggestion': Show as suggestion (gray dots)
   * Default: 'warning'
   */
  severity?: 'error' | 'warning' | 'suggestion';

  /**
   * Enable fuzzy matching to suggest corrections for misspelled properties.
   * Default: true
   */
  suggestCorrections?: boolean;

  /**
   * Maximum edit distance for fuzzy matching suggestions.
   * Higher values find more suggestions but with less similarity.
   * Default: 2
   */
  maxEditDistance?: number;

  /**
   * Maximum number of correction suggestions to show per invalid property.
   * Default: 3
   */
  maxSuggestions?: number;

  /**
   * Enable strict unit value validation.
   * When enabled, provides suggestions for:
   * - Using numeric strings like '100' instead of numbers with unit suffixes (e.g., [style.width.px]="'100'" → [style.width.px]="100")
   * - Using numbers without units for length properties (e.g., [style.width]="100" → [style.width.px]="100")
   * Default: false
   */
  strictUnitValues?: boolean;

  /**
   * Whether to warn when [class]/[style] bindings shadow directive @Input('class')/@Input('style').
   * This is informational - both the directive input AND DOM attribute will be updated.
   * Default: true
   */
  warnOnInputShadowing?: boolean;
}

export type GetTcbResponse = {
  /**
   * The filename of the SourceFile this typecheck block belongs to.
   * The filename is entirely opaque and unstable, useful only for debugging
   * purposes.
   */
  fileName: string;
  /** The content of the SourceFile this typecheck block belongs to. */
  content: string;
  /**
   * Spans over node(s) in the typecheck block corresponding to the
   * TS code generated for template node under the current cursor position.
   *
   * When the cursor position is over a source for which there is no generated
   * code, `selections` is empty.
   */
  selections: ts.TextSpan[];
};

export type GetComponentLocationsForTemplateResponse = ts.DocumentSpan[];
export type GetTemplateLocationForComponentResponse = ts.DocumentSpan | undefined;

/**
 * Function that can be invoked to show progress when computing
 * refactoring edits.
 *
 * Useful for refactorings which take a long time to compute edits for.
 */
export type ApplyRefactoringProgressFn = (percentage: number, updateMessage: string) => void;

/** Interface describing the result for computing edits of a refactoring. */
export interface ApplyRefactoringResult extends Omit<ts.RefactorEditInfo, 'notApplicableReason'> {
  errorMessage?: string;
  warningMessage?: string;
}

/**
/**
 * Result for linked editing ranges containing the ranges and optional word pattern.
 */
export interface LinkedEditingRanges {
  /** The ranges that should be edited together. */
  ranges: ts.TextSpan[];
  /** An optional word pattern to describe valid tag names. */
  wordPattern?: string;
}

/**
 * Inlay hint kinds.
 */
export enum InlayHintKind {
  Type = 1,
  Parameter = 2,
}

/**
 * An inlay hint label part allows for interactive and composite labels.
 */
export interface InlayHintLabelPart {
  /**
   * The value of this label part.
   */
  value: string;

  /**
   * The tooltip text when you hover over this label part. Can be a string or a MarkupContent.
   */
  tooltip?: string | MarkupContent;
}

/**
 * Markup content for tooltips.
 */
export interface MarkupContent {
  /**
   * The type of the markup.
   */
  kind: 'plaintext' | 'markdown';

  /**
   * The content itself.
   */
  value: string;
}

/**
 * Inlay hint information.
 */
export interface InlayHint {
  /**
   * The position of this hint.
   */
  position: ts.LineAndCharacter;

  /**
   * The label of this hint. A human readable string or an array of
   * InlayHintLabelPart label parts.
   *
   * *Note* that neither the string nor the label part can be empty.
   */
  label: string | InlayHintLabelPart[];

  /**
   * The kind of this hint. Can be omitted in which case the client
   * will fall back to a default.
   */
  kind?: InlayHintKind;

  /**
   * The tooltip text when you hover over this item.
   */
  tooltip?: string | MarkupContent;

  /**
   * Render padding before the hint.
   */
  paddingLeft?: boolean;

  /**
   * Render padding after the hint.
   */
  paddingRight?: boolean;

  /**
   * A data entry field that is preserved on a inlay hint between
   * a `textDocument/inlayHint` and a `inlayHint/resolve` request.
   */
  data?: any;
}

/**
 * A display part for interactive inlay hints.
 * When clicked, can navigate to the definition of the type/parameter.
 */
export interface InlayHintDisplayPart {
  /** The text to display */
  text: string;
  /** Optional navigation target span */
  span?: {
    /** Start offset in the target file */
    start: number;
    /** Length of the span */
    length: number;
  };
  /** Optional target file path for navigation */
  file?: string;
}

/**
 * Represents an Angular-specific inlay hint to be displayed in the editor.
 */
export interface AngularInlayHint {
  /** Offset position where the hint should appear */
  position: number;
  text: string;
  kind: 'Type' | 'Parameter';
  paddingLeft?: boolean;
  paddingRight?: boolean;
  tooltip?: string;
  displayParts?: InlayHintDisplayPart[];
}

/**
 * Configuration for which Angular inlay hints to show.
 */
export interface InlayHintsConfig {
  forLoopVariableTypes?: boolean;
  ifAliasTypes?:
    | boolean
    | 'complex'
    | {
        simpleExpressions?: boolean;
        complexExpressions?: boolean;
      };
  letDeclarationTypes?: boolean;
  referenceVariableTypes?: boolean;
  variableTypeHintsWhenTypeMatchesName?: boolean;
  arrowFunctionParameterTypes?: boolean;
  arrowFunctionReturnTypes?: boolean;
  parameterNameHints?: 'none' | 'literals' | 'all';
  parameterNameHintsWhenArgumentMatchesName?: boolean;
  eventParameterTypes?:
    | boolean
    | {
        nativeEvents?: boolean;
        componentEvents?: boolean;
        animationEvents?: boolean;
      };
  pipeOutputTypes?: boolean;
  propertyBindingTypes?:
    | boolean
    | {
        nativeProperties?: boolean;
        componentInputs?: boolean;
      };
  twoWayBindingSignalTypes?: boolean;
  requiredInputIndicator?: 'none' | 'asterisk' | 'exclamation';
  interactiveInlayHints?: boolean;
  hostListenerArgumentTypes?: boolean;
  switchExpressionTypes?: boolean;
  deferTriggerTypes?: boolean;
}

/**
 * `NgLanguageService` describes an instance of an Angular language service,
 * whose API surface is a strict superset of TypeScript's language service.
 */
export interface NgLanguageService extends ts.LanguageService {
  getTcb(fileName: string, position: number): GetTcbResponse | undefined;

  /**
   * Gets linked editing ranges for synchronized editing of HTML tag pairs.
   *
   * When the cursor is on an element tag name, returns both the opening and closing
   * tag name spans so they can be edited simultaneously. This overrides TypeScript's
   * built-in method which only works for JSX/TSX.
   *
   * @param fileName The file to check
   * @param position The cursor position in the file
   * @returns LinkedEditingRanges if on a tag name, undefined otherwise
   */
  getLinkedEditingRangeAtPosition(
    fileName: string,
    position: number,
  ): LinkedEditingRanges | undefined;
  getComponentLocationsForTemplate(fileName: string): GetComponentLocationsForTemplateResponse;
  getTemplateLocationForComponent(
    fileName: string,
    position: number,
  ): GetTemplateLocationForComponentResponse;
  getTypescriptLanguageService(): ts.LanguageService;

  /**
   * Provide Angular-specific inlay hints for templates.
   *
   * Returns hints for:
   * - @for loop variable types: `@for (user: User of users)`
   * - @if alias types: `@if (data; as result: ApiResult)`
   * - Event parameter types: `(click)="onClick($event: MouseEvent)"`
   * - Pipe output types
   * - @let declaration types
   *
   * @param fileName The file to get inlay hints for
   * @param span The text span to get hints within
   * @param config Optional configuration for which hints to show
   */
  getAngularInlayHints(
    fileName: string,
    span: ts.TextSpan,
    config?: InlayHintsConfig,
  ): AngularInlayHint[];

  applyRefactoring(
    fileName: string,
    positionOrRange: number | ts.TextRange,
    refactorName: string,
    reportProgress: ApplyRefactoringProgressFn,
  ): Promise<ApplyRefactoringResult | undefined>;

  hasCodeFixesForErrorCode(errorCode: number): boolean;

  getTokenTypeFromClassification(classification: number): number | undefined;
  getTokenModifierFromClassification(classification: number): number;

  /**
   * Gets inlay hints for the specified file and span.
   *
   * Inlay hints are inline annotations that appear directly in the code,
   * showing type information without requiring hover.
   *
   * @param fileName The file to get inlay hints for
   * @param span The text span to get inlay hints for
   * @returns An array of inlay hints
   */
  getInlayHints(fileName: string, span: ts.TextSpan): InlayHint[];
}

export function isNgLanguageService(
  ls: ts.LanguageService | NgLanguageService,
): ls is NgLanguageService {
  return 'getTcb' in ls;
}
