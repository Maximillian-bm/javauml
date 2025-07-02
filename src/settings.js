const vscode = require('vscode');

const SETTINGS_KEY = 'javauml.settings';

function getSettings() {
    const workspaceSettings = vscode.workspace.getConfiguration(SETTINGS_KEY);
    return {
        sourceFolder: workspaceSettings.get('sourceFolder'),
        outputLocation: workspaceSettings.get('outputLocation')
    };
}

function saveSettings(sourceFolder, outputLocation) {
    const workspaceSettings = vscode.workspace.getConfiguration(SETTINGS_KEY);
    return workspaceSettings.update('sourceFolder', sourceFolder, vscode.ConfigurationTarget.Workspace)
        .then(() => workspaceSettings.update('outputLocation', outputLocation, vscode.ConfigurationTarget.Workspace));
}

module.exports = {
    getSettings,
    saveSettings
};