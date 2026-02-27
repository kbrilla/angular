/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {GrammarDefinition} from './types';

export const Template: GrammarDefinition = {
  scopeName: 'template.ng',
  // Require text.html.derivative as ancestor so this injection only fires inside
  // Angular template content (inline templates, angular-html/angular-ts fences) but
  // NOT on regular markdown prose (which never has text.html.derivative in scope).
  injectionSelector:
    'L:text.html.derivative text.html -comment -control.block.ng -meta.definition.variable.ng',
  patterns: [{include: '#interpolation'}],
  repository: {
    interpolation: {
      begin: /{{/,
      beginCaptures: {
        0: {name: 'punctuation.definition.block.ts'},
      },
      end: /}}/,
      endCaptures: {
        0: {name: 'punctuation.definition.block.ts'},
      },
      contentName: 'expression.ng',
      patterns: [{include: 'expression.ng'}],
    },
  },
};
