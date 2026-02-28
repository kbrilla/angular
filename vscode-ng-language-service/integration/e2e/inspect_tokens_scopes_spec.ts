/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

import {activate, MARKDOWN_FENCES_URI} from './helper';

function positionOf(document: vscode.TextDocument, needle: string): vscode.Position {
  const index = document.getText().indexOf(needle);
  expect(index).toBeGreaterThanOrEqual(0);
  return document.positionAt(index);
}

function positionOfNthWithOffset(
  document: vscode.TextDocument,
  needle: string,
  n: number,
  offset: number,
): vscode.Position {
  let from = 0;
  let index = -1;
  for (let i = 0; i < n; i++) {
    index = document.getText().indexOf(needle, from);
    expect(index).toBeGreaterThanOrEqual(0);
    from = index + needle.length;
  }
  return document.positionAt(index + offset);
}

describe('Angular fenced markdown token scopes', () => {
  let document: vscode.TextDocument;

  beforeAll(async () => {
    await activate(MARKDOWN_FENCES_URI);
    document = vscode.window.activeTextEditor!.document;

    const textmateService = new TextmateLanguageService('angular-ts');
    await textmateService.initTokenService();
  });

  it('scopes angular-ts fenced template strings to source.angular-ts without html bleed', async () => {
    const position = positionOfNthWithOffset(document, '@if (isReady)', 1, 1);
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );
    const range = await TextmateLanguageService.api.getScopeRangeAtPosition(document, position);
    const tokenInfo = await TextmateLanguageService.api.getTokenInformationAtPosition(
      document,
      position,
    );

    expect(document.getText(range)).toContain('if');
    expect(tokenInfo.type).toBeDefined();
    expect(tokenInfo.range).toBeDefined();

    expect(token.scopes).toContain('source.angular-ts');
    expect(token.scopes).toContain('meta.embedded.block.angular-ts');
    expect(token.scopes).toContain('string.template.ts');
    expect(token.scopes).not.toContain('keyword.control.block.kind.ng');
    expect(token.scopes).not.toContain('control.block.ng');
  });

  it('includes Angular control-flow scopes in angular-html fenced blocks', async () => {
    const position = positionOfNthWithOffset(document, '@if (isReady)', 2, 1);
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );
    const range = await TextmateLanguageService.api.getScopeRangeAtPosition(document, position);
    const tokenInfo = await TextmateLanguageService.api.getTokenInformationAtPosition(
      document,
      position,
    );

    expect(document.getText(range)).toContain('if');
    expect(tokenInfo.type).toBeDefined();
    expect(tokenInfo.range).toBeDefined();

    expect(token.scopes).toContain('keyword.control.block.kind.ng');
    expect(token.scopes).toContain('control.block.ng');
    expect(token.scopes).toContain('meta.embedded.block.angular-html');
  });

  it('keeps angular-ts fenced styles scoped without cross-language bleed', async () => {
    const position = positionOf(document, 'border-radius');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );
    const range = await TextmateLanguageService.api.getScopeRangeAtPosition(document, position);
    const tokenInfo = await TextmateLanguageService.api.getTokenInformationAtPosition(
      document,
      position,
    );

    expect(document.getText(range)).toContain('border-radius');
    expect(tokenInfo.type).toBeDefined();
    expect(tokenInfo.range).toBeDefined();

    expect(token.scopes).toContain('source.angular-ts');
    expect(token.scopes).toContain('string.template.ts');
    expect(token.scopes).not.toContain('text.angular-html');
    expect(token.scopes).not.toContain('source.css.scss');
  });

  it('does not apply Angular block scopes inside non-angular ts fences', async () => {
    const position = positionOfNthWithOffset(document, '@if (shouldNotHighlight)', 1, 1);
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).not.toContain('keyword.control.block.kind.ng');
    expect(token.scopes).not.toContain('control.block.ng');
    expect(token.scopes).not.toContain('meta.embedded.block.angular-ts');
  });

  it('does not apply fenced css scopes inside non-angular ts fences', async () => {
    const position = positionOf(document, 'border-radius: 2px');
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).not.toContain('source.css.scss');
    expect(token.scopes).not.toContain('meta.embedded.block.angular-ts');
  });

  it('does not apply Angular block scopes to plain markdown text', async () => {
    const position = positionOfNthWithOffset(
      document,
      'Outside fenced block: @if',
      1,
      'Outside fenced block: '.length + 1,
    );
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).not.toContain('keyword.control.block.kind.ng');
    expect(token.scopes).not.toContain('control.block.ng');
    expect(token.scopes).not.toContain('meta.embedded.block.angular-html');
    expect(token.scopes).not.toContain('meta.embedded.block.angular-ts');
  });

  it('supports angular-html tilde fences', async () => {
    const position = positionOfNthWithOffset(document, '@if (isReady)', 3, 1);
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).toContain('keyword.control.block.kind.ng');
    expect(token.scopes).toContain('control.block.ng');
    expect(token.scopes).toContain('meta.embedded.block.angular-html');
  });

  it('does not match malformed angular-ts language labels', async () => {
    const position = positionOfNthWithOffset(document, '@if (malformedLanguageId)', 1, 1);
    const token = await TextmateLanguageService.api.getScopeInformationAtPosition(
      document,
      position,
    );

    expect(token.scopes).not.toContain('meta.embedded.block.angular-ts');
    expect(token.scopes).not.toContain('meta.embedded.block.angular-html');
    expect(token.scopes).not.toContain('keyword.control.block.kind.ng');
  });
});
