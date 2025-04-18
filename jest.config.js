module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts','**/*.spec.ts'],
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
      '^vscode$': '<rootDir>/src/__mocks__/vscode.js'
    },
    globals: {
      'ts-jest': {
        tsconfig: 'tsconfig.json'
      }
    }
  };