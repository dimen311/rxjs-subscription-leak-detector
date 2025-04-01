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
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ts = __importStar(require("typescript"));
class FileProcessor {
    context;
    constructor(context) {
        this.context = context;
        this.context = context;
    }
    async findAngularFiles(rootPath) {
        const angularPattern = new vscode.RelativePattern(rootPath, '**/*.{ts,js}');
        const excludePattern = new vscode.RelativePattern(rootPath, '**/node_modules/**');
        const files = await vscode.workspace.findFiles(angularPattern, excludePattern);
        // Filter to likely Angular component files
        return files
            .filter(file => {
            const fileName = path.basename(file.fsPath);
            return fileName.includes('.component.') ||
                fileName.includes('.service.') ||
                fileName.includes('.directive.');
        })
            .map(file => file.fsPath);
    }
    analyzeFile(sourceFile, filePath, fileContent) {
        const result = [];
        let className = '';
        let implementsOnDestroy = false;
        let hasNgOnDestroyMethod = false;
        let subscriptionVariables = [];
        let subscriptionVarToLineMap = new Map();
        // Recursion function to visit each node 
        function visit(node) {
            // Check for class declaration (component/service)
            if (ts.isClassDeclaration(node) && node.name) {
                className = node.name.getText();
                // Check if class implements OnDestroy
                if (node.heritageClauses) {
                    for (const clause of node.heritageClauses) {
                        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                            implementsOnDestroy = clause.types.some(type => type.getText().includes('OnDestroy'));
                        }
                    }
                }
            }
            // Check for ngOnDestroy method
            if (ts.isMethodDeclaration(node) && node.name.getText() === 'ngOnDestroy') {
                hasNgOnDestroyMethod = true;
            }
            // Look for subscription variables
            if (ts.isPropertyDeclaration(node)) {
                const type = node.type?.getText() || '';
                if (type.includes('Subscription')) {
                    const varName = node.name.getText();
                    subscriptionVariables.push(varName);
                    const linePos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    subscriptionVarToLineMap.set(varName, linePos.line + 1);
                }
            }
            // Look for subscription calls
            if (ts.isCallExpression(node) &&
                node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const propAccess = node.expression;
                if (propAccess.name.getText() === 'subscribe') {
                    const linePos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    const line = linePos.line + 1;
                    const column = linePos.character + 1;
                    // Try to find the variable being assigned to
                    let parentNode = node.parent;
                    let variableName = undefined;
                    if (parentNode && ts.isBinaryExpression(parentNode) &&
                        parentNode.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                        const left = parentNode.left;
                        if (ts.isPropertyAccessExpression(left)) {
                            variableName = left.name.getText();
                        }
                        else if (ts.isIdentifier(left)) {
                            variableName = left.getText();
                        }
                    }
                    result.push({
                        file: filePath,
                        fileName: '',
                        line,
                        column,
                        componentName: className,
                        variableName,
                        hasUnsubscribe: implementsOnDestroy && hasNgOnDestroyMethod
                    });
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(sourceFile);
        return result;
    }
}
exports.default = FileProcessor;
//# sourceMappingURL=file-processor.js.map