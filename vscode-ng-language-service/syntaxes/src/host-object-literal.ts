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
    'L:meta.decorator.ts -comment -text.html -expression.ng, L:meta.embedded.block.angular-ts meta.decorator.ts -comment -expression.ng',
  patterns: [{include: '#hostObjectLiteral'}],
  repository: {
    hostObjectLiteral: {
      begin: /(host)\s*(:)\s*{/,
      beginCaptures: {
        // Key is shown as JS syntax.
        1: {name: 'meta.object-literal.key.ts'},
        // Colon is shown as JS syntax.
        2: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
      },
      contentName: 'hostbindings.ng',
      end: /}/,
      patterns: [
        // Match style bindings first so property/unit segments can receive
        // dedicated scopes.
        {include: '#ngHostStyleBindingDynamic'},
        // Try to match host bindings inside the `host`.
        {include: '#ngHostBindingDynamic'},
        // Try to match a static binding inside the `host`.
        {include: '#ngHostStyleStaticUnquoted'},
        {include: '#ngHostStyleStatic'},
        {include: '#ngHostBindingStatic'},
        // Include the default TS syntax so that anything that doesn't
        // match the above will get the default highlighting.
        {include: 'source.ts'},
      ],
    },

    // A style-bound property inside host, e.g. `[style.width.px]="expr"`.
    ngHostStyleBindingDynamic: {
      begin:
        /\s*('|")([\[])(style)(?:([.])([-_a-zA-Z0-9$]+))?(?:([.])([-_a-zA-Z0-9$%-]+))?([\]])(\1)(:)/,
      beginCaptures: {
        1: {name: 'string'},
        2: {name: 'punctuation.definition.ng-binding-name.begin.html'},
        3: {name: 'entity.other.ng-binding-name.style.html'},
        4: {name: 'punctuation.accessor.html'},
        5: {name: 'entity.other.ng-binding-name.style.property.html'},
        6: {name: 'punctuation.accessor.html'},
        7: {name: 'entity.other.ng-binding-name.style.unit.html'},
        8: {name: 'punctuation.definition.ng-binding-name.end.html'},
        9: {name: 'string'},
        10: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
      },
      contentName: 'hostbinding.dynamic.ng',
      patterns: [{include: '#ngHostStyleBindingDynamicValue'}],
      end: /(?=,|})/,
    },

    // Value of a style-bound property inside `host`. If the expression is a
    // quoted string literal, embed CSS scopes for the inner value.
    ngHostStyleBindingDynamicValue: {
      begin: /\s*(`|'|")/,
      beginCaptures: {
        1: {name: 'string'},
      },
      patterns: [{include: '#ngHostStyleBindingCssStringValue'}, {include: 'expression.ng'}],
      // @ts-ignore
      end: /\1/,
      endCaptures: {
        0: {name: 'string'},
      },
    },

    // Quoted CSS value inside a host style binding, e.g. `"3px solid black"`.
    ngHostStyleBindingCssStringValue: {
      begin: /\G\s*(`|'|")/,
      beginCaptures: {
        1: {name: 'string'},
      },
      // @ts-ignore
      end: /\1/,
      endCaptures: {
        0: {name: 'string'},
      },
      contentName: 'source.css.scss',
      patterns: [{include: 'source.css.scss'}],
    },

    // A bound property inside `host`, e.g. `[attr.foo]="expr"` or `(click)="handleClick()"`.
    ngHostBindingDynamic: {
      begin: /\s*('|")([\[(].*?[\])])(\1)(:)/,
      beginCaptures: {
        // Opening quote is shown as a string. Only allows single and double quotes, no backticks.
        1: {name: 'string'},
        // Name is shown as an HTML attribute with Angular binding-key decomposition.
        2: {
          name: 'entity.other.attribute-name.html',
          patterns: [{include: '#bindingKey'}],
        },
        // Closing quote is shown as a string.
        3: {name: 'string'},
        // Colon is shown as JS syntax.
        4: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
      },
      contentName: 'hostbinding.dynamic.ng',
      patterns: [{include: '#ngHostBindingDynamicValue'}],
      end: /(?=,|})/,
    },

    bindingKey: {
      patterns: [
        {
          match:
            /([\[\(]{1,2}|\*)(?:\s*)(@?style)(?:([.])([-_a-zA-Z0-9$]+))?(?:([.])([-_a-zA-Z0-9$%-]+))?(?:\s*)([\]\)]{1,2})?/,
          captures: {
            1: {name: 'punctuation.definition.ng-binding-name.begin.html'},
            2: {name: 'entity.other.ng-binding-name.style.html'},
            3: {name: 'punctuation.accessor.html'},
            4: {name: 'entity.other.ng-binding-name.style.property.html'},
            5: {name: 'punctuation.accessor.html'},
            6: {name: 'entity.other.ng-binding-name.style.unit.html'},
            7: {name: 'punctuation.definition.ng-binding-name.end.html'},
          },
        },
        {
          match:
            /([\[\(]{1,2}|\*)(?:\s*)(@?(?:[-_a-zA-Z0-9.$]+|\[[^\[\]]*]|\([^()]*\))*%?)(?:\s*)([\]\)]{1,2})?/,
          captures: {
            1: {name: 'punctuation.definition.ng-binding-name.begin.html'},
            2: {
              name: 'entity.other.ng-binding-name.$2.html',
              patterns: [
                {
                  match: /\./,
                  name: 'punctuation.accessor.html',
                },
              ],
            },
            3: {name: 'punctuation.definition.ng-binding-name.end.html'},
          },
        },
      ],
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

    hostStaticStyleDeclarationList: {
      patterns: [
        {include: '#hostStaticStyleKnownDeclaration'},
        {include: '#hostStaticStyleGenericDeclaration'},
        {match: /;/, name: 'punctuation.terminator.rule.css'},
      ],
    },

    hostStaticStyleKnownDeclaration: {
      begin:
        /\s*((?:width|height|padding|margin|border|color|background|background-color))\s*(:)\s*/,
      beginCaptures: {
        1: {name: 'meta.property-name.css support.type.property-name.css'},
        2: {name: 'punctuation.separator.key-value.css'},
      },
      end: /(?=;|$)/,
      contentName: 'meta.property-value.css',
      patterns: [{include: '#hostStaticStyleValue'}],
    },

    hostStaticStyleGenericDeclaration: {
      begin: /\s*((?:--[-_a-zA-Z0-9]+|[-_a-zA-Z][-a-zA-Z0-9-]*))\s*(:)\s*/,
      beginCaptures: {
        1: {name: 'meta.property-name.css'},
        2: {name: 'punctuation.separator.key-value.css'},
      },
      end: /(?=;|$)/,
      contentName: 'meta.property-value.css',
      patterns: [{include: '#hostStaticStyleValue'}],
    },

    hostStaticStyleValue: {
      patterns: [
        {include: '#hostStaticStyleVarFunction'},
        {match: /--[-_a-zA-Z0-9]+/, name: 'variable.argument.css'},
        {
          match: /[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-zA-Z]+)?/,
          name: 'constant.numeric.css',
        },
      ],
    },

    hostStaticStyleVarFunction: {
      begin: /(?<![\w-])(var)(\()/,
      beginCaptures: {
        1: {name: 'support.function.misc.css'},
        2: {name: 'punctuation.section.function.begin.bracket.round.css'},
      },
      end: /\)/,
      endCaptures: {
        0: {name: 'punctuation.section.function.end.bracket.round.css'},
      },
      name: 'meta.function.variable.css',
      patterns: [{match: /--[-_a-zA-Z0-9]+/, name: 'variable.argument.css'}],
    },

    // Static unquoted `style` host key parsed as inline CSS declarations.
    ngHostStyleStaticUnquoted: {
      begin: /\s*(style)\s*(:)\s*(`|'|")/,
      beginCaptures: {
        1: {name: 'entity.other.attribute-name.html'},
        2: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
        3: {name: 'string'},
      },
      contentName: 'source.css meta.property-list.css meta.embedded.line.css',
      patterns: [{include: '#hostStaticStyleDeclarationList'}],
      // @ts-ignore
      end: /\3/,
      endCaptures: {
        0: {name: 'string'},
      },
    },

    // Static `style`/`'style'` host key parsed as inline CSS declarations.
    ngHostStyleStatic: {
      begin: /\s*('|")?(style)(\1)?\s*(:)\s*(`|'|")/,
      beginCaptures: {
        1: {name: 'string'},
        2: {name: 'entity.other.attribute-name.html'},
        3: {name: 'string'},
        4: {name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'},
        5: {name: 'string'},
      },
      contentName: 'source.css meta.property-list.css meta.embedded.line.css',
      patterns: [{include: '#hostStaticStyleDeclarationList'}],
      // @ts-ignore
      end: /\5/,
      endCaptures: {
        0: {name: 'string'},
      },
    },

    // Static value inside `host`.
    ngHostBindingStatic: {
      // Note that we need to allow both quoted and non-quoted keys.
      begin: /\s*('|")?(.*?)(\1)?\s*:/,
      end: /(?=,|})/,
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
      contentName: 'hostbinding.static.ng',
      patterns: [
        // Use TypeScript highlighting for the value. This allows us to deal
        // with things like escaped strings and variables correctly.
        {include: 'source.ts'},
      ],
    },
  },
};
