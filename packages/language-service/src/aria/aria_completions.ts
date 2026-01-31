/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';
import {NgCompiler} from '@angular/compiler-cli/src/ngtsc/core';
import * as t from '@angular/compiler';
import {tmplAstVisitAll, TmplAstRecursiveVisitor} from '@angular/compiler';
import {
  isValidAriaAttribute,
  isValidAriaRole,
  getAriaAttributeValues,
  getAriaAttributeDocumentation,
  VALID_ARIA_ATTRIBUTES,
  VALID_ARIA_ROLES,
  ARIA_ATTRIBUTES,
  ARIA_ROLES,
} from './aria_data';

/**
 * Gets ARIA completions for a position in a template.
 *
 * @param fileName The template file name.
 * @param position The position in the template.
 * @param compiler The Angular compiler instance.
 * @returns Array of completion entries.
 */
export function getAriaCompletions(
  fileName: string,
  position: number,
  compiler: NgCompiler,
): ts.CompletionEntry[] {
  const completions: ts.CompletionEntry[] = [];
  const ttc = compiler.getTemplateTypeChecker();

  // Find the component containing this template position
  const components = compiler.getComponentsWithTemplateFile(fileName);

  for (const component of components) {
    try {
      if (!ts.isClassDeclaration(component)) {
        continue;
      }
      const template = ttc.getTemplate(component);
      if (!template) {
        continue;
      }

      // Find the node at the position
      const visitor = new AriaCompletionVisitor(position, completions);
      tmplAstVisitAll(visitor, template);
    } catch {
      // Skip components with compilation errors
    }
  }

  return completions;
}

/**
 * Visitor that walks the template AST and provides ARIA completions.
 */
class AriaCompletionVisitor extends TmplAstRecursiveVisitor {
  constructor(
    private readonly position: number,
    private readonly completions: ts.CompletionEntry[],
  ) {
    super();
  }

  /**
   * Visit an element node and check if we're inside an attribute.
   */
  override visitElement(element: t.TmplAstElement): void {
    // Check if position is in the start tag
    const startTagEnd = element.startSourceSpan?.end.offset ?? element.sourceSpan.start.offset;
    if (this.position >= element.sourceSpan.start.offset && this.position <= startTagEnd) {
      // We're in the start tag - provide attribute completions
      this.addAriaAttributeCompletions(element);
      this.addRoleCompletions(element);
    }

    // Check static attributes for value completions
    for (const attr of element.attributes) {
      if (this.isInAttributeValue(attr, this.position)) {
        if (attr.name.startsWith('aria-')) {
          this.addAriaValueCompletions(attr.name, attr.value);
        } else if (attr.name === 'role') {
          this.addRoleValueCompletions();
        }
      }
    }

    // Visit children
    super.visitElement(element);
  }

  /**
   * Visit a template node and check for ARIA attribute opportunities.
   */
  override visitTemplate(template: t.TmplAstTemplate): void {
    // Check if position is in the start tag
    const startTagEnd = template.startSourceSpan?.end.offset ?? template.sourceSpan.start.offset;
    if (this.position >= template.sourceSpan.start.offset && this.position <= startTagEnd) {
      // We're in the ng-template tag - provide attribute completions
      this.addAriaAttributeCompletionsForTemplate();
    }

    // Check static attributes for value completions
    for (const attr of template.attributes) {
      if (this.isInAttributeValue(attr, this.position)) {
        if (attr.name.startsWith('aria-')) {
          this.addAriaValueCompletions(attr.name, attr.value);
        } else if (attr.name === 'role') {
          this.addRoleValueCompletions();
        }
      }
    }

    // Visit children
    super.visitTemplate(template);
  }

  /**
   * Check if position is inside an attribute value.
   */
  private isInAttributeValue(attr: t.TmplAstTextAttribute, position: number): boolean {
    const valueSpan = attr.valueSpan;
    if (!valueSpan) {
      return false;
    }
    return position >= valueSpan.start.offset && position <= valueSpan.end.offset;
  }

  /**
   * Add ARIA attribute completions for an element.
   */
  private addAriaAttributeCompletions(element: t.TmplAstElement): void {
    // Get existing aria attributes to filter them out
    const existingAriaAttrs = new Set<string>();
    for (const attr of element.attributes) {
      if (attr.name.startsWith('aria-')) {
        existingAriaAttrs.add(attr.name);
      }
    }
    for (const input of element.inputs) {
      if (input.name.startsWith('aria-')) {
        existingAriaAttrs.add(input.name);
      }
    }

    // Add completions for all valid ARIA attributes not already present
    for (const ariaAttr of VALID_ARIA_ATTRIBUTES) {
      if (!existingAriaAttrs.has(ariaAttr)) {
        this.completions.push({
          name: ariaAttr,
          kind: ts.ScriptElementKind.memberVariableElement,
          kindModifiers: 'aria',
          sortText: `0_${ariaAttr}`, // Sort ARIA attributes higher
          insertText: `${ariaAttr}=""`,
          replacementSpan: undefined,
        });
      }
    }
  }

