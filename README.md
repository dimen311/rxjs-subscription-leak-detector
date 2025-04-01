# RxJS Subscription Leak Detector

A VS Code extension that helps you identify potential memory leaks caused by unsubscribed RxJS observables in Angular applications.

  <br>
    <img src="https://raw.githubusercontent.com/dimen311/rxjs-subscription-leak-detector/refs/heads/master/rxjs-subscription-detector.gif" alt="logo" width="100%">
  <br>

## Features

- Scans your entire Angular codebase for RxJS subscriptions
- Detects components that subscribe to observables but may not properly unsubscribe
- Provides a detailed report of potential leak locations
- Allows you to quickly navigate to problem areas
- Checks for proper implementation of `OnDestroy` lifecycle hook

## Usage

1. Open your Angular project in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
3. Run the command: `Detect RxJS Subscription Leaks`
4. View the results in the webview panel that appears
5. Click on file links to navigate directly to potential leak locations

## How It Works

The extension analyzes your TypeScript files to find:

- Calls to `.subscribe()` methods
- Variables of type `Subscription`
- Classes that implement `OnDestroy`
- `ngOnDestroy` method implementations that call `unsubscribe()`

It cross-references this information to identify subscriptions that might not be properly cleaned up.

## Extension Settings

No configuration required.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS)
3. Search for "RxJS Subscription Leak Detector"
4. Click Install

### From VSIX File

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions view
4. Click "..." (More Actions) and select "Install from VSIX..."
5. Choose the downloaded file

## Build From Source

```bash
git clone https://github.com/yourusername/rxjs-subscription-detector.git
cd rxjs-subscription-detector
npm install
npm run compile
```

## Best Practices for Avoiding Subscription Leaks

1. Always implement `OnDestroy` and unsubscribe in `ngOnDestroy`
2. Use the `takeUntil` pattern with a destroy subject
3. Use the async pipe in templates where possible
4. Store subscriptions in a collection and unsubscribe from all at once
5. Use finite observables like `take(1)` for one-time operations

## Known Limitations

- False positives might occur for subscriptions that complete naturally
- May not detect subscriptions stored in arrays or complex data structures
- Limited analysis of dynamic subscription patterns
- Doesn't analyze template files for async pipe usage

## License

MIT