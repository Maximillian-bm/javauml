// filepath: /vscode-extension-app/vscode-extension-app/src/extension.js
const vscode = require('vscode');
const settings = require('./settings');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "vscode-extension-app" is now active!');

    const disposableSaveSettings = vscode.commands.registerCommand('vscode-extension-app.saveSettings', async () => {
        const sourceFolder = await vscode.window.showOpenDialog({ canSelectFolders: true });
        const outputFolder = await vscode.window.showOpenDialog({ canSelectFolders: true });

        if (sourceFolder && outputFolder) {
            const sourcePath = sourceFolder[0].fsPath;
            const outputPath = outputFolder[0].fsPath;
            settings.saveSettings(sourcePath, outputPath);
            vscode.window.showInformationMessage('Settings saved successfully!');
        }
    });

    const disposableLoadSettings = vscode.commands.registerCommand('vscode-extension-app.loadSettings', () => {
        const userSettings = settings.getSettings();
        if (userSettings) {
            vscode.window.showInformationMessage(`Source Folder: ${userSettings.sourceFolder}, Output Folder: ${userSettings.outputLocation}`);
        } else {
            vscode.window.showInformationMessage('No settings found.');
        }
    });

    context.subscriptions.push(disposableSaveSettings);
    context.subscriptions.push(disposableLoadSettings);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
