/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const vscode = require('vscode');
const cp = require("child_process");

const { workspace, commands, window, ProgressLocation, Uri } = vscode;

/**
 * This was a work in progress attempt at putting the AMO versions into a tree pane in the sidebar.
 * I was imagining that reviewers could pick a different version to review there and it would update
 * the workspace to download the right file.
 */
class AMOTreeProvider {

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    return [new AMOVersion("hello", vscode.TreeItemCollapsibleState.None)];
  }
}

class AMOVersion extends vscode.TreeItem {

}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  // I wanted the manifest to show when the workspace is loaded. VSCode extensions load once per
  // workspace, so when the below command runs it will create a workspace and a new instance of the
  // extension will run. When this occurs, this code will detect there is a manifest.json and open
  // it. If you are missing the `latest` directory, make sure to enable symlinks in pyamo.
  const workspaceBase = workspace.workspaceFolders?.[0]?.uri;
  try {
    const manifest = vscode.Uri.joinPath(workspaceBase, "latest/xpi/manifest.json");
    workspace.openTextDocument(manifest).then(doc => window.showTextDocument(doc));
  } catch (e) {}


  // Register work in progress tree provider, see above.
  const amoTreeProvider = new AMOTreeProvider(workspaceBase);
  window.registerTreeDataProvider("amo", amoTreeProvider);


  // Register a command to download add-ons and open them in a workspace
	let disposable = commands.registerCommand('amo-vscode.get', async function () {
    const input = await window.showInputBox({ prompt: "Enter slug, id, or URL", title: "AMO" });
    if (!input) {
      return;
    }

    let folder = await window.withProgress({ title: "AMO", location: ProgressLocation.Notification }, async function(progress) {
      progress.report({
        message: "Downloading " + input
      });
      const child  = cp.spawn('/usr/local/bin/amo', ['get', input]);

      let data = "";
      for await (const chunk of child.stdout) {
          data += chunk;
      }

      await new Promise(resolve => child.on('close', resolve));

      let matches = data.match(/Saving add-on to ([^\n]+)/);
      return matches?.[1];
    });

    let workspaceUri = Uri.file(folder);

    workspace.isTrusted = false;

    if (workspace.name != input) {
      await workspace.updateWorkspaceFolders(0, 0, { name: input, uri: workspaceUri  });
      //await commands.executeCommand('vscode.openFolder', workspaceUri, { forceNewWindow: true });
    }
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
