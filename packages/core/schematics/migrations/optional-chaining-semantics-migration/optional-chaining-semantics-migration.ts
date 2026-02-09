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
  Replacement,
  Serializable,
  TextUpdate,
  TsurgeFunnelMigration,
} from '../../utils/tsurge';
import {NgComponentTemplateVisitor} from '../../utils/ng_component_template';
import {AbsoluteFsPath} from '../../../../compiler-cli';
import {addNullCoalescingToSafeNavigations} from './add-null-coalescing';

export interface MigrationConfig {
  /**
   * Whether to migrate this component template.
   */
  shouldMigrate?: (containingFile: ProjectFile) => boolean;
}

export interface OptionalChainingSemanticsData {
  file: ProjectFile;
  replacementCount: number;
  replacements: Replacement[];
}

export interface OptionalChainingCompilationUnitData {
  expressionReplacements: Array<OptionalChainingSemanticsData>;
}

/**
 * Migration that appends `?? null` to safe navigation expressions (`?.`) in Angular templates.
 *
 * When switching from legacy to native optional chaining semantics
 * (`strictOptionalChainingSemantics: true`), the runtime behavior of `?.` changes from
 * returning `null` to returning `undefined` on short-circuit. This migration preserves the
 * legacy `null` behavior for existing expressions by adding `?? null`, so that the switch
 * to native semantics does not break existing code that depends on the `null` return value.
 *
 * Example:
 *   Before: `{{ user?.name }}`
 *   After:  `{{ user?.name ?? null }}`
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
    const expressionReplacements: Array<OptionalChainingSemanticsData> = [];

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
          const {migrated, changed, replacementCount} = addNullCoalescingToSafeNavigations(
            template.content,
          );

          if (!changed) {
            return;
          }

          const fileToMigrate = template.inline
            ? file
            : projectFile(template.filePath as AbsoluteFsPath, info);
          const end = template.start + template.content.length;

          const replacements = [
            new Replacement(
              fileToMigrate,
              new TextUpdate({
                position: template.start,
                end: end,
                toInsert: migrated,
              }),
            ),
          ];

          const existing = expressionReplacements.find((r) => r.file === file);

          if (existing) {
            existing.replacements.push(...replacements);
            existing.replacementCount += replacementCount;
          } else {
            expressionReplacements.push({file, replacements, replacementCount});
          }
        });
      });
    }

    return confirmAsSerializable({expressionReplacements});
  }

  override async combine(
    unitA: OptionalChainingCompilationUnitData,
    unitB: OptionalChainingCompilationUnitData,
  ): Promise<Serializable<OptionalChainingCompilationUnitData>> {
    return confirmAsSerializable({
      expressionReplacements: [
        ...unitA.expressionReplacements,
        ...unitB.expressionReplacements,
      ],
    });
  }

  override async globalMeta(
    combinedData: OptionalChainingCompilationUnitData,
  ): Promise<Serializable<OptionalChainingCompilationUnitData>> {
    return confirmAsSerializable({
      expressionReplacements: combinedData.expressionReplacements,
    });
  }

  override async stats(globalMetadata: OptionalChainingCompilationUnitData) {
    const touchedFilesCount = globalMetadata.expressionReplacements.length;
    const replacementCount = globalMetadata.expressionReplacements.reduce(
      (acc, cur) => acc + cur.replacementCount,
      0,
    );

    return confirmAsSerializable({
      touchedFilesCount,
      replacementCount,
    });
  }

  override async migrate(globalData: OptionalChainingCompilationUnitData) {
    return {
      replacements: globalData.expressionReplacements.flatMap(({replacements}) => replacements),
    };
  }
}
