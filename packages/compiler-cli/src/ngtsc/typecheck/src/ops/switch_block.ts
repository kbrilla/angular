/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  AST,
  ASTWithSource,
  Binary,
  ImplicitReceiver,
  KeyedRead,
  LiteralPrimitive,
  NonNullAssert,
  PropertyRead,
  SafeKeyedRead,
  SafePropertyRead,
  ThisReceiver,
  TmplAstSwitchBlock,
  TmplAstSwitchBlockCaseGroup,
} from '@angular/compiler';
import {TcbOp} from './base';
import {getStatementsBlock, TcbExpr} from './codegen';
import type {Context} from './context';
import {tcbExpression} from './expression';
import type {Scope} from './scope';

/**
 * A `TcbOp` which renders a `switch` block as a TypeScript `switch` statement.
 *
 * Executing this operation returns nothing.
 */
export class TcbSwitchOp extends TcbOp {
  constructor(
    private tcb: Context,
    private scope: Scope,
    private block: TmplAstSwitchBlock,
  ) {
    super();
  }

  override get optional() {
    return false;
  }

  override execute(): null {
    const switchExpression = tcbExpression(this.block.expression, this.tcb, this.scope);
    const clauses = this.block.groups.flatMap<TcbExpr>((current) => {
      const checkBody = this.tcb.env.config.checkControlFlowBodies;
      const clauseScope = this.scope.createChildScope(
        this.scope,
        null,
        checkBody ? current.children : [],
        checkBody ? this.generateGuard(current, switchExpression) : null,
      );

      const statements = [...clauseScope.render(), new TcbExpr('break')];

      return current.cases.map((switchCase, index) => {
        const statementsStr = getStatementsBlock(
          index === current.cases.length - 1 ? statements : [],
          true /* singleLine */,
        );

        const source =
          switchCase.expression === null
            ? `default: ${statementsStr}`
            : `case ${tcbExpression(switchCase.expression, this.tcb, this.scope).print()}: ${statementsStr}`;

        return new TcbExpr(source);
      });
    });

    if (this.block.exhaustiveCheck) {
      // When the switch expression is a property read off a discriminated union (e.g.
      // `nested.type`), TypeScript cannot narrow the property itself to `never` in the
      // default arm because control flow analysis doesn't propagate through property
      // accesses on loop variables or aliased values. For property reads, asserting the
      // *receiver* object (`nested`) as `never` matches what TypeScript actually narrows in
      // switch default arms. Keyed reads are handled separately because TypeScript can narrow
      // simple keyed accesses like `item['type']` directly, but not indexed receiver chains
      // like `items[$index]['type']`.
      const assertionTarget = this.getExhaustiveCheckAssertionTarget(this.block.expression);
      if (assertionTarget !== null) {
        const switchValue = tcbExpression(assertionTarget, this.tcb, this.scope);
        const exhaustiveId = this.tcb.allocateId();

        clauses.push(
          new TcbExpr(
            `default: const tcbExhaustive${exhaustiveId}: never = ${switchValue.print()};`,
          ),
        );
      } else {
        // The expression cannot be narrowed by TypeScript in a switch default arm.
        // Emit a warning so the user knows the exhaustiveness check was skipped.
        this.tcb.oobRecorder.switchExhaustiveCheckSkipped(
          this.tcb.id,
          this.block.exhaustiveCheck.nameSpan,
        );
      }
    }

    this.scope.addStatement(
      new TcbExpr(
        `switch (${switchExpression.print()}) { ${clauses.map((c) => c.print()).join('\n')} }`,
      ),
    );

    return null;
  }

