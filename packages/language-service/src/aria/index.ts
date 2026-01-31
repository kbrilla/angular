/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export {
  getAriaDiagnostics,
  AriaDiagnosticCode,
  AriaDiagnosticsConfig,
  DEFAULT_ARIA_DIAGNOSTICS_CONFIG,
  getAllAriaAttributes,
  getAllAriaRoles,
} from './aria_diagnostics';

export {getAriaCompletions, getAriaQuickInfo} from './aria_completions';

export {
  isValidAriaAttribute,
  isValidAriaRole,
  validateAriaValue,
  findSimilarAriaAttributes,
  findSimilarAriaRoles,
  getAriaAttributeValues,
  getAriaAttributeDocumentation,
  getAriaAttributeType,
  VALID_ARIA_ATTRIBUTES,
  VALID_ARIA_ROLES,
  ARIA_ATTRIBUTES,
  ARIA_ROLES,
} from './aria_data';
