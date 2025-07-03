// filepath: /vscode-extension-app/vscode-extension-app/src/extension.js
const vscode = require('vscode');
const settings = require('./settings');
const readWrite = require('./readwrite')

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

    	webviewView.webview.html = `
        	<html>
        	<body>
            	<h2>Edit Settings</h2>
            	<form id="settingsForm">
                	<label>Source Folder:</label><br>
                	<input type="text" id="sourceFolder" value="${sourceFolder}" style="width: 80%"/>
                	<button type="button" id="browseSource">Browse</button><br><br>
                	<label>Output Folder:</label><br>
                	<input type="text" id="outputLocation" value="${outputLocation}" style="width: 80%"/>
                	<button type="button" id="browseOutput">Browse</button><br><br>
                	<button type="button" id="saveBtn">Save</button>
					<button type="button" id="createBtn">Create UML</button>
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

					document.getElementById('createBtn').addEventListener('click', () => {
						vscode.postMessage({ command: 'createUML' });
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
					console.log(project);
        		} else {
            		vscode.window.showInformationMessage('No settings found.');
        		}
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
