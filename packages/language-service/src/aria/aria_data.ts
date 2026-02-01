/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * ARIA attribute data - inlined minimal version for Bazel compatibility.
 * Based on WAI-ARIA specification.
 */

export type AriaAttributeType =
  | 'string'
  | 'boolean'
  | 'tristate'
  | 'integer'
  | 'number'
  | 'id'
  | 'idlist'
  | 'token'
  | 'tokenlist';

/**
 * Valid ARIA attributes from WAI-ARIA 1.2
 */
export const VALID_ARIA_ATTRIBUTES = new Set([
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect', // deprecated
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed', // deprecated
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
]);

/**
 * Valid ARIA roles from WAI-ARIA 1.2
 */
export const VALID_ARIA_ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'button',
  'cell',
  'checkbox',
  'columnheader',
  'combobox',
  'command',
  'complementary',
  'composite',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'input',
  'landmark',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'range',
  'region',
  'roletype',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'section',
  'sectionhead',
  'select',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'structure',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
  'widget',
  'window',
  // Digital Publishing WAI-ARIA (doc-*) roles
  'doc-abstract',
  'doc-acknowledgments',
  'doc-afterword',
  'doc-appendix',
  'doc-backlink',
  'doc-biblioentry',
  'doc-bibliography',
  'doc-biblioref',
  'doc-chapter',
  'doc-colophon',
  'doc-conclusion',
  'doc-cover',
  'doc-credit',
  'doc-credits',
  'doc-dedication',
  'doc-endnote',
  'doc-endnotes',
  'doc-epigraph',
  'doc-epilogue',
  'doc-errata',
  'doc-example',
  'doc-footnote',
  'doc-foreword',
  'doc-glossary',
  'doc-glossref',
  'doc-index',
  'doc-introduction',
  'doc-noteref',
  'doc-notice',
  'doc-pagebreak',
  'doc-pagelist',
  'doc-part',
  'doc-preface',
  'doc-prologue',
  'doc-pullquote',
  'doc-qna',
  'doc-subtitle',
  'doc-tip',
  'doc-toc',
]);

/**
 * ARIA attribute value definitions
 */
const ARIA_ATTRIBUTE_VALUES: Record<string, readonly string[]> = {
  'aria-autocomplete': ['inline', 'list', 'both', 'none'],
  'aria-checked': ['true', 'false', 'mixed'],
  'aria-current': ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
  'aria-haspopup': ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
  'aria-invalid': ['true', 'false', 'grammar', 'spelling'],
  'aria-live': ['off', 'polite', 'assertive'],
  'aria-orientation': ['horizontal', 'vertical'],
  'aria-pressed': ['true', 'false', 'mixed'],
  'aria-relevant': ['additions', 'removals', 'text', 'all'],
  'aria-sort': ['ascending', 'descending', 'none', 'other'],
  'aria-hidden': ['true', 'false'],
  'aria-busy': ['true', 'false'],
  'aria-disabled': ['true', 'false'],
  'aria-expanded': ['true', 'false'],
  'aria-grabbed': ['true', 'false'],
  'aria-modal': ['true', 'false'],
  'aria-multiline': ['true', 'false'],
  'aria-multiselectable': ['true', 'false'],
  'aria-readonly': ['true', 'false'],
  'aria-required': ['true', 'false'],
  'aria-selected': ['true', 'false'],
};

export function isValidAriaAttribute(name: string): boolean {
  return VALID_ARIA_ATTRIBUTES.has(name);
}

export function isValidAriaRole(role: string): boolean {
  return VALID_ARIA_ROLES.has(role);
}

export function getAriaAttributeValues(name: string): readonly string[] | undefined {
  return ARIA_ATTRIBUTE_VALUES[name];
}

export function getAriaAttributeDocumentation(name: string): string | undefined {
  // Minimal docs - could be expanded later
  if (name === 'aria-label') return 'Defines a string value that labels the current element.';
  if (name === 'aria-labelledby')
    return 'Identifies the element (or elements) that labels the current element.';
  if (name === 'aria-describedby')
    return 'Identifies the element (or elements) that describes the current element.';
  if (name === 'aria-hidden')
    return 'Indicates that the element and all of its descendants are not visible or perceivable to any user.';
  return `ARIA attribute: ${name}`;
}

/**
 * Find similar ARIA attributes using Levenshtein distance.
 */
export function findSimilarAriaAttributes(input: string, maxDistance: number = 3): string[] {
  const similar: string[] = [];
  for (const attr of VALID_ARIA_ATTRIBUTES) {
    const distance = levenshteinDistance(input, attr);
    if (distance <= maxDistance && distance > 0) {
      similar.push(attr);
    }
  }
  return similar
    .sort((a, b) => {
      const distA = levenshteinDistance(input, a);
      const distB = levenshteinDistance(input, b);
      return distA - distB;
    })
    .slice(0, 3);
}

/**
 * Find similar ARIA roles using Levenshtein distance.
 */
export function findSimilarAriaRoles(input: string, maxDistance: number = 3): string[] {
  const similar: string[] = [];
  for (const role of VALID_ARIA_ROLES) {
    const distance = levenshteinDistance(input, role);
    if (distance <= maxDistance && distance > 0) {
      similar.push(role);
    }
  }
  return similar
    .sort((a, b) => {
      const distA = levenshteinDistance(input, a);
      const distB = levenshteinDistance(input, b);
      return distA - distB;
    })
    .slice(0, 3);
}

/**
 * Validate an ARIA attribute value.
 */
export function validateAriaValue(
  attrName: string,
  value: string,
): {valid: boolean; message?: string} {
  const allowedValues = ARIA_ATTRIBUTE_VALUES[attrName];
  if (!allowedValues) {
    // No specific validation for this attribute
    return {valid: true};
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      message: `Expected one of: ${allowedValues.join(', ')}`,
    };
  }

  return {valid: true};
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export const ARIA_ATTRIBUTES = null; // Placeholder for compatibility
export const ARIA_ROLES = Array.from(VALID_ARIA_ROLES); // Convert to array
export function getAriaAttributeType(name: string): AriaAttributeType | undefined {
  // Simplified - return 'string' for all
  return VALID_ARIA_ATTRIBUTES.has(name) ? 'string' : undefined;
}
