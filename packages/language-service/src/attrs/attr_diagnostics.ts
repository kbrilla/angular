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
  TmplAstElement,
  TmplAstHostElement,
  TmplAstNode,
  TmplAstTextAttribute,
  TmplAstVisitor,
  tmplAstVisitAll,
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
  TmplAstTemplate,
} from '@angular/compiler';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import {isExternalResource} from '@angular/compiler-cli/src/ngtsc/metadata';
import {TemplateTypeChecker} from '@angular/compiler-cli/src/ngtsc/typecheck/api';
import ts from 'typescript';

import {
  BaseBinding,
  BaseBindingType,
  createConflictDiagnostic,
  detectConflicts,
  groupBindingsByName,
} from '../binding_conflict_utils';

/**
 * Attribute diagnostic codes for the Angular Language Service.
 */
export const enum AttrDiagnosticCode {
  /** Conflicting attribute bindings (e.g., [attr.disabled] and disabled). */
  CONFLICTING_ATTRIBUTE_BINDING = 99100,
  /** Duplicate attribute binding */
  DUPLICATE_ATTRIBUTE_BINDING = 99101,
}

export interface AttrDiagnostic extends ts.Diagnostic {
  code: AttrDiagnosticCode;
}

/**
 * Attribute binding information that extends the base binding interface.
 */
interface AttributeBinding extends BaseBinding {
  /** Whether this is a static attribute (e.g., disabled="") or bound (e.g., [attr.disabled]) */
  isStatic: boolean;
  /** The original node (either static attribute or bound attribute) */
  originalNode: TmplAstTextAttribute | TmplAstBoundAttribute;
  /** For directive/component host bindings, the source file containing the host definition */
  hostSourceFile?: ts.SourceFile;
}

/**
 * Computes attribute binding diagnostics for a template.
 *
 * Detects conflicts such as:
 * - [attr.disabled]="false" disabled="" (attribute binding + static attribute)
 * - Multiple [attr.disabled] bindings on the same element
 */
export function computeAttrDiagnostics(
  compiler: NgCompiler,
  diagnosticSourceFile: ts.SourceFile,
  component: ts.ClassDeclaration,
  templateNodes: TmplAstNode[],
  severity: ts.DiagnosticCategory,
): AttrDiagnostic[] {
  // @ts-ignore DEBUG
  console.log(
    `[ATTR_DIAG] computeAttrDiagnostics called for component in ${diagnosticSourceFile.fileName}`,
  );
  const diagnostics: AttrDiagnostic[] = [];
  const visitor = new AttrDiagnosticVisitor(
    component,
    diagnostics,
    severity,
    diagnosticSourceFile,
    compiler.getTemplateTypeChecker(),
  );
  tmplAstVisitAll(visitor, templateNodes);
  // @ts-ignore DEBUG
  console.log(`[ATTR_DIAG] TOTAL diagnostics: ${diagnostics.length}`);
  return diagnostics;
}

class AttrDiagnosticVisitor implements TmplAstVisitor {
  constructor(
    private component: ts.ClassDeclaration,
    private diagnostics: AttrDiagnostic[],
    private severity: ts.DiagnosticCategory,
    private diagnosticSourceFile: ts.SourceFile,
    private templateTypeChecker: TemplateTypeChecker,
  ) {}

  visitElement(element: TmplAstElement): void {
    // @ts-ignore DEBUG
    console.log(
      `[ATTR_DIAG] visitElement: <${element.name}> with ${element.inputs.length} inputs and ${element.attributes.length} attributes`,
    );
    this.detectAttributeConflicts(element);
    tmplAstVisitAll(this, element.children);
  }

  visitTemplate(template: TmplAstTemplate): void {
    // @ts-ignore DEBUG
    console.log(
      `[ATTR_DIAG] visitTemplate with ${template.inputs.length} inputs and ${template.attributes.length} attributes`,
    );
    this.detectAttributeConflicts(template);
    tmplAstVisitAll(this, template.children);
  }