  /**
   * Add role attribute completion.
   */
  private addRoleCompletions(element: t.TmplAstElement): void {
    // Check if role already exists
    const hasRole =
      element.attributes.some((attr) => attr.name === 'role') ||
      element.inputs.some((input) => input.name === 'role');

    if (!hasRole) {
      this.completions.push({
        name: 'role',
        kind: ts.ScriptElementKind.memberVariableElement,
        kindModifiers: 'aria',
        sortText: '0_role',
        insertText: 'role=""',
        replacementSpan: undefined,
      });
    }
  }

  /**
   * Add ARIA attribute completions for a template node.
   */
  private addAriaAttributeCompletionsForTemplate(): void {
    // ng-template can have ARIA attributes too
    for (const ariaAttr of VALID_ARIA_ATTRIBUTES) {
      this.completions.push({
        name: ariaAttr,
        kind: ts.ScriptElementKind.memberVariableElement,
        kindModifiers: 'aria',
        sortText: `0_${ariaAttr}`,
        insertText: `${ariaAttr}=""`,
        replacementSpan: undefined,
      });
    }
  }

  /**
   * Add value completions for an ARIA attribute.
   */
  private addAriaValueCompletions(attrName: string, currentValue: string): void {
    const suggestions = getAriaAttributeValues(attrName);
    if (!suggestions || suggestions.length === 0) {
      return;
    }

    for (const suggestion of suggestions) {
      this.completions.push({
        name: suggestion,
        kind: ts.ScriptElementKind.string,
        kindModifiers: '',
        sortText: `1_${suggestion}`,
        insertText: suggestion,
        replacementSpan: undefined,
      });
    }
  }

  /**
   * Add value completions for the role attribute.
   */
  private addRoleValueCompletions(): void {
    for (const role of ARIA_ROLES) {
      this.completions.push({
        name: role,
        kind: ts.ScriptElementKind.string,
        kindModifiers: '',
        sortText: `1_${role}`,
        insertText: role,
        replacementSpan: undefined,
      });
    }
  }
}

/**
 * Gets quick info (hover) for an ARIA attribute or role.
 *
 * @param fileName The template file name.
 * @param position The position in the template.
 * @param compiler The Angular compiler instance.
 * @returns Quick info or undefined.
 */
export function getAriaQuickInfo(
  fileName: string,
  position: number,
  compiler: NgCompiler,
): ts.QuickInfo | undefined {
  const ttc = compiler.getTemplateTypeChecker();
  const components = compiler.getComponentsWithTemplateFile(fileName);

  for (const component of components) {
    try {
      if (!ts.isClassDeclaration(component)) {
        continue;
      }
      const template = ttc.getTemplate(component);
      if (!template) {
        continue;
      }

      // Find the node at the position
      const visitor = new AriaQuickInfoVisitor(position);
      tmplAstVisitAll(visitor, template);

      if (visitor.quickInfo) {
        return visitor.quickInfo;
      }
    } catch {
      // Skip components with compilation errors
    }
  }

  return undefined;
}

/**
 * Visitor that provides quick info for ARIA attributes and roles.
 */
class AriaQuickInfoVisitor extends TmplAstRecursiveVisitor {
  quickInfo: ts.QuickInfo | undefined;

  constructor(private readonly position: number) {
    super();
  }

  /**
   * Visit an element and check ARIA attributes.
   */
  override visitElement(element: t.TmplAstElement): void {
    // Check static attributes
    for (const attr of element.attributes) {
      if (this.isInAttributeName(attr, this.position)) {
        if (attr.name.startsWith('aria-')) {
          this.quickInfo = this.createAriaAttributeQuickInfo(attr.name, attr.sourceSpan);
          return;
        } else if (attr.name === 'role') {
          this.quickInfo = this.createRoleQuickInfo(attr.sourceSpan);
          return;
        }
      } else if (this.isInAttributeValue(attr, this.position)) {
        if (attr.name === 'role') {
          // Try to get quick info for the specific role value
          const roleValue = this.extractRoleAtPosition(attr.value, this.position, attr.valueSpan!);
          if (roleValue) {
            this.quickInfo = this.createRoleValueQuickInfo(roleValue, attr.valueSpan!);
            return;
          }
        }
      }
    }

    // Check bound attributes
    for (const input of element.inputs) {
      if (input.keySpan && this.isInSpan(input.keySpan, this.position)) {
        if (input.name.startsWith('aria-')) {
          this.quickInfo = this.createAriaAttributeQuickInfo(input.name, input.sourceSpan);
          return;
        }
      }
    }

    // Visit children
    super.visitElement(element);
  }

