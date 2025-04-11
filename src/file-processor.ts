import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { SubscriptionInfo } from './model'

class FileProcessor {
    constructor(private context: vscode.ExtensionContext) {
        this.context = context;

    }
    async findAngularFiles(rootPath: string): Promise<string[]> {
        const angularPattern = new vscode.RelativePattern(rootPath, '**/*.{ts}');
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

    analyzeFile(sourceFile: ts.SourceFile, filePath: string): SubscriptionInfo[] {
        try {
            const result: SubscriptionInfo[] = [];

            let className = '';
            let implementsOnDestroy = false;
            let hasNgOnDestroyMethod = false;
            let subscriptionVariables: string[] = [];
            let subscriptionVarToLineMap = new Map<string, number>();

            function shouldVisitChildren(node: ts.Node): boolean {
                // Only visit children of these node types
                return ts.isSourceFile(node) ||
                    ts.isClassDeclaration(node) ||
                    ts.isBlock(node) ||
                    ts.isConstructorDeclaration(node) ||
                    ts.isMethodDeclaration(node);
            }

            // Recursion function to visit each node 
            function visit(node: ts.Node): void {
                // Quick check for RxJS-related patterns
                const text = node.getText();
                if (!text.includes('subscribe') &&
                    !text.includes('Subscription') &&
                    !text.includes('OnDestroy') &&
                    !ts.isClassDeclaration(node)) {
                    return;
                }

                // Process only relevant node types
                if (ts.isClassDeclaration(node) && node.name) {
                    className = node.name.getText();
                    // Check OnDestroy implementation
                    if (node.heritageClauses) {
                        implementsOnDestroy = node.heritageClauses.some(clause =>
                            clause.token === ts.SyntaxKind.ImplementsKeyword &&
                            clause.types.some(type => type.getText().includes('OnDestroy'))
                        );
                    }
                } else if (ts.isMethodDeclaration(node) && node.name.getText() === 'ngOnDestroy') {
                    hasNgOnDestroyMethod = true;
                } else if (ts.isPropertyDeclaration(node) && node.type?.getText().includes('Subscription')) {
                    const varName = node.name.getText();
                    subscriptionVariables.push(varName);
                    subscriptionVarToLineMap.set(
                        varName,
                        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
                    );
                } else if (ts.isCallExpression(node) &&
                    node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    const propAccess = node.expression as ts.PropertyAccessExpression;
                    if (propAccess.name.getText() === 'subscribe') {
                        // Process subscribe call
                        const linePos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        let variableName = undefined;

                        if (ts.isBinaryExpression(node.parent) &&
                            node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                            const left = node.parent.left;
                            variableName = ts.isPropertyAccessExpression(left) ?
                                left.name.getText() :
                                ts.isIdentifier(left) ? left.getText() : undefined;
                        }

                        result.push({
                            file: filePath,
                            fileName: '',
                            line: linePos.line + 1,
                            column: linePos.character + 1,
                            componentName: className,
                            variableName,
                            hasUnsubscribe: implementsOnDestroy && hasNgOnDestroyMethod
                        });
                    }
                }

                // Only traverse children of relevant nodes
                if (shouldVisitChildren(node)) {
                    ts.forEachChild(node, visit);
                }
            }

            visit(sourceFile);
            return result;
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            return [];
        }
    }

}


export default FileProcessor;