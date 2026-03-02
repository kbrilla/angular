import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

import {
  activate,
  STYLE_TOKEN_PARITY_COMPONENT_URI,
  STYLE_TOKEN_PARITY_INLINE_COMPONENT_URI,
  STYLE_TOKEN_PARITY_TEMPLATE_URI,
} from './helper';

function positionOf(document: vscode.TextDocument, needle: string, offset = 0): vscode.Position {
  const index = document.getText().indexOf(needle);
  expect(index).withContext(`Missing marker: ${needle}`).toBeGreaterThanOrEqual(0);
  if (index < 0) {
    throw new Error(`Missing marker: ${needle}`);
  }
  return document.positionAt(index + offset);
}

async function scopesAt(
  document: vscode.TextDocument,
  needle: string,
  offset = 0,
): Promise<string[]> {
  const position = positionOf(document, needle, offset);
  const info = await TextmateLanguageService.api.getScopeInformationAtPosition(document, position);
  return info.scopes;
}

function expectContainsAll(scopes: string[], expected: string[]): void {
  for (const value of expected) {
    expect(scopes).withContext(`Expected scope chain to contain: ${value}`).toContain(value);
  }
}

describe('style token parity', () => {
  it('tokenizes external template style declarations as property/value (not selector)', async () => {
    await activate(STYLE_TOKEN_PARITY_TEMPLATE_URI);
    const document = vscode.window.activeTextEditor!.document;

    const widthScopes = await scopesAt(document, 'width: var(--parity-ext-var)', 0);
    const colonScopes = await scopesAt(document, 'width: var(--parity-ext-var)', 'width'.length);
    const varScopes = await scopesAt(document, 'var(--parity-ext-var)', 0);
    const customVarScopes = await scopesAt(document, '--parity-ext-var', 0);

    expectContainsAll(widthScopes, [
      'meta.attribute.style.html',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expectContainsAll(colonScopes, ['punctuation.separator.key-value.css']);
    expectContainsAll(varScopes, ['meta.function.variable.css', 'support.function.misc.css']);
    expectContainsAll(customVarScopes, ['variable.argument.css']);
    expect(widthScopes).not.toContain('meta.selector.css');
  });

  it('keeps invalid property names out of known-property scope in external template style', async () => {
    await activate(STYLE_TOKEN_PARITY_TEMPLATE_URI);
    const document = vscode.window.activeTextEditor!.document;

    const invalidScopes = await scopesAt(document, 'widht: var(--parity-ext-var)', 0);

    expectContainsAll(invalidScopes, ['meta.attribute.style.html', 'meta.property-name.css']);
    expect(invalidScopes).not.toContain('support.type.property-name.css');
    expect(invalidScopes).not.toContain('meta.selector.css');
  });

  it('keeps style token parity in inline template and host style values (component + directive)', async () => {
    await activate(STYLE_TOKEN_PARITY_INLINE_COMPONENT_URI);
    const inlineDocument = vscode.window.activeTextEditor!.document;

    const inlineWidthScopes = await scopesAt(inlineDocument, 'width: var(--parity-inline-var)', 0);

    expectContainsAll(inlineWidthScopes, [
      'text.html.derivative',
      'meta.attribute.style.html',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expect(inlineWidthScopes).not.toContain('meta.selector.css');

    await activate(STYLE_TOKEN_PARITY_COMPONENT_URI);
    const appDocument = vscode.window.activeTextEditor!.document;

    const componentHostWidthScopes = await scopesAt(
      appDocument,
      'width: var(--parity-component-host-var)',
      0,
    );

    expectContainsAll(componentHostWidthScopes, [
      'hostbindings.ng',
      'source.css',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expect(componentHostWidthScopes).not.toContain('meta.selector.css');

    const directiveHostWidthScopes = await scopesAt(
      appDocument,
      'width: var(--parity-directive-host-var)',
      0,
    );
    const directiveHostInvalidScopes = await scopesAt(
      appDocument,
      'widht: var(--parity-directive-host-var)',
      0,
    );

    expectContainsAll(directiveHostWidthScopes, [
      'hostbindings.ng',
      'source.css',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expect(directiveHostWidthScopes).not.toContain('meta.selector.css');

    expectContainsAll(directiveHostInvalidScopes, ['hostbindings.ng', 'meta.property-name.css']);
    expect(directiveHostInvalidScopes).not.toContain('support.type.property-name.css');
    expect(directiveHostInvalidScopes).not.toContain('meta.selector.css');

    const componentHostNoSemiScopes = await scopesAt(
      appDocument,
      'width: var(--parity-component-host-no-semi)',
      0,
    );
    const directiveHostNoSemiScopes = await scopesAt(
      appDocument,
      'width: var(--parity-directive-host-no-semi)',
      0,
    );
    const attrKeyScopes = await scopesAt(appDocument, '[attr.data-test]', 1);
    const stylePaddingKeyScopes = await scopesAt(appDocument, 'padding]', 0);
    const stylePaddingPxKeyScopes = await scopesAt(appDocument, 'px]', 0);

    expectContainsAll(componentHostNoSemiScopes, [
      'hostbindings.ng',
      'source.css',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expect(componentHostNoSemiScopes).not.toContain('meta.selector.css');

    expectContainsAll(directiveHostNoSemiScopes, [
      'hostbindings.ng',
      'source.css',
      'meta.property-name.css',
      'support.type.property-name.css',
    ]);
    expect(directiveHostNoSemiScopes).not.toContain('meta.selector.css');

    expectContainsAll(attrKeyScopes, ['hostbindings.ng', 'entity.other.attribute-name.html']);
    expect(attrKeyScopes).not.toContain('source.css');

    expectContainsAll(stylePaddingKeyScopes, [
      'hostbindings.ng',
      'entity.other.ng-binding-name.style.property.html',
    ]);
    expect(stylePaddingKeyScopes).not.toContain('source.css');

    expectContainsAll(stylePaddingPxKeyScopes, [
      'hostbindings.ng',
      'entity.other.ng-binding-name.style.unit.html',
    ]);
    expect(stylePaddingPxKeyScopes).not.toContain('source.css');
  });
});
