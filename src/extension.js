// filepath: /vscode-extension-app/vscode-extension-app/src/extension.js
const vscode = require('vscode');
const settings = require('./settings');
const readWrite = require('./parsingJava')

/**
 * @param {vscode.ExtensionContext} context
 */

class ViewProvider {
    constructor(context) {
        this._context = context;
    }

    resolveWebviewView(webviewView) {
    	const userSettings = settings.getSettings() || {};
    	const sourceFolder = userSettings.sourceFolder || '';
    	const outputLocation = userSettings.outputLocation || '';

    	webviewView.webview.options = {
        	enableScripts: true
    	};

    	webviewView.webview.html = /*html*/`
        	<html lang="en">
			<head>
				<meta charset="UTF-8">
				<style>
					body {
						font-family: sans-serif;
						padding: 16px;
						color: #d4d4d4;
						background-color: #1e1e1e;
					}

					h2 {
						margin-top: 0;
						color: #ffffff;
						font-size: 18px;
					}

					label {
						display: block;
						margin-top: 12px;
						margin-bottom: 4px;
						font-weight: bold;
					}

					input[type="text"] {
						width: calc(100% - 90px);
						padding: 6px 8px;
						border: 1px solid #333;
						background-color: #2d2d2d;
						color: #ffffff;
						border-radius: 4px;
						margin-right: 6px;
					}

					button {
						background-color: #0e639c;
						border: none;
						color: white;
						padding: 6px 12px;
						border-radius: 4px;
						cursor: pointer;
					}

					button:hover {
						background-color: #1177bb;
					}

					.row {
						display: flex;
						align-items: center;
						margin-bottom: 12px;
					}

					.actions {
						display: flex;
						justify-content: space-between;
						margin-top: 20px;
					}

					#msg {
						margin-top: 16px;
						color: #dcdcaa;
					}
				</style>
			</head>
			<body>
				<h2>Edit Settings</h2>
				<form id="settingsForm">
					<div class="row">
						<label for="sourceFolder">Source Folder:</label>
						<input type="text" id="sourceFolder" value="${sourceFolder}">
						<button type="button" id="browseSource">Browse</button>
					</div>
					<div class="row">
						<label for="outputLocation">Output Folder:</label>
						<input type="text" id="outputLocation" value="${outputLocation}">
						<button type="button" id="browseOutput">Browse</button>
					</div>
					<div class="actions">
						<button type="button" id="saveBtn">💾 Save</button>
						<button type="button" id="createUmlBtn">📄 Create UML</button>
						<button type="button" id="createJavaBtn">📄 Create Java</button>
					</div>
				</form>
				<div id="msg"></div>

				<script>
					const vscode = acquireVsCodeApi();

					document.getElementById('saveBtn').addEventListener('click', () => {
						const sourceFolder = document.getElementById('sourceFolder').value;
						const outputLocation = document.getElementById('outputLocation').value;
						vscode.postMessage({
							command: 'saveSettings',
							sourceFolder,
							outputLocation
						});
					});

					document.getElementById('createUmlBtn').addEventListener('click', () => {
						vscode.postMessage({ command: 'createUML' });
					});

					document.getElementById('createJavaBtn').addEventListener('click', () => {
						vscode.postMessage({ command: 'createJava' });
					});

					document.getElementById('browseSource').addEventListener('click', () => {
						vscode.postMessage({ command: 'browseSource' });
					});

					document.getElementById('browseOutput').addEventListener('click', () => {
						vscode.postMessage({ command: 'browseOutput' });
					});

					window.addEventListener('message', event => {
						const message = event.data;
						if (message.command === 'setSourceFolder') {
							document.getElementById('sourceFolder').value = message.path;
						}
						if (message.command === 'setOutputFolder') {
							document.getElementById('outputLocation').value = message.path;
						}
						if (message.command === 'showMsg') {
							document.getElementById('msg').textContent = message.text;
						}
					});
				</script>
			</body>
			</html>
    	`;

    	webviewView.webview.onDidReceiveMessage(async message => {
        	if (message.command === 'saveSettings') {
            	settings.saveSettings(message.sourceFolder, message.outputLocation);
            	//webviewView.webview.postMessage({ command: 'showMsg', text: 'Settings saved!' });
        	}
        	if (message.command === 'browseSource') {
    			const workspaceFolders = vscode.workspace.workspaceFolders;
    			const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
    			const folders = await vscode.window.showOpenDialog({
        			canSelectFolders: true,
        			defaultUri
    			});
    			if (folders && folders[0]) {
        			webviewView.webview.postMessage({ command: 'setSourceFolder', path: folders[0].fsPath });
    			}
			}
			if (message.command === 'browseOutput') {
				const workspaceFolders = vscode.workspace.workspaceFolders;
				const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
				const folders = await vscode.window.showOpenDialog({
					canSelectFolders: true,
					defaultUri
				});
				if (folders && folders[0]) {
					webviewView.webview.postMessage({ command: 'setOutputFolder', path: folders[0].fsPath });
				}
			}
			if (message.command === 'createUML') {
				vscode.window.showInformationMessage('Creating UML diagrams...');
				const userSettings = settings.getSettings();
				if (userSettings) {
					const project = readWrite.readSourceFolder(userSettings.sourceFolder);
					const uml = project.toUML();
					readWrite.writeUMLToFile(uml, userSettings.outputLocation);
        		} else {
            		vscode.window.showInformationMessage('No settings found.');
        		}
			}
			if (message.command === 'createJava') {
				vscode.window.showInformationMessage('Creating Java project...');				
			}
    	});
	}
}

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

	const provider = new ViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('javaumlView', provider)
    );

    context.subscriptions.push(disposableSaveSettings);
    context.subscriptions.push(disposableLoadSettings);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
