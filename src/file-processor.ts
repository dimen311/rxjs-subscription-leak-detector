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
        const excludePattern = new vscode.RelativePattern(rootPath, '{**/node_modules/**,**/*.spec.ts,**/*.test.ts}');

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

            // Traverse all nodes recursively to find subscribe calls
            function visit(node: ts.Node) {
                // Check for class declaration
                if (ts.isClassDeclaration(node) && node.name) {
                    className = node.name.getText();

                    // Check OnDestroy implementation in heritage clauses
                    if (node.heritageClauses) {
                        implementsOnDestroy = node.heritageClauses.some(clause =>
                            clause.token === ts.SyntaxKind.ImplementsKeyword &&
                            clause.types.some(type => type.getText().includes('OnDestroy'))
                        );
                    }
                }
                // Check for ngOnDestroy method
                else if (ts.isMethodDeclaration(node) && node.name.getText() === 'ngOnDestroy') {
                    hasNgOnDestroyMethod = true;
                }
                // Detection for all subscribe call patterns
                else if (ts.isCallExpression(node)) {
                    const expression = node.expression;

                    // This handles both direct subscribe() and pipe().subscribe()
                    if (ts.isPropertyAccessExpression(expression) &&
                        expression.name.getText() === 'subscribe') {

                        const linePos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        let variableName: string | undefined = undefined;

                        // Check if this subscription is being assigned to a variable or property
                        let parent = node.parent;
                        if (parent && ts.isBinaryExpression(parent) &&
                            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                            // This is an assignment (something = observable.subscribe())
                            const left = parent.left;
                            if (ts.isIdentifier(left)) {
                                // Simple variable assignment: sub = observable.subscribe()
                                variableName = left.getText();
                            } else if (ts.isPropertyAccessExpression(left)) {
                                // Property assignment: this.sub = observable.subscribe()
                                variableName = left.name.getText();
                            }
                        } else {
                            const expressionObject = expression.expression;
                            const expressionText = expressionObject.getText();
                            // get string till pipe or subscribe
                            const pipeIndex = expressionText.indexOf('.pipe');
                            const subscribeIndex = expressionText.indexOf('.subscribe');
                            const index = pipeIndex !== -1 ? pipeIndex : subscribeIndex;
                            if (index !== -1) {
                                variableName = expressionText.substring(0, index).trim();
                            } else {
                                // No assignment found, just a direct subscribe call
                                variableName = expressionText;
                            }
                        }

                        result.push({
                            file: filePath,
                            fileName: '',
                            line: linePos.line + 1,
                            column: linePos.character + 1,
                            componentName: className,
                            variableName: variableName,
                            hasUnsubscribe: implementsOnDestroy && hasNgOnDestroyMethod
                        });
                    }
                }

                // Continue traversing the AST
                ts.forEachChild(node, visit);
            }

            // Start the traversal
            visit(sourceFile);

            return result;
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            return [];
        }
    }

}


export default FileProcessor;
