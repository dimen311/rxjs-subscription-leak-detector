import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import * as fs from 'fs';
import { SubscriptionInfo } from './model'

class FileProcessor {
    constructor(private context: vscode.ExtensionContext) {
        this.context = context;

    }
   async findAngularFiles(rootPath: string): Promise<string[]> {
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
   
   analyzeFile(sourceFile: ts.SourceFile, filePath: string, fileContent: string): SubscriptionInfo[] {
    const result: SubscriptionInfo[] = [];
   
    let className = '';
    let implementsOnDestroy = false;
    let hasNgOnDestroyMethod = false;
    let subscriptionVariables: string[] = [];
    let subscriptionVarToLineMap = new Map<string, number>();
   
    // Recursion function to visit each node 
    function visit(node: ts.Node) {
        // Check for class declaration (component/service)
        if (ts.isClassDeclaration(node) && node.name) {
            className = node.name.getText();
   
            // Check if class implements OnDestroy
            if (node.heritageClauses) {
                for (const clause of node.heritageClauses) {
                    if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                        implementsOnDestroy = clause.types.some(
                            type => type.getText().includes('OnDestroy')
                        );
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
            const propAccess = node.expression as ts.PropertyAccessExpression;
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
                    } else if (ts.isIdentifier(left)) {
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


export default FileProcessor;