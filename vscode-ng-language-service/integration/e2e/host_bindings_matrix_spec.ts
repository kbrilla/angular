import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

import {activate, HOST_BINDINGS_COMPONENT_URI} from './helper';

function positionOf(document: vscode.TextDocument, needle: string): vscode.Position {
  const index = document.getText().indexOf(needle);
  expect(index).toBeGreaterThanOrEqual(0);
  return document.positionAt(index);
}

describe('Angular LS host bindings scope matrix', () => {
  beforeEach(async () => {
    await activate(HOST_BINDINGS_COMPONENT_URI);
  });

  it('applies Angular host binding scopes on event key names', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'click)');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('hostbindings.ng');
    expect(token.scopes).toContain('entity.other.attribute-name.html');
    expect(token.scopes.some((scope) => scope.startsWith('entity.other.ng-binding-name.')))
      .withContext(JSON.stringify(token.scopes))
      .toBeTrue();
  });

  it('applies Angular host binding scopes on attr binding keys', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'attr.aria-label');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('hostbindings.ng');
    expect(token.scopes).toContain('entity.other.attribute-name.html');
    expect(token.scopes.some((scope) => scope.includes('ng-binding-name.attr.aria-label')))
      .withContext(JSON.stringify(token.scopes))
      .toBeTrue();
  });

  it('applies Angular host binding scopes on class binding keys', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'class.active');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('hostbindings.ng');
    expect(token.scopes).toContain('entity.other.attribute-name.html');
    expect(token.scopes.some((scope) => scope.includes('ng-binding-name.class.active')))
      .withContext(JSON.stringify(token.scopes))
      .toBeTrue();
  });

  it('applies style property and unit scopes on style binding keys', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const propertyPosition = positionOf(document, 'padding]');
    const propertyToken = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      propertyPosition,
    );

    const unitPosition = positionOf(document, 'px]');
    const unitToken = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      unitPosition,
    );

    expect(propertyToken.scopes).toContain('entity.other.ng-binding-name.style.property.html');
    expect(unitToken.scopes).toContain('entity.other.ng-binding-name.style.unit.html');
  });

  it('embeds CSS scopes in static style host value', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'var(--help)');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('source.css');
  });

  it('embeds CSS scopes in quoted [style.prop] host value', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, '5px');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('source.css.scss');
  });

  it('embeds CSS scopes in quoted [style] object-string host value', async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'width: 200px');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('source.css.scss');
  });
});
