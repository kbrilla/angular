/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {GrammarDefinition} from './types';

/** Highlighting definition for the `host` object of a directive or component. */
export const HostObjectLiteral: GrammarDefinition = {
  scopeName: 'host-object-literal.ng',
  injectionSelector:
    'L:meta.decorator.ts -comment -text.html.derivative -expression.ng -source.css.scss',
  patterns: [{include: '#hostObjectLiteral'}],
  repository: {
    hostObjectLiteral: {
      begin: /(?:^\s*|[,{]\s*)(host)\s*(:)\s*{/,
      beginCaptures: {
        // Key is shown as JS syntax.
        1: {name: 'meta.object-literal.key.ts'},
        // Colon is shown as JS syntax.
        2: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
      },
      contentName: 'hostbindings.ng',
      end: /}/,
      patterns: [
        // Try to match host bindings inside the `host`.
        {include: '#ngHostBindingDynamic'},
        // Try to match a static binding inside the `host`.
        {include: '#ngHostBindingStatic'},
      ],
    },

    // A bound property inside `host`, e.g. `[attr.foo]="expr"` or `(click)="handleClick()"`.
    ngHostBindingDynamic: {
      begin: /\s*('|")([\[(].*?[\])])(\1)(:)/,
      beginCaptures: {
        // Opening quote is shown as a string. Only allows single and double quotes, no backticks.
        1: {name: 'string'},
        // Name is shown as an HTML attribute.
        2: {name: 'entity.other.attribute-name.html'},
        // Closing quote is shown as a string.
        3: {name: 'string'},
        // Colon is shown as JS syntax.
        4: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
      },
      contentName: 'hostbinding.dynamic.ng',
      patterns: [{include: '#ngHostBindingDynamicValue'}],
      end: /(?=,|})/,
    },

    // Value of a bound property inside `host`.
    ngHostBindingDynamicValue: {
      begin: /\s*(`|'|")/,
      beginCaptures: {
        // Opening quote is shown as a string. Allows backticks as well.
        1: {name: 'string'},
      },
      patterns: [
        // Content is shown as an Angular expression.
        {include: 'expression.ng'},
      ],
      // Ends on the same kind of quote as the opening.
      // @ts-ignore
      end: /\1/,
      endCaptures: {
        // Closing quote is shown as a string.
        0: {name: 'string'},
      },
    },

    // Static value inside `host` — only matches quoted keys or unquoted simple
    // identifiers. Excludes unquoted keys followed by `[` or `` ` `` which would
    // be template/styles/host members at the decorator level, not host bindings.
    ngHostBindingStatic: {
      // Note that we need to allow both quoted and non-quoted keys.
      // Only match if the key is a quoted string OR a simple identifier (no
      // complex expressions). This prevents matching decorator-level keys like
      // `template:` and `styles:` when the host object hasn't closed properly.
      begin: /\s*((?:'[^']*'|"[^"]*")|(?:\w+))\s*(?=:)/,
      end: /(?=,|})/,
      beginCaptures: {
        // Name is shown as an HTML attribute.
        1: {name: 'entity.other.attribute-name.html'},
      },
      contentName: 'hostbinding.static.ng',
      patterns: [
        // Match colon separator
        {match: /:\s*/, name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
        // Match string values (single or double quoted)
        {match: /'[^']*'|"[^"]*"/, name: 'string'},
      ],
    },
  },
};
