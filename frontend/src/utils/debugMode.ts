import { errorHandler } from './errorHandler';
import { performanceMonitor } from './performanceMonitor';

export interface FrontendDebugInfo {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
  stack?: string;
  url: string;
  userAgent: string;
}

export class FrontendDebugMode {
  private static instance: FrontendDebugMode;
  private isEnabled: boolean = false;
  private debugLogs: FrontendDebugInfo[] = [];
  private maxLogs: number = 500;
  private categories: Set<string> = new Set();
  private enabledCategories: Set<string> = new Set();
  private debugPanel: HTMLElement | null = null;

  private constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                     localStorage.getItem('debug_mode') === 'true' ||
                     new URLSearchParams(window.location.search).has('debug');
    
    this.setupDebugCategories();
    this.setupKeyboardShortcuts();
    
    if (this.isEnabled) {
      this.createDebugPanel();
    }
  }

  public static getInstance(): FrontendDebugMode {
    if (!FrontendDebugMode.instance) {
      FrontendDebugMode.instance = new FrontendDebugMode();
    }
    return FrontendDebugMode.instance;
  }

  private setupDebugCategories(): void {
    const defaultCategories = [
      'react',
      'redux',
      'api',
      'websocket',
      'performance',
      'user-interaction',
      'navigation',
      'editor',
      'preview',
      'auth',
      'project',
      'collaboration',
    ];

    defaultCategories.forEach(category => {
      this.categories.add(category);
      if (this.isEnabled) {
        this.enabledCategories.add(category);
      }
    });

    // Parse debug categories from localStorage or URL
    const debugCategories = localStorage.getItem('debug_categories') || 
                           new URLSearchParams(window.location.search).get('debug_categories');
    
    if (debugCategories) {
      const patterns = debugCategories.split(',').map(p => p.trim());
      patterns.forEach(pattern => {
        if (pattern === '*') {
          this.categories.forEach(cat => this.enabledCategories.add(cat));
        } else if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          this.categories.forEach(cat => {
            if (cat.startsWith(prefix)) {
              this.enabledCategories.add(cat);
            }
          });
        } else {
          this.enabledCategories.add(pattern);
        }
      });
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+D to toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        this.toggle();
      }
      
      // Ctrl+Shift+C to clear debug logs
      if (event.ctrlKey && event.shiftKey && event.key === 'C' && this.isEnabled) {
        event.preventDefault();
        this.clearLogs();
      }
      
      // Ctrl+Shift+E to export debug logs
      if (event.ctrlKey && event.shiftKey && event.key === 'E' && this.isEnabled) {
        event.preventDefault();
        this.exportLogs();
      }
    });
  }

  public enable(categories?: string[]): void {
    this.isEnabled = true;
    localStorage.setItem('debug_mode', 'true');
    
    if (categories) {
      categories.forEach(cat => {
        this.categories.add(cat);
        this.enabledCategories.add(cat);
      });
      localStorage.setItem('debug_categories', categories.join(','));
    } else {
      this.categories.forEach(cat => this.enabledCategories.add(cat));
    }

    this.createDebugPanel();
    this.log('debug', 'Frontend debug mode enabled', { categories: Array.from(this.enabledCategories) });
  }

  public disable(): void {
    this.isEnabled = false;
    localStorage.removeItem('debug_mode');
    this.enabledCategories.clear();
    this.removeDebugPanel();
    console.log('Frontend debug mode disabled');
  }

  public toggle(): void {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  public enableCategory(category: string): void {
    this.categories.add(category);
    this.enabledCategories.add(category);
    this.updateDebugPanel();
    this.log('debug', `Debug category enabled: ${category}`);
  }

  public disableCategory(category: string): void {
    this.enabledCategories.delete(category);
    this.updateDebugPanel();
    this.log('debug', `Debug category disabled: ${category}`);
  }

  public log(category: string, message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const debugInfo: FrontendDebugInfo = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.debugLogs.push(debugInfo);
    
    if (this.debugLogs.length > this.maxLogs) {
      this.debugLogs.shift();
    }

    // Console output with styling
    const style = this.getConsoleStyle(level);
    const logMessage = `%c[DEBUG:${category}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, style, data);
        break;
      case 'info':
        console.info(logMessage, style, data);
        break;
      case 'warn':
        console.warn(logMessage, style, data);
        break;
      case 'error':
        console.error(logMessage, style, data);
        break;
    }

    this.updateDebugPanel();
  }

  private getConsoleStyle(level: string): string {
    const styles = {
      debug: 'color: #888; font-weight: normal;',
      info: 'color: #0066cc; font-weight: bold;',
      warn: 'color: #ff8800; font-weight: bold;',
      error: 'color: #cc0000; font-weight: bold;',
    };
    return styles[level as keyof typeof styles] || styles.debug;
  }

  public trace(category: string, message: string, data?: any): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    console.trace(`[DEBUG:${category}] TRACE: ${message}`, data);
    this.log(category, `TRACE: ${message}`, { ...data, stack: new Error().stack }, 'debug');
  }

  public time(category: string, label: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const timerLabel = `debug_${category}_${label}`;
    console.time(timerLabel);
    performanceMonitor.mark(`${timerLabel}_start`);
    this.log(category, `Timer started: ${label}`, undefined, 'debug');
  }

  public timeEnd(category: string, label: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const timerLabel = `debug_${category}_${label}`;
    console.timeEnd(timerLabel);
    performanceMonitor.mark(`${timerLabel}_end`);
    performanceMonitor.measureUserTiming(timerLabel, `${timerLabel}_start`, `${timerLabel}_end`);
    this.log(category, `Timer ended: ${label}`, undefined, 'debug');
  }

  public dump(category: string, object: any, label?: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const message = label ? `Object dump: ${label}` : 'Object dump';
    console.group(`[DEBUG:${category}] ${message}`);
    console.dir(object);
    console.groupEnd();
    
    this.log(category, message, {
      type: typeof object,
      constructor: object?.constructor?.name,
      keys: typeof object === 'object' && object !== null ? Object.keys(object) : undefined,
      value: object,
    }, 'debug');
  }

  public assert(category: string, condition: boolean, message: string, data?: any): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    console.assert(condition, `[DEBUG:${category}] ${message}`, data);
    
    if (!condition) {
      this.log(category, `ASSERTION FAILED: ${message}`, data, 'error');
      errorHandler.handleError(
        new Error(`Debug assertion failed: ${message}`),
        { category, metadata: data },
        'medium'
      );
    }
  }

  private createDebugPanel(): void {
    if (this.debugPanel) return;

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'debug-panel';
    this.debugPanel.innerHTML = `
      <div class="debug-panel-header">
        <span>Debug Panel</span>
        <div class="debug-panel-controls">
          <button id="debug-clear">Clear</button>
          <button id="debug-export">Export</button>
          <button id="debug-toggle">Hide</button>
        </div>
      </div>
      <div class="debug-panel-categories">
        ${Array.from(this.categories).map(cat => `
          <label>
            <input type="checkbox" value="${cat}" ${this.enabledCategories.has(cat) ? 'checked' : ''}>
            ${cat}
          </label>
        `).join('')}
      </div>
      <div class="debug-panel-logs" id="debug-logs"></div>
    `;

    // Add styles
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 400px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      font-family: monospace;
      font-size: 12px;
      border-radius: 6px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // Add internal styles
    const style = document.createElement('style');
    style.textContent = `
      #debug-panel .debug-panel-header {
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 6px 6px 0 0;
      }
      
      #debug-panel .debug-panel-controls button {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 4px 8px;
        margin-left: 4px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      }
      
      #debug-panel .debug-panel-controls button:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      #debug-panel .debug-panel-categories {
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        max-height: 100px;
        overflow-y: auto;
      }
      
      #debug-panel .debug-panel-categories label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        cursor: pointer;
      }
      
      #debug-panel .debug-panel-logs {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        max-height: 400px;
      }
      
      #debug-panel .debug-log-entry {
        margin-bottom: 4px;
        padding: 4px;
        border-radius: 3px;
        word-break: break-word;
      }
      
      #debug-panel .debug-log-entry.debug { background: rgba(136, 136, 136, 0.1); }
      #debug-panel .debug-log-entry.info { background: rgba(0, 102, 204, 0.2); }
      #debug-panel .debug-log-entry.warn { background: rgba(255, 136, 0, 0.2); }
      #debug-panel .debug-log-entry.error { background: rgba(204, 0, 0, 0.2); }
      
      #debug-panel .debug-log-timestamp {
        color: #888;
        font-size: 10px;
      }
      
      #debug-panel .debug-log-category {
        color: #4CAF50;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);

    // Add event listeners
    this.debugPanel.querySelector('#debug-clear')?.addEventListener('click', () => this.clearLogs());
    this.debugPanel.querySelector('#debug-export')?.addEventListener('click', () => this.exportLogs());
    this.debugPanel.querySelector('#debug-toggle')?.addEventListener('click', () => this.togglePanel());

    // Category checkboxes
    this.debugPanel.querySelectorAll('.debug-panel-categories input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.enableCategory(target.value);
        } else {
          this.disableCategory(target.value);
        }
      });
    });

    document.body.appendChild(this.debugPanel);
    this.updateDebugPanel();
  }

  private updateDebugPanel(): void {
    if (!this.debugPanel) return;

    const logsContainer = this.debugPanel.querySelector('#debug-logs');
    if (!logsContainer) return;

    const recentLogs = this.debugLogs.slice(-50);
    logsContainer.innerHTML = recentLogs.map(log => `
      <div class="debug-log-entry ${log.level}">
        <span class="debug-log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
        <span class="debug-log-category">[${log.category}]</span>
        ${log.message}
        ${log.data ? `<pre>${JSON.stringify(log.data, null, 2)}</pre>` : ''}
      </div>
    `).join('');

    // Scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  private togglePanel(): void {
    if (!this.debugPanel) return;
    
    const isHidden = this.debugPanel.style.display === 'none';
    this.debugPanel.style.display = isHidden ? 'flex' : 'none';
    
    const toggleButton = this.debugPanel.querySelector('#debug-toggle');
    if (toggleButton) {
      toggleButton.textContent = isHidden ? 'Hide' : 'Show';
    }
  }

  private removeDebugPanel(): void {
    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }
  }

  public clearLogs(): void {
    this.debugLogs = [];
    this.updateDebugPanel();
    console.clear();
    this.log('debug', 'Debug logs cleared');
  }

  public exportLogs(): void {
    const logs = JSON.stringify(this.debugLogs, null, 2);
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.log('debug', 'Debug logs exported');
  }

  public getLogs(category?: string, limit?: number): FrontendDebugInfo[] {
    let logs = this.debugLogs;
    
    if (category) {
      logs = logs.filter(log => log.category === category);
    }
    
    if (limit) {
      logs = logs.slice(-limit);
    }
    
    return logs;
  }

  public getCategories(): string[] {
    return Array.from(this.categories);
  }

  public getEnabledCategories(): string[] {
    return Array.from(this.enabledCategories);
  }

  public isDebugEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const debugMode = FrontendDebugMode.getInstance();

// Convenience functions
export const debug = {
  log: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'debug'),
  info: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'info'),
  warn: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'warn'),
  error: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'error'),
  trace: (category: string, message: string, data?: any) => debugMode.trace(category, message, data),
  time: (category: string, label: string) => debugMode.time(category, label),
  timeEnd: (category: string, label: string) => debugMode.timeEnd(category, label),
  dump: (category: string, object: any, label?: string) => debugMode.dump(category, object, label),
  assert: (category: string, condition: boolean, message: string, data?: any) => debugMode.assert(category, condition, message, data),
};