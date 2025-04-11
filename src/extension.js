"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// extension.ts
const vscode = __importStar(require("vscode"));
const ts = __importStar(require("typescript"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const file_processor_1 = __importDefault(require("./file-processor"));
function activate(context) {
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
            const fileProcessor = new file_processor_1.default(context);
            const angularFiles = await fileProcessor.findAngularFiles(rootPath);
            const subscriptionInfo = [];
            // Analyze each file
            for (const file of angularFiles) {
                const fileContent = fs.readFileSync(file, 'utf8');
                const sourceFile = ts.createSourceFile(file, fileContent, ts.ScriptTarget.Latest, true);
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
            showResults(potentialLeaks, context);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
}
function showResults(leaks, context) {
    // If no leaks found
    if (leaks.length === 0) {
        vscode.window.showInformationMessage('No potential subscription leaks found!');
        return;
    }
    // Create a webview to display results
    const panel = vscode.window.createWebviewPanel('subscriptionLeaks', 'RxJS Subscription Leaks', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'src')
        ]
    });
    // Get paths to resources
    const htmlPath = getResourcePath(context, 'webview', 'template.html');
    const scriptPath = getResourcePath(context, 'webview', 'webview.js');
    const cssPath = getResourcePath(context, 'webview', 'style.css');
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
        let modifiedHtml = htmlContent.replace('</head>', `    <link rel="stylesheet" href="${cssUri}">\n</head>`);
        // Insert the script tag just before the closing body tag
        modifiedHtml = modifiedHtml.replace('</body>', `    <script src="${scriptUri}"></script>\n</body>`);
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
    panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'openFile') {
            const filePath = message.file;
            const line = message.line - 1; // VS Code lines are 0-based
            vscode.workspace.openTextDocument(filePath).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                });
            });
        }
    }, undefined, []);
}
// Use a helper function to determine the correct path
function getResourcePath(context, ...pathSegments) {
    // In development, files are in 'src/webview'
    // In production, files are in 'dist/webview'
    const isDevelopment = fs.existsSync(path.join(context.extensionPath, 'src', 'webview'));
    const basePath = isDevelopment ? 'src' : 'dist';
    return vscode.Uri.joinPath(context.extensionUri, basePath, ...pathSegments);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map