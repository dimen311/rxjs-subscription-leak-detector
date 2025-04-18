import * as ts from 'typescript';
import * as vscode from 'vscode';
import FileProcessor from './file-processor';

// Mock vscode namespace
jest.mock('vscode', () => ({
  workspace: {
    findFiles: jest.fn(),
  },
  RelativePattern: jest.fn().mockImplementation((base, pattern) => ({
    base,
    pattern,
  })),
  ExtensionContext: jest.fn(),
}), { virtual: true });

// Mock typescript namespace
jest.mock('typescript', () => {
  const original = jest.requireActual('typescript');
  return {
    ...original,
    createSourceFile: jest.fn(),
    isClassDeclaration: jest.fn(),
    isMethodDeclaration: jest.fn(),
    isCallExpression: jest.fn(),
    isPropertyAccessExpression: jest.fn(),
    isBinaryExpression: jest.fn(),
    isIdentifier: jest.fn(),
    forEachChild: jest.fn(),
    SyntaxKind: {
      SourceFile: 'SourceFile',
      ClassDeclaration: 'ClassDeclaration',
      PropertyDeclaration: 'PropertyDeclaration',
      BinaryExpression: 'BinaryExpression',
      CallExpression: 'CallExpression',
      PropertyAccessExpression: 'PropertyAccessExpression',
      ImplementsKeyword: 'implements',
      EqualsToken: 'equals',
    },
  };
});

function mockForEachChild(node: any, callback: any) {
  if (!node) return;
  
  // First call callback on the node itself
  callback(node);

  // Then traverse its children
  if (Array.isArray(node.statements)) {
    node.statements.forEach((statement: any) => mockForEachChild(statement, callback));
  }
  if (Array.isArray(node.members)) {
    node.members.forEach((member: any) => mockForEachChild(member, callback));
  }
  if (node.initializer) {
    mockForEachChild(node.initializer, callback);
  }
  if (node.expression) {
    mockForEachChild(node.expression, callback);
  }
  if (node.right) {
    mockForEachChild(node.right, callback);
  }
  if (node.left) {
    mockForEachChild(node.left, callback);
  }
}

describe('FileProcessor', () => {
  let fileProcessor: FileProcessor;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = {} as vscode.ExtensionContext;
    fileProcessor = new FileProcessor(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAngularFiles', () => {
    it('should find Angular component, service, and directive files', async () => {
      const mockFiles = [
        { fsPath: '/path/to/app.component.ts' },
        { fsPath: '/path/to/data.service.ts' },
        { fsPath: '/path/to/custom.directive.ts' },
        { fsPath: '/path/to/regular.ts' },
      ];

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockFiles);

      const result = await fileProcessor.findAngularFiles('/root');

      expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
        expect.objectContaining({ pattern: '**/*.{ts}' }),
        expect.objectContaining({ pattern: '{**/node_modules/**,**/*.spec.ts,**/*.test.ts}' })
      );

      expect(result).toEqual([
        '/path/to/app.component.ts',
        '/path/to/data.service.ts',
        '/path/to/custom.directive.ts',
      ]);
    });
  });

  describe('analyzeFile', () => {
    let mockSourceFile: ts.SourceFile;
    
    beforeEach(() => {
      mockSourceFile = {
        getLineAndCharacterOfPosition: jest.fn().mockReturnValue({ line: 0, character: 0 }),
      } as unknown as ts.SourceFile;

      // Reset all mocks before each test
      jest.clearAllMocks();
    });
 

    it('should handle errors gracefully', () => {
      // Mock an error during analysis
      (ts.forEachChild as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = fileProcessor.analyzeFile(mockSourceFile, 'error.component.ts');

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error analyzing file error.component.ts:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});