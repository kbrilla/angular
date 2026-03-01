import * as vscode from 'vscode';

import {activate, FOO_TEMPLATE_URI} from './helper';

const DEFINITION_COMMAND = 'vscode.executeDefinitionProvider';

describe('Angular LS', () => {
  beforeAll(async () => {
    await activate(FOO_TEMPLATE_URI);
  });

  function positionOf(document: vscode.TextDocument, needle: string): vscode.Position {
    const index = document.getText().indexOf(needle);
    expect(index).toBeGreaterThanOrEqual(0);
    return document.positionAt(index);
  }

  it(`returns definition for variable in template`, async () => {
    const document = vscode.window.activeTextEditor!.document;
    const position = positionOf(document, 'title | uppercase');
    // For a complete list of standard commands, see
    // https://code.visualstudio.com/api/references/commands
    const definitions = await vscode.commands.executeCommand<vscode.LocationLink[]>(
      DEFINITION_COMMAND,
      FOO_TEMPLATE_URI,
      position,
    );
    expect(definitions?.length).toBe(1);
    const def = definitions![0];
    expect(def.targetUri.fsPath.endsWith('/app/foo.component.ts')).toBeTrue();

    const targetDocument = await vscode.workspace.openTextDocument(def.targetUri);
    const {start, end} = def.targetRange;
    const targetText = targetDocument.getText(new vscode.Range(start, end));
    expect(targetText).toBe('title');
  });
});
