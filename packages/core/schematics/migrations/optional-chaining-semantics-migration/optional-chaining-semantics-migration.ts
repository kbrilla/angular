/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';
import {
  confirmAsSerializable,
  ProgramInfo,
  projectFile,
  ProjectFile,
  Serializable,
  TsurgeFunnelMigration,
} from '../../utils/tsurge';
import {NgComponentTemplateVisitor} from '../../utils/ng_component_template';
import {findSafeNavigationExpressions} from './add-null-coalescing';

export interface MigrationConfig {
  /**
   * Whether to analyze this component template.
   */
  shouldMigrate?: (containingFile: ProjectFile) => boolean;
}

export interface OptionalChainingSemanticsData {
  file: ProjectFile;
  componentName: string;
  expressionCount: number;
}

export interface OptionalChainingCompilationUnitData {
  componentsWithSafeNavigation: Array<OptionalChainingSemanticsData>;
}

/**
 * Analysis migration that reports components using safe navigation (`?.`) in their templates.
 *
 * When switching from legacy to native optional chaining semantics
 * (`strictOptionalChainingSemantics: true`), the runtime behavior of `?.` changes from
 * returning `null` to returning `undefined` on short-circuit. This migration scans templates
 * and reports which components use `?.` so developers can verify their templates before
 * opting into native semantics.
 *
 * NOTE: Auto-transformation with `?? null` is intentionally NOT used because it would
 * incorrectly change genuinely `undefined` property values to `null`. For example:
 *   `a?.b?.c` where `c` is `undefined` on the resolved object:
 *     - Legacy and native both correctly return `undefined` (no short-circuit)
 *     - Adding `?? null` would incorrectly return `null`
 *
 * The recommended migration strategy is:
 * 1. Run this analysis to identify components with `?.` usage
 * 2. Verify each component's template does not depend on the `null` return value
 * 3. Enable `strictOptionalChainingSemantics: true` in the project's tsconfig
 */
export class OptionalChainingSemanticsMigration extends TsurgeFunnelMigration<
  OptionalChainingCompilationUnitData,
  OptionalChainingCompilationUnitData
> {
  constructor(private readonly config: MigrationConfig = {}) {
    super();
  }

  override async analyze(
    info: ProgramInfo,
  ): Promise<Serializable<OptionalChainingCompilationUnitData>> {
    const {sourceFiles, program} = info;
    const typeChecker = program.getTypeChecker();
    const componentsWithSafeNavigation: Array<OptionalChainingSemanticsData> = [];

    for (const sf of sourceFiles) {
      ts.forEachChild(sf, (node: ts.Node) => {
        if (!ts.isClassDeclaration(node)) {
          return;
        }

        const file = projectFile(node.getSourceFile(), info);

        if (this.config.shouldMigrate && this.config.shouldMigrate(file) === false) {
          return;
        }

        const templateVisitor = new NgComponentTemplateVisitor(typeChecker);
        templateVisitor.visitNode(node);

        templateVisitor.resolvedTemplates.forEach((template) => {
          const {hasSafeNavigation, expressionCount} = findSafeNavigationExpressions(
            template.content,
          );

          if (hasSafeNavigation) {
            componentsWithSafeNavigation.push({
              file,
              componentName: node.name?.text ?? '<anonymous>',
              expressionCount,
            });
          }
        });
      });
    }

    return confirmAsSerializable({componentsWithSafeNavigation});
  }

  override async combine(
    unitA: OptionalChainingCompilationUnitData,
    unitB: OptionalChainingCompilationUnitData,
  ): Promise<Serializable<OptionalChainingCompilationUnitData>> {
    return confirmAsSerializable({
      componentsWithSafeNavigation: [
        ...unitA.componentsWithSafeNavigation,
        ...unitB.componentsWithSafeNavigation,
      ],
    });
  }

  override async globalMeta(
    combinedData: OptionalChainingCompilationUnitData,
  ): Promise<Serializable<OptionalChainingCompilationUnitData>> {
    return confirmAsSerializable({
      componentsWithSafeNavigation: combinedData.componentsWithSafeNavigation,
    });
  }

  override async stats(globalMetadata: OptionalChainingCompilationUnitData) {
    const totalComponents = globalMetadata.componentsWithSafeNavigation.length;
    const totalExpressions = globalMetadata.componentsWithSafeNavigation.reduce(
      (acc, cur) => acc + cur.expressionCount,
      0,
    );

    return confirmAsSerializable({
      componentsWithSafeNavigation: totalComponents,
      safeNavigationExpressions: totalExpressions,
    });
  }

  override async migrate(_globalData: OptionalChainingCompilationUnitData) {
    // This migration is analysis-only — it does not auto-transform templates.
    // See class-level JSDoc for the recommended manual migration strategy.
    return {replacements: []};
  }
}