  /**
   * Visit a template node and check ARIA attributes.
   */
  override visitTemplate(template: t.TmplAstTemplate): void {
    // Check static attributes
    for (const attr of template.attributes) {
      if (this.isInAttributeName(attr, this.position)) {
        if (attr.name.startsWith('aria-')) {
          this.quickInfo = this.createAriaAttributeQuickInfo(attr.name, attr.sourceSpan);
          return;
        } else if (attr.name === 'role') {
          this.quickInfo = this.createRoleQuickInfo(attr.sourceSpan);
          return;
        }
      }
    }

    // Visit children
    super.visitTemplate(template);
  }

  /**
   * Check if position is in an attribute name.
   */
  private isInAttributeName(attr: t.TmplAstTextAttribute, position: number): boolean {
    // Attribute name span is from start to the '=' or to the end if no value
    const nameEnd = attr.valueSpan ? attr.valueSpan.start.offset - 2 : attr.sourceSpan.end.offset;
    return position >= attr.sourceSpan.start.offset && position <= nameEnd;
  }

  /**
   * Check if position is in an attribute value.
   */
  private isInAttributeValue(attr: t.TmplAstTextAttribute, position: number): boolean {
    const valueSpan = attr.valueSpan;
    if (!valueSpan) {
      return false;
    }
    return position >= valueSpan.start.offset && position <= valueSpan.end.offset;
  }

  /**
   * Check if position is within a span.
   */
  private isInSpan(span: t.ParseSourceSpan, position: number): boolean {
    return position >= span.start.offset && position <= span.end.offset;
  }

  /**
   * Extract the role value at a specific position (for space-separated roles).
   */
  private extractRoleAtPosition(
    fullValue: string,
    position: number,
    valueSpan: t.ParseSourceSpan,
  ): string | null {
    const roles = fullValue.split(/\s+/);
    let currentOffset = valueSpan.start.offset;

    for (const role of roles) {
      const roleStart = currentOffset;
      const roleEnd = roleStart + role.length;

      if (position >= roleStart && position <= roleEnd) {
        return role;
      }

      // Move past this role and any whitespace
      currentOffset = roleEnd + 1;
    }

    return null;
  }

  /**
   * Create quick info for an ARIA attribute.
   */
  private createAriaAttributeQuickInfo(attrName: string, span: t.ParseSourceSpan): ts.QuickInfo {
    const description = getAriaAttributeDocumentation(attrName);
    const text = description || `ARIA attribute: ${attrName}`;

    return {
      kind: ts.ScriptElementKind.memberVariableElement,
      kindModifiers: 'aria',
      textSpan: {
        start: span.start.offset,
        length: span.end.offset - span.start.offset,
      },
      displayParts: [
        {text: '(aria attribute) ', kind: 'text'},
        {text: attrName, kind: 'parameterName'},
      ],
      documentation: [{text, kind: 'text'}],
    };
  }

  /**
   * Create quick info for the role attribute.
   */
  private createRoleQuickInfo(span: t.ParseSourceSpan): ts.QuickInfo {
    return {
      kind: ts.ScriptElementKind.memberVariableElement,
      kindModifiers: 'aria',
      textSpan: {
        start: span.start.offset,
        length: span.end.offset - span.start.offset,
      },
      displayParts: [
        {text: '(aria attribute) ', kind: 'text'},
        {text: 'role', kind: 'parameterName'},
      ],
      documentation: [
        {
          text: 'Defines the role of an element in the accessibility tree.',
          kind: 'text',
        },
      ],
    };
  }

  /**
   * Create quick info for a specific role value.
   */
  private createRoleValueQuickInfo(roleValue: string, span: t.ParseSourceSpan): ts.QuickInfo {
    const text = `ARIA role: ${roleValue}`;

    return {
      kind: ts.ScriptElementKind.string,
      kindModifiers: '',
      textSpan: {
        start: span.start.offset,
        length: span.end.offset - span.start.offset,
      },
      displayParts: [
        {text: '(aria role) ', kind: 'text'},
        {text: roleValue, kind: 'string'},
      ],
      documentation: [{text, kind: 'text'}],
    };
  }
}
