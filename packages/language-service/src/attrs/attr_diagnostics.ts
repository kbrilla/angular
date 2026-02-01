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

type AttributeBindingType =
  | 'static'
  | 'attrBinding'
  | 'hostStatic'
  | 'hostAttrBinding'
  | 'directiveHostStatic'
  | 'directiveHostAttrBinding';

interface AttributeBindingInfo {
  name: string;
  bindingType: AttributeBindingType;
  node: TmplAstTextAttribute | TmplAstBoundAttribute;
  sourceSpan: {start: number; end: number};
  directiveName?: string;
  elementSpan?: {start: number; end: number};
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
    const attributeBindings = new Map<string, AttributeBindingInfo[]>();

    // Collect static attributes
    for (const attr of element.attributes) {
      const normalized = attr.name.toLowerCase();
      if (!attributeBindings.has(normalized)) {
        attributeBindings.set(normalized, []);
      }
      // @ts-ignore DEBUG
      console.log(
        `[ATTR_DIAG] Static attr '${attr.name}' at offset ${attr.sourceSpan.start.offset}-${attr.sourceSpan.end.offset}`,
      );
      attributeBindings.get(normalized)!.push({
        name: attr.name,
        bindingType: 'static',
        node: attr,
        sourceSpan: {
          start: attr.sourceSpan.start.offset,
          end: attr.sourceSpan.end.offset,
        },
      });
    }

    // Collect attribute bindings ([attr.x])
    for (const input of element.inputs) {
      if (input.type === BindingType.Attribute) {
        const normalized = input.name.toLowerCase();
        if (!attributeBindings.has(normalized)) {
          attributeBindings.set(normalized, []);
        }
        // @ts-ignore DEBUG
        console.log(
          `[ATTR_DIAG] Attr binding '[attr.${input.name}]' at offset ${input.sourceSpan.start.offset}-${input.sourceSpan.end.offset}, keySpan: ${input.keySpan?.start.offset}-${input.keySpan?.end.offset}`,
        );
        attributeBindings.get(normalized)!.push({
          name: input.name,
          bindingType: 'attrBinding',
          node: input,
          sourceSpan: {
            start: input.keySpan ? input.keySpan.start.offset : input.sourceSpan.start.offset,
            end: input.keySpan ? input.keySpan.end.offset : input.sourceSpan.end.offset,
          },
        });
      }
    }

    // Collect directive host attribute bindings that apply to this element
    // Only for TmplAstElement (not ng-template)
    if ('name' in element) {
      const directives = this.templateTypeChecker.getDirectivesOfNode(this.component, element);
      if (directives) {
        for (const directive of directives) {
          // Skip the component itself - we're looking for  attribute directives
          if (directive.isComponent) continue;

          // Get the class declaration from the directive reference
          const dirNode = directive.ref.node;
          if (!ts.isClassDeclaration(dirNode)) continue;

          // Get the host element for this directive
          const hostElement = this.templateTypeChecker.getHostElement(dirNode);
          if (!hostElement) continue;

          // Get the directive name for error messages
          const directiveName = dirNode.name?.text ?? 'unknown';

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

          // Collect attribute bindings from host
          for (const binding of hostElement.bindings) {
            if (binding.type === BindingType.Attribute) {
              const normalized = binding.name.toLowerCase();
              // @ts-ignore DEBUG
              console.log(
                `[ATTR_DIAG]     -> Directive '${directiveName}' host attr binding '[attr.${binding.name}]'`,
              );
              const attrBinding: AttributeBindingInfo = {
                name: binding.name,
                bindingType: 'directiveHostAttrBinding',
                node: binding,
                sourceSpan: {
                  start: binding.keySpan
                    ? binding.keySpan.start.offset
                    : binding.sourceSpan.start.offset,
                  end: binding.keySpan ? binding.keySpan.end.offset : binding.sourceSpan.end.offset,
                },
                directiveName,
                elementSpan: directiveAttrSpan,
              };
              const existing = attributeBindings.get(normalized) || [];
              existing.push(attrBinding);
              attributeBindings.set(normalized, existing);
            }
          }
        }
      }
    }

