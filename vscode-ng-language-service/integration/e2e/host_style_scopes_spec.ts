import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

import {activate, APP_COMPONENT_URI} from './helper';

function positionOf(document: vscode.TextDocument, needle: string): vscode.Position {
  const index = document.getText().indexOf(needle);
  expect(index).toBeGreaterThanOrEqual(0);
  return document.positionAt(index);
}

function expectOrderedScopeChain(scopes: string[], expected: string[]): void {
  let from = -1;
  for (const scope of expected) {
    const index = scopes.indexOf(scope);
    expect(index)
      .withContext(`Expected scope '${scope}' in ${JSON.stringify(scopes)}`)
      .toBeGreaterThan(-1);
    expect(index)
      .withContext(`Expected scope '${scope}' after index ${from} in ${JSON.stringify(scopes)}`)
      .toBeGreaterThan(from);
    from = index;
  }
}

describe('Angular LS host style token scopes', () => {
  beforeEach(async () => {
    await activate(APP_COMPONENT_URI);
  });

  it('embeds CSS scopes for quoted [style.*] host binding values', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, '3px solid black');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expectOrderedScopeChain(token.scopes, ['hostbinding.dynamic.ng', 'source.css.scss']);
  });

  it('keeps non-string [style.*] host binding values as expressions', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'name.length');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('hostbinding.dynamic.ng');
    expect(token.scopes).not.toContain('source.css.scss');
  });
});
