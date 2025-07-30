import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from './redux';
import { apiService } from '../services/api';

interface PreviewOptions {
  autoRefresh?: boolean;
  refreshDelay?: number;
}

interface PreviewState {
  isLoading: boolean;
  error: string | null;
  previewUrl: string | null;
  lastUpdated: Date | null;
}

export const usePreview = (options: PreviewOptions = {}) => {
  const { autoRefresh = true, refreshDelay = 1000 } = options;
  const { currentProject } = useAppSelector((state) => state.project);
  
  const [state, setState] = useState<PreviewState>({
    isLoading: false,
    error: null,
    previewUrl: null,
    lastUpdated: null,
  });

  const generatePreviewContent = useCallback(() => {
    if (!currentProject || !currentProject.files.length) {
      return '<html><body><div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;"><h1>No files to preview</h1><p>Create some HTML, CSS, or JavaScript files to see a live preview.</p></div></body></html>';
    }

    const htmlFile = currentProject.files.find(f => f.type === 'HTML');
    const cssFiles = currentProject.files.filter(f => f.type === 'CSS');
    const jsFiles = currentProject.files.filter(f => f.type === 'JS');

    let htmlContent = htmlFile?.content || `
      <html>
        <head>
          <title>${currentProject.name}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
            <h1>Welcome to ${currentProject.name}</h1>
            <p>No HTML file found. Create an HTML file to get started!</p>
          </div>
        </body>
      </html>
    `;

    // Ensure we have proper HTML structure
    if (!htmlContent.includes('<html')) {
      htmlContent = `<html><head><title>${currentProject.name}</title></head><body>${htmlContent}</body></html>`;
    }

    // Inject CSS files
    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map(file => `<style data-filename="${file.filename}">${file.content}</style>`).join('\n');
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${cssContent}\n</head>`);
      } else {
        htmlContent = htmlContent.replace('<html>', `<html><head>${cssContent}</head>`);
      }
    }

    // Inject JavaScript files with console capture and error handling
    if (jsFiles.length > 0) {
      const consoleCapture = `
        <script data-preview-console>
          (function() {
            // Capture console messages and send to parent
            const originalConsole = {
              log: console.log.bind(console),
              error: console.error.bind(console),
              warn: console.warn.bind(console),
              info: console.info.bind(console)
            };
            
            function captureConsole(type, ...args) {
              originalConsole[type](...args);
              try {
                window.parent.postMessage({
                  type: 'console',
                  level: type,
                  message: args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                      try {
                        return JSON.stringify(arg, null, 2);
                      } catch (e) {
                        return String(arg);
                      }
                    }
                    return String(arg);
                  }).join(' '),
                  timestamp: new Date().toISOString()
                }, '*');
              } catch (e) {
                // Ignore postMessage errors
              }
            }
            
            console.log = (...args) => captureConsole('log', ...args);
            console.error = (...args) => captureConsole('error', ...args);
            console.warn = (...args) => captureConsole('warn', ...args);
            console.info = (...args) => captureConsole('info', ...args);
            
            // Capture runtime errors
            window.addEventListener('error', (event) => {
              try {
                window.parent.postMessage({
                  type: 'console',
                  level: 'error',
                  message: \`Error: \${event.message}\${event.filename ? \` at \${event.filename}:\${event.lineno}\` : ''}\`,
                  timestamp: new Date().toISOString()
                }, '*');
              } catch (e) {
                // Ignore postMessage errors
              }
            });
            
            // Capture unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
              try {
                window.parent.postMessage({
                  type: 'console',
                  level: 'error',
                  message: \`Unhandled Promise Rejection: \${event.reason}\`,
                  timestamp: new Date().toISOString()
                }, '*');
              } catch (e) {
                // Ignore postMessage errors
              }
            });
          })();
        </script>
      `;
      
      const jsContent = jsFiles.map(file => `<script data-filename="${file.filename}">${file.content}</script>`).join('\n');
      
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${consoleCapture}\n${jsContent}\n</body>`);
      } else {
        htmlContent += `${consoleCapture}\n${jsContent}`;
      }
    }

    return htmlContent;
  }, [currentProject]);

  const updatePreview = useCallback(async () => {
    if (!currentProject) {
      setState(prev => ({
        ...prev,
        previewUrl: null,
        error: null,
        isLoading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const content = generatePreviewContent();
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Clean up previous URL
      setState(prev => {
        if (prev.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return {
          ...prev,
          previewUrl: url,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to generate preview',
        isLoading: false,
      }));
    }
  }, [currentProject, generatePreviewContent]);

  // Auto-refresh when project files change
  useEffect(() => {
    if (!autoRefresh) return;

    const timeoutId = setTimeout(() => {
      updatePreview();
    }, refreshDelay);

    return () => clearTimeout(timeoutId);
  }, [currentProject, autoRefresh, refreshDelay, updatePreview]);

  // Initial load
  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  const refresh = useCallback(() => {
    updatePreview();
  }, [updatePreview]);

  const generateShareableUrl = useCallback(async (): Promise<string | null> => {
    if (!currentProject) return null;

    try {
      const response = await apiService.generateShareableUrl(currentProject.id);
      
      if (response.error) {
        console.error('Failed to generate shareable URL:', response.error);
        return null;
      }
      
      return response.data?.shareUrl || null;
    } catch (err) {
      console.error('Failed to generate shareable URL:', err);
      return null;
    }
  }, [currentProject]);

  return {
    ...state,
    refresh,
    generateShareableUrl,
  };
};