    // Check for conflicts
    for (const [attrName, bindings] of attributeBindings.entries()) {
      if (bindings.length <= 1) continue;

      // @ts-ignore DEBUG
      console.log(`[ATTR_DIAG] Checking ${bindings.length} bindings for '${attrName}'`);

      // Group bindings by type
      const templateBindings = bindings.filter(
        (b) => b.bindingType === 'static' || b.bindingType === 'attrBinding',
      );
      const hostBindings = bindings.filter(
        (b) =>
          b.bindingType === 'directiveHostStatic' || b.bindingType === 'directiveHostAttrBinding',
      );

      // Check for conflicts between template and directive host bindings
      if (templateBindings.length > 0 && hostBindings.length > 0) {
        // Conflict between template binding and directive host binding
        // Report on ALL bindings (both template and host)
        for (const binding of bindings) {
          let message: string;
          if (binding.directiveName) {
            // This is a host binding - explain that it conflicts with template
            message = `Attribute '${attrName}' is set both in the template and in directive '${binding.directiveName}' host bindings. The template binding will override the directive host binding.`;
          } else {
            // This is a template binding - explain that it overrides directive
            const directiveNames = hostBindings
              .map((b) => b.directiveName)
              .filter((n): n is string => !!n)
              .join(', ');
            message = `Attribute '${attrName}' is set both in the template and in directive host bindings (${directiveNames}). The template binding will override the directive host binding.`;
          }

          // For directive host bindings, report on the directive selector attribute if found
          const diagnosticSpan =
            binding.bindingType.startsWith('directiveHost') && binding.elementSpan
              ? binding.elementSpan
              : binding.sourceSpan;

          this.diagnostics.push({
            category: this.severity,
            code: AttrDiagnosticCode.CONFLICTING_ATTRIBUTE_BINDING,
            file: this.diagnosticSourceFile,
            start: diagnosticSpan.start,
            length: diagnosticSpan.end - diagnosticSpan.start,
            messageText: message,
            source: 'angular',
          });
        }
        continue;
      }

      // Check for conflicts within template bindings only
      const hasStatic = templateBindings.some((b) => b.bindingType === 'static');
      const hasAttrBinding = templateBindings.some((b) => b.bindingType === 'attrBinding');
      const hasMultipleAttrBindings =
        templateBindings.filter((b) => b.bindingType === 'attrBinding').length > 1;

      if (hasStatic && hasAttrBinding) {
        // Conflict between [attr.x] and x=""
        for (const binding of templateBindings) {
          this.addConflictWarning(
            binding,
            `Attribute '${attrName}' is set both as a static attribute and an attribute binding. The attribute binding will override the static attribute.`,
          );
        }
      } else if (hasMultipleAttrBindings) {
        // Multiple [attr.x] bindings
        for (const binding of templateBindings.filter((b) => b.bindingType === 'attrBinding')) {
          this.addDuplicateWarning(
            binding,
            `Attribute '${attrName}' has multiple attribute bindings. Only the last one will be applied.`,
          );
        }
      }
    }
  }

  private addConflictWarning(binding: AttributeBindingInfo, message: string) {
    this.diagnostics.push({
      category: this.severity,
      code: AttrDiagnosticCode.CONFLICTING_ATTRIBUTE_BINDING,
      file: this.diagnosticSourceFile,
      start: binding.sourceSpan.start,
      length: binding.sourceSpan.end - binding.sourceSpan.start,
      messageText: message,
      source: 'angular',
    });
  }

  private addDuplicateWarning(binding: AttributeBindingInfo, message: string) {
    this.diagnostics.push({
      category: this.severity,
      code: AttrDiagnosticCode.DUPLICATE_ATTRIBUTE_BINDING,
      file: this.diagnosticSourceFile,
      start: binding.sourceSpan.start,
      length: binding.sourceSpan.end - binding.sourceSpan.start,
      messageText: message,
      source: 'angular',
    });
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
