// extension.ts
import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { SubscriptionInfo } from './model';
import FileProcessor from './file-processor';




export function activate(context: vscode.ExtensionContext) {
	console.log('RxJS Subscription Leak Detector is active');

	// Register the command
	let disposable = vscode.commands.registerCommand('rxjs-subscription-detector.findLeaks', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('Please open a folder first');
			return;
		}

		const rootPath = workspaceFolders[0].uri.fsPath;
		vscode.window.showInformationMessage('Scanning for potential RxJS subscription leaks...');

		try {
			// Find all Angular component files
			const fileProcessor = new FileProcessor(context);
			const angularFiles = await fileProcessor.findAngularFiles(rootPath);
			const subscriptionInfo = [];

			// Analyze each file
			for (const file of angularFiles) {
		     	const fileContent = fs.readFileSync(file, 'utf8');
				const sourceFile = ts.createSourceFile(
					file,
					fileContent,
					ts.ScriptTarget.Latest,
					true
				);

				const componentInfo = fileProcessor.analyzeFile(sourceFile, file, fileContent);
				subscriptionInfo.push(...componentInfo);
			}

			// Filter to show only potential leaks
			const potentialLeaks = subscriptionInfo.filter(info => !info.hasUnsubscribe);

			 // Add filename (basename) to each leak
			 potentialLeaks.forEach(leak => {
				leak.fileName = path.basename(leak.file);
			  });

			// Show results
			showResults(potentialLeaks, context.extensionUri);
		} catch (error) {
			vscode.window.showErrorMessage(`Error: ${error}`);
		}
	});

	context.subscriptions.push(disposable);
}

function showResults(leaks: SubscriptionInfo[], extensionUri: vscode.Uri) {
	// If no leaks found
	if (leaks.length === 0) {
		vscode.window.showInformationMessage('No potential subscription leaks found!');
		return;
	}



	// Create a webview to display results
	const panel = vscode.window.createWebviewPanel(
		'subscriptionLeaks',
		'RxJS Subscription Leaks',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(extensionUri, 'src')
			]
		}
	);

	// Get paths to resources
	const htmlPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'template.html');
	const scriptPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'webview.js');
	const cssPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'style.css');

	// Convert to webview URIs
	const scriptUri = panel.webview.asWebviewUri(scriptPath);
	const cssUri = panel.webview.asWebviewUri(cssPath);

	// Read the HTML template
	fs.readFile(htmlPath.fsPath, 'utf8', (err, htmlContent) => {
		if (err) {
			vscode.window.showErrorMessage(`Error loading template: ${err.message}`);
			return;
		}

		// Insert the CSS link in the head
		let modifiedHtml = htmlContent.replace(
			'</head>',
			`    <link rel="stylesheet" href="${cssUri}">\n</head>`
		);

		// Insert the script tag just before the closing body tag
		modifiedHtml = modifiedHtml.replace(
			'</body>',
			`    <script src="${scriptUri}"></script>\n</body>`
		);

		// Set the HTML content
		panel.webview.html = modifiedHtml;

		// Send the data to the webview after a short delay to ensure the script has loaded
		setTimeout(() => {
			panel.webview.postMessage({
				type: 'leaks-data',
				leaks: leaks
			});
		}, 100);
	});

	// Handle messages from the webview
	panel.webview.onDidReceiveMessage(
		message => {
			if (message.command === 'openFile') {
				const filePath = message.file;
				const line = message.line - 1; // VS Code lines are 0-based

				vscode.workspace.openTextDocument(filePath).then(doc => {
					vscode.window.showTextDocument(doc).then(editor => {
						const position = new vscode.Position(line, 0);
						editor.selection = new vscode.Selection(position, position);
						editor.revealRange(
							new vscode.Range(position, position),
							vscode.TextEditorRevealType.InCenter
						);
					});
				});
			}
		},
		undefined,
		[]
	);
}

export function deactivate() { }