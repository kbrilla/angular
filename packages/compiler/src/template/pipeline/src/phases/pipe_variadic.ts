/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';

import type {CompilationJob, ComponentCompilationJob} from '../compilation';

/**
 * Pipes that accept more than 4 arguments are variadic, and are handled with a different runtime
 * instruction.
 */
export function createVariadicPipes(job: CompilationJob): void {
  for (const unit of job.units) {
    for (const op of unit.update) {
      ir.transformExpressionsInOp(op, transformVariadicPipeExpr, ir.VisitorContextFlag.None);
    }

    // Also transform variadic pipes inside listener handler ops.
    for (const op of unit.create) {
      if (
        op.kind === ir.OpKind.Listener ||
        op.kind === ir.OpKind.TwoWayListener ||
        op.kind === ir.OpKind.AnimationListener ||
        op.kind === ir.OpKind.Animation
      ) {
        for (const handlerOp of op.handlerOps) {
          ir.transformExpressionsInOp(
            handlerOp,
            transformVariadicPipeExpr,
            ir.VisitorContextFlag.None,
          );
        }
      }
    }
  }
}

function transformVariadicPipeExpr(expr: o.Expression): o.Expression {
  if (!(expr instanceof ir.PipeBindingExpr)) {
    return expr;
  }

  // Pipes are variadic if they have more than 4 arguments.
  if (expr.args.length <= 4) {
    return expr;
  }

  return new ir.PipeBindingVariadicExpr(
    expr.target,
    expr.targetSlot,
    expr.name,
    o.literalArr(expr.args),
    expr.args.length,
  );
}