  private detectAttributeConflicts(element: TmplAstElement | TmplAstTemplate) {
    const allBindings: AttributeBinding[] = [];

    // Helper to create a TmplAstBoundAttribute for the BaseBinding interface
    const createBoundAttrForStatic = (attr: TmplAstTextAttribute): TmplAstBoundAttribute => {
      // For static attributes, we need to create a minimal BoundAttribute
      // to satisfy the BaseBinding interface
      return {
        name: attr.name,
        type: BindingType.Attribute,
        securityContext: null as any,
        value: null as any,
        unit: null,
        sourceSpan: attr.sourceSpan,
        keySpan: attr.keySpan || attr.sourceSpan,
        valueSpan: attr.valueSpan || null,
        i18n: attr.i18n,
      } as any as TmplAstBoundAttribute;
    };

    // Helper to collect host bindings from a directive/component class
    const collectHostBindings = (
      dirNode: ts.ClassDeclaration,
      bindingType: 'hostIndividual' | 'hostDirectiveIndividual' | 'directiveHostIndividual',
      directiveName: string | undefined,
      directiveAttrSpan: {start: number; end: number} | undefined,
    ) => {
      const hostElement = this.templateTypeChecker.getHostElement(dirNode);
      if (!hostElement) return;

      const hostSourceFile = dirNode.getSourceFile();

      // Collect attribute bindings from host
      for (const binding of hostElement.bindings) {
        if (binding.type === BindingType.Attribute) {
          allBindings.push({
            bindingType,
            originalName: binding.name,
            normalizedName: binding.name.toLowerCase(),
            attribute: binding,
            directiveName,
            elementSpan: directiveAttrSpan,
            isStatic: false,
            originalNode: binding,
            hostSourceFile: hostSourceFile,
          });

          // @ts-ignore DEBUG
          console.log(
            `[ATTR_DIAG]     -> ${bindingType} '${directiveName || 'component'}' host attr binding '[attr.${binding.name}]'`,
          );
        }
      }

      // Recursively collect host directive bindings
      // Host directives apply to the component's host element
      const directives = this.templateTypeChecker.getDirectivesOfNode(this.component, element);
      if (directives) {
        for (const directive of directives) {
          if (directive.ref.node === dirNode && directive.isComponent) {
            // Get host directives from this component
            // @ts-ignore - hostDirectives is available on directive metadata
            const hostDirectives = directive.hostDirectives;
            if (hostDirectives && Array.isArray(hostDirectives)) {
              for (const hostDirective of hostDirectives) {
                // Check if directive is a Reference with a node property
                let hostDirNode: ts.ClassDeclaration | undefined;
                // @ts-ignore - accessing node from Reference
                if (
                  hostDirective.directive &&
                  typeof hostDirective.directive === 'object' &&
                  'node' in hostDirective.directive
                ) {
                  // @ts-ignore
                  hostDirNode = hostDirective.directive.node;
                }

                if (hostDirNode && ts.isClassDeclaration(hostDirNode)) {
                  const hostDirName = hostDirNode.name?.text ?? 'unknown';
                  // Recursively collect from the host directive
                  collectHostBindings(
                    hostDirNode,
                    'hostDirectiveIndividual',
                    hostDirName,
                    undefined,
                  );
                }
              }
            }
          }
        }
      }
    };

    // Collect static attributes (disabled="", title="foo")
    for (const attr of element.attributes) {
      allBindings.push({
        bindingType: 'individual', // Static attributes are treated like individual bindings
        originalName: attr.name,
        normalizedName: attr.name.toLowerCase(),
        attribute: createBoundAttrForStatic(attr),
        isStatic: true,
        originalNode: attr,
      });

      // @ts-ignore DEBUG
      console.log(
        `[ATTR_DIAG] Static attr '${attr.name}' at offset ${attr.sourceSpan.start.offset}-${attr.sourceSpan.end.offset}`,
      );
    }

    // Collect attribute bindings ([attr.disabled]="value")
    for (const input of element.inputs) {
      if (input.type === BindingType.Attribute) {
        allBindings.push({
          bindingType: 'individual', // [attr.x] bindings are individual
          originalName: input.name,
          normalizedName: input.name.toLowerCase(),
          attribute: input,
          isStatic: false,
          originalNode: input,
        });

        // @ts-ignore DEBUG
        console.log(
          `[ATTR_DIAG] Attr binding '[attr.${input.name}]' at offset ${input.sourceSpan.start.offset}-${input.sourceSpan.end.offset}`,
        );
      }
    }

    // Collect directive/component host attribute bindings that apply to this element
    // Only for TmplAstElement (not ng-template)
    if ('name' in element) {
      const directives = this.templateTypeChecker.getDirectivesOfNode(this.component, element);
      if (directives) {
        for (const directive of directives) {
          // Process component host bindings separately
          const isComponentItself = directive.isComponent && directive.ref.node === this.component;

          // Get the class declaration from the directive reference
          const dirNode = directive.ref.node;
          if (!ts.isClassDeclaration(dirNode)) continue;

          // Get the directive/component name for error messages
          const directiveName = dirNode.name?.text ?? 'unknown';

          // Find the directive's selector attribute on the element for precise span
          let directiveAttrSpan: {start: number; end: number} | undefined;
          if (!isComponentItself && directive.selector) {
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

          // Collect host bindings (this also recursively collects host directive bindings)
          collectHostBindings(
            dirNode,
            isComponentItself ? 'hostIndividual' : 'directiveHostIndividual',
            isComponentItself ? undefined : directiveName,
            directiveAttrSpan,
          );
        }
      }
    }

    // Group bindings by normalized name
    const grouped = groupBindingsByName(allBindings);

    // Detect conflicts using the shared utility
    const conflictDiagnostics = detectConflicts(grouped, {
      diagnosticCode: AttrDiagnosticCode.CONFLICTING_ATTRIBUTE_BINDING,
      severity: this.severity,
      diagnosticSourceFile: this.diagnosticSourceFile,
      bindingPrefix: 'attribute',
      formatValueSnippet: (binding: AttributeBinding, sourceFile: ts.SourceFile) => {
        if (binding.isStatic && 'value' in binding.originalNode) {
          // For static attributes, show the value
          return binding.originalNode.value ? ` = "${binding.originalNode.value}"` : ` = ""`;
        } else if (binding.attribute.valueSpan) {
          // For directive/component host bindings, use their source file
          // For template bindings, use the template source file
          const readFrom = binding.hostSourceFile || sourceFile;
          const text = readFrom.getFullText();
          const start = binding.attribute.valueSpan.start.offset;
          const end = binding.attribute.valueSpan.end.offset;
          const raw = text.slice(start, end).trim();
          return raw ? ` — value: ${raw}` : '';
        }
        return '';
      },
      getBindingSpan: (binding: AttributeBinding, fallbackBinding?: AttributeBinding) => {
        // For directive host bindings, prefer the element span (where directive is applied)
        if (
          (binding.bindingType === 'directiveHostIndividual' ||
            binding.bindingType === 'hostDirectiveIndividual') &&
          binding.elementSpan
        ) {
          return binding.elementSpan;
        }
        // Fallback to the attribute key span
        return {
          start: binding.attribute.keySpan.start.offset,
          end: binding.attribute.keySpan.end.offset,
        };
      },
    });

    this.diagnostics.push(...conflictDiagnostics);
  }

  visitIfBlock(block: TmplAstIfBlock): void {
    tmplAstVisitAll(this, block.branches);
  }

  visitIfBlockBranch(branch: TmplAstIfBlockBranch): void {
    tmplAstVisitAll(this, branch.children);
  }

  visitForLoopBlock(block: TmplAstForLoopBlock): void {
    tmplAstVisitAll(this, block.children);
    if (block.empty) {
      tmplAstVisitAll(this, [block.empty]);
    }
  }

  visitForLoopBlockEmpty(block: TmplAstForLoopBlockEmpty): void {
    tmplAstVisitAll(this, block.children);
  }

  visitSwitchBlock(block: TmplAstSwitchBlock): void {
    // Visit all case groups
    for (const group of block.groups) {
      this.visitSwitchBlockCaseGroup(group);
    }
  }

  visitSwitchBlockCase(_block: TmplAstSwitchBlockCase): void {
    // Cases are visited through the case groups
  }

  visitSwitchBlockCaseGroup(block: TmplAstSwitchBlockCaseGroup): void {
    tmplAstVisitAll(this, block.children);
  }

  visitDeferredBlock(block: TmplAstDeferredBlock): void {
    tmplAstVisitAll(this, block.children);
    if (block.placeholder) {
      tmplAstVisitAll(this, [block.placeholder]);
    }
    if (block.loading) {
      tmplAstVisitAll(this, [block.loading]);
    }
    if (block.error) {
      tmplAstVisitAll(this, [block.error]);
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

  // Remaining visitor methods (no-ops for attribute diagnostics)
  visitContent(): void {}
  visitVariable(): void {}
  visitReference(): void {}
  visitTextAttribute(): void {}
  visitBoundAttribute(): void {}
  visitBoundEvent(): void {}
  visitText(): void {}
  visitBoundText(): void {}
  visitIcu(): void {}
  visitDeferredTrigger(): void {}
  visitComponent(): void {}
  visitDirective(): void {}
  visitUnknownBlock(): void {}
  visitLetDeclaration(): void {}
}