  private generateGuard(group: TmplAstSwitchBlockCaseGroup, switchValue: TcbExpr): TcbExpr | null {
    // For non-default cases, the guard needs to compare against the case value, e.g.
    // `switchExpression === caseExpression`.
    const hasDefault = group.cases.some((c) => c.expression === null);

    if (!hasDefault) {
      let guard: TcbExpr | null = null;

      for (const switchCase of group.cases) {
        if (switchCase.expression !== null) {
          // The expression needs to be ignored for diagnostics since it has been checked already.
          const expression = tcbExpression(switchCase.expression, this.tcb, this.scope);
          expression.markIgnoreDiagnostics();
          const comparison = new TcbExpr(`${switchValue.print()} === ${expression.print()}`);

          if (guard === null) {
            guard = comparison;
          } else {
            guard = new TcbExpr(`(${guard.print()}) || (${comparison.print()})`);
          }
        }
      }

      return guard;
    }

    // To fully narrow the type in the default case, we need to generate an expression that negates
    // the values of all of the other expressions. For example:
    // @switch (expr) {
    //   @case (1) {}
    //   @case (2) {}
    //   @default {}
    // }
    // Will produce the guard `expr !== 1 && expr !== 2`.
    let guard: TcbExpr | null = null;

    for (const currentGroup of this.block.groups) {
      if (currentGroup === group) {
        continue;
      }

      for (const switchCase of currentGroup.cases) {
        if (switchCase.expression === null) {
          // Skip the default case.
          continue;
        }

        // The expression needs to be ignored for diagnostics since it has been checked already.
        const expression = tcbExpression(switchCase.expression, this.tcb, this.scope);
        expression.markIgnoreDiagnostics();
        const comparison = new TcbExpr(`${switchValue.print()} !== ${expression.print()}`);

        if (guard === null) {
          guard = comparison;
        } else {
          guard = new TcbExpr(`(${guard.print()}) && (${comparison.print()})`);
        }
      }
    }

    return guard;
  }

  /**
   * Returns the AST node to use as the target of the exhaustiveness `never` assertion,
   * or `null` if the assertion should be omitted to avoid a false positive.
   *
   * When switching on a discriminant property (e.g. `item.type`), TypeScript narrows the
   * *receiver* (`item`) to `never` in the default arm — not the property access itself.
   * Asserting `item.type: never` yields `any` (from `never.type`) and causes a spurious
   * error even when all cases are covered. Asserting the receiver instead is correct.
   *
   * Returns `null` (skips the assertion) when the expression cannot be narrowed by TypeScript:
   * - Safe navigation (`maybe?.type`) — `?.` prevents narrowing through optional chains.
   * - Dynamic indexed access (`items[$index].type`, `items[$index]['type']`) — TypeScript
   *   cannot narrow `arr[expr]` through control flow analysis.
   *
   * Note that indexed access with literal keys (e.g. `item.list[0].type`) *is* narrowable by
   * TypeScript and therefore should still get an exhaustiveness assertion.
   */
  private getExhaustiveCheckAssertionTarget(expression: AST): AST | null {
    const inner = expression instanceof ASTWithSource ? expression.ast : expression;

    // Safe navigation operators (`?.`) prevent TypeScript from narrowing in switch defaults.
    if (inner instanceof SafePropertyRead || inner instanceof SafeKeyedRead) {
      return null;
    }

    if (
      inner instanceof PropertyRead &&
      !(inner.receiver instanceof ImplicitReceiver) &&
      !(inner.receiver instanceof ThisReceiver)
    ) {
      // Peel to the receiver so TypeScript can narrow the discriminated union object.
      // Skip only when the receiver is not narrowable by TypeScript.
      const receiver =
        inner.receiver instanceof ASTWithSource ? inner.receiver.ast : inner.receiver;
      return this.isNarrowableTarget(receiver) ? inner.receiver : null;
    }

    // A keyed read on a dynamic receiver (e.g. `items[$index]['type']`) cannot be narrowed.
    if (inner instanceof KeyedRead) {
      return this.isNarrowableTarget(inner) ? expression : null;
    }

    return expression;
  }

  private isNarrowableTarget(expression: AST): boolean {
    const inner = expression instanceof ASTWithSource ? expression.ast : expression;

    if (inner instanceof ImplicitReceiver || inner instanceof ThisReceiver) {
      return true;
    }

    if (inner instanceof NonNullAssert) {
      return this.isNarrowableTarget(inner.expression);
    }

    if (
      inner instanceof SafePropertyRead ||
      inner instanceof SafeKeyedRead ||
      inner instanceof Binary
    ) {
      return false;
    }

    if (inner instanceof PropertyRead) {
      return this.isNarrowableTarget(inner.receiver);
    }

    if (inner instanceof KeyedRead) {
      return inner.key instanceof LiteralPrimitive && this.isNarrowableTarget(inner.receiver);
    }

    return false;
  }
}
