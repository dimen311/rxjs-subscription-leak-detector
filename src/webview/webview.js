// Main function for leak report webview
(function() {
    const vscode = acquireVsCodeApi();
    
    // Receive the leak data from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'leaks-data') {
            updateTable(message.leaks);
        }
    });

    function updateTable(leaks) {
        const tbody = document.getElementById('leaks-tbody');
        const summaryDiv = document.getElementById('leaks-count');
        
        // Update summary
        if (leaks.length === 0) {
            summaryDiv.className = 'no-leaks';
            summaryDiv.textContent = 'No potential subscription leaks found! 👍';
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No issues detected</td></tr>';
            return;
        }
        
        summaryDiv.className = 'has-leaks';
        summaryDiv.textContent = `Found ${leaks.length} potential subscription leak${leaks.length === 1 ? '' : 's'} that might not be properly unsubscribed.`;
        
        // Clear existing table rows
        tbody.innerHTML = '';
        
        // Add new rows
        leaks.forEach(leak => {
            const tr = document.createElement('tr');
            
            // Component name
            const tdComponent = document.createElement('td');
            tdComponent.textContent = leak.componentName;
            tr.appendChild(tdComponent);
            
            // File with link
            const tdFile = document.createElement('td');
            tdFile.className = 'file-link';
            tdFile.textContent = leak.fileName;
            tdFile.dataset.file = leak.file;
            tdFile.dataset.line = leak.line;
            tdFile.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'openFile',
                    file: leak.file,
                    line: parseInt(leak.line)
                });
            });
            tr.appendChild(tdFile);
            
            // Line number
            const tdLine = document.createElement('td');
            tdLine.textContent = leak.line;
            tr.appendChild(tdLine);
            
            // Variable name
            const tdVariable = document.createElement('td');
            tdVariable.textContent = leak.variableName || 'Unknown';
            tr.appendChild(tdVariable);
            
            // Has OnDestroy
            const tdHasOnDestroy = document.createElement('td');
            tdHasOnDestroy.textContent = leak.hasUnsubscribe ? 'Yes' : 'No';
            tr.appendChild(tdHasOnDestroy);
            
            tbody.appendChild(tr);
        });
    }
})();