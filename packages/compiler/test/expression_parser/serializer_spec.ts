/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as expr from '../../src/expression_parser/ast';
import {Lexer} from '../../src/expression_parser/lexer';
import {Parser} from '../../src/expression_parser/parser';
import {serialize} from '../../src/expression_parser/serializer';
import {getFakeSpan} from './utils/span';

const parser = new Parser(new Lexer());

function parse(expression: string): expr.ASTWithSource {
  return parser.parseBinding(expression, getFakeSpan(), /* absoluteOffset */ 0);
}

function parseAction(expression: string): expr.ASTWithSource {
  return parser.parseAction(expression, getFakeSpan(), /* absoluteOffset */ 0);
}

describe('serializer', () => {
  describe('serialize', () => {
    it('serializes unary plus', () => {
      expect(serialize(parse(' + 1234 '))).toBe('+1234');
    });

    it('serializes unary negative', () => {
      expect(serialize(parse(' - 1234 '))).toBe('-1234');
    });

    it('serializes binary operations', () => {
      expect(serialize(parse(' 1234   +   4321 '))).toBe('1234 + 4321');
    });

    it('serializes exponentiation', () => {
      expect(serialize(parse(' 1  *  2  **  3 '))).toBe('1 * 2 ** 3');
    });

    it('serializes chains', () => {
      expect(serialize(parseAction(' 1234;   4321 '))).toBe('1234; 4321');
    });

    it('serializes conditionals', () => {
      expect(serialize(parse(' cond   ?   1234   :   4321 '))).toBe('cond ? 1234 : 4321');
    });

    it('serializes `this`', () => {
      expect(serialize(parse(' this '))).toBe('this');
    });

    it('serializes keyed reads', () => {
      expect(serialize(parse(' foo   [bar] '))).toBe('foo[bar]');
    });

    it('serializes keyed write', () => {
      expect(serialize(parse(' foo   [bar]   =   baz '))).toBe('foo[bar] = baz');
    });

    it('serializes array literals', () => {
      expect(serialize(parse(' [   foo,   bar,   baz   ] '))).toBe('[foo, bar, baz]');
    });

    it('serializes object literals', () => {
      expect(serialize(parse(' {   foo:   bar,   baz:   test   } '))).toBe('{foo: bar, baz: test}');
    });

    it('serializes primitives', () => {
      expect(serialize(parse(` 'test' `))).toBe(`'test'`);
      expect(serialize(parse(' "test" '))).toBe(`'test'`);
      expect(serialize(parse(' true '))).toBe('true');
      expect(serialize(parse(' false '))).toBe('false');
      expect(serialize(parse(' 1234 '))).toBe('1234');
      expect(serialize(parse(' null '))).toBe('null');
      expect(serialize(parse(' undefined '))).toBe('undefined');
    });

    it('escapes string literals', () => {
      expect(serialize(parse(` 'Hello, \\'World\\'...' `))).toBe(`'Hello, \\'World\\'...'`);
      expect(serialize(parse(` 'Hello, \\"World\\"...' `))).toBe(`'Hello, "World"...'`);
    });

    it('serializes pipes', () => {
      expect(serialize(parse(' foo   |   pipe '))).toBe('foo | pipe');
    });

    it('serializes not prefixes', () => {
      expect(serialize(parse(' !   foo '))).toBe('!foo');
    });

    it('serializes non-null assertions', () => {
      expect(serialize(parse(' foo   ! '))).toBe('foo!');
    });

    it('serializes property reads', () => {
      expect(serialize(parse(' foo   .   bar '))).toBe('foo.bar');
    });

    it('serializes property writes', () => {
      expect(serialize(parseAction(' foo   .   bar   =   baz '))).toBe('foo.bar = baz');
    });

    it('serializes safe property reads', () => {
      expect(serialize(parse(' foo   ?.   bar '))).toBe('foo?.bar');
    });

    it('serializes safe keyed reads', () => {
      expect(serialize(parse(' foo   ?.   [   bar   ] '))).toBe('foo?.[bar]');
    });

    it('serializes calls', () => {
      expect(serialize(parse(' foo   (   ) '))).toBe('foo()');
      expect(serialize(parse(' foo   (   bar   ) '))).toBe('foo(bar)');
      expect(serialize(parse(' foo   (   bar   ,   ) '))).toBe('foo(bar, )');
      expect(serialize(parse(' foo   (   bar   ,   baz   ) '))).toBe('foo(bar, baz)');
    });

    it('serializes safe calls', () => {
      expect(serialize(parse(' foo   ?.   (   ) '))).toBe('foo?.()');
      expect(serialize(parse(' foo   ?.   (   bar   ) '))).toBe('foo?.(bar)');
      expect(serialize(parse(' foo   ?.   (   bar   ,   ) '))).toBe('foo?.(bar, )');
      expect(serialize(parse(' foo   ?.   (   bar   ,   baz   ) '))).toBe('foo?.(bar, baz)');
    });

    it('serializes void expressions', () => {
      expect(serialize(parse(' void   0 '))).toBe('void 0');
    });

    it('serializes in expressions', () => {
      expect(serialize(parse(' foo   in   bar '))).toBe('foo in bar');
    });

    it('serializes instanceof expressions', () => {
      expect(serialize(parse(' foo   instanceof   Bar '))).toBe('foo instanceof Bar');
    });

    it('serializes arrow function with rest parameter', () => {
      expect(serialize(parse('(...args) => args'))).toBe('(...args) => args');
    });

    it('serializes arrow function with regular and rest parameters', () => {
      expect(serialize(parse('(a, b, ...rest) => a + b'))).toBe('(a, b, ...rest) => a + b');
    });

    it('serializes arrow function with object destructuring parameter', () => {
      expect(serialize(parse('({a, b}) => a + b'))).toBe('({a, b}) => a + b');
    });

    it('serializes arrow function with array destructuring parameter', () => {
      expect(serialize(parse('([a, b]) => a + b'))).toBe('([a, b]) => a + b');
    });

    it('serializes arrow function with mixed params including destructuring', () => {
      expect(serialize(parse('(x, {a, b}) => x + a + b'))).toBe('(x, {a, b}) => x + a + b');
    });

    it('serializes arrow function with rest destructuring parameter', () => {
      expect(serialize(parse('(...{length}) => length'))).toBe('(...{length}) => length');
    });

    it('serializes BigInt literal', () => {
      expect(serialize(parse('1n'))).toBe('1n');
    });

    it('serializes large BigInt literal', () => {
      expect(serialize(parse('9007199254740991n'))).toBe('9007199254740991n');
    });

    it('serializes BigInt in expression', () => {
      expect(serialize(parse('1n + 2n'))).toBe('1n + 2n');
    });

    it('serializes hex number literal as decimal', () => {
      expect(serialize(parse('0xFF'))).toBe('255');
    });

    it('serializes octal number literal as decimal', () => {
      expect(serialize(parse('0o77'))).toBe('63');
    });

    it('serializes binary number literal as decimal', () => {
      expect(serialize(parse('0b1010'))).toBe('10');
    });

    it('serializes computed property name in object literal', () => {
      expect(serialize(parse('{[key]: value}'))).toBe('{[key]: value}');
    });

    it('serializes mixed regular and computed properties', () => {
      expect(serialize(parse('{a: 1, [key]: 2}'))).toBe('{a: 1, [key]: 2}');
    });
  });
});
