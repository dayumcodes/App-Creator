import React, { useState, useEffect, useRef } from 'react';
import { usePreview } from '../hooks/usePreview';
import './LivePreview.css';

interface DeviceSize {
  name: string;
  width: number;
  height: number;
  icon: string;
}

const DEVICE_SIZES: DeviceSize[] = [
  { name: 'Desktop', width: 1200, height: 800, icon: '🖥️' },
  { name: 'Tablet', width: 768, height: 1024, icon: '📱' },
  { name: 'Mobile', width: 375, height: 667, icon: '📱' },
  { name: 'Custom', width: 800, height: 600, icon: '⚙️' },
];

interface ConsoleMessage {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

const LivePreview: React.FC = () => {
  const { isLoading, error, previewUrl, refresh, generateShareableUrl } = usePreview();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSize>(DEVICE_SIZES[0]);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [showConsole, setShowConsole] = useState(false);



  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'console') {
        const newMessage: ConsoleMessage = {
          id: Date.now().toString(),
          type: event.data.level,
          message: event.data.message,
          timestamp: new Date(event.data.timestamp),
        };
        setConsoleMessages(prev => [...prev, newMessage]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    refresh();
    setConsoleMessages([]);
  };

  const handleDeviceChange = (device: DeviceSize) => {
    setSelectedDevice(device);
  };

  const getPreviewDimensions = () => {
    if (selectedDevice.name === 'Custom') {
      return { width: customWidth, height: customHeight };
    }
    return { width: selectedDevice.width, height: selectedDevice.height };
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleShareUrl = async () => {
    try {
      const shareableUrl = await generateShareableUrl();
      if (shareableUrl) {
        await navigator.clipboard.writeText(shareableUrl);
        // You could show a toast notification here
        console.log('Preview URL copied to clipboard');
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const clearConsole = () => {
    setConsoleMessages([]);
  };

  const dimensions = getPreviewDimensions();

  return (
    <div className="live-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        <div className="preview-controls">
          <div className="device-selector">
            {DEVICE_SIZES.map((device) => (
              <button
                key={device.name}
                className={`device-btn ${selectedDevice.name === device.name ? 'active' : ''}`}
                onClick={() => handleDeviceChange(device)}
                title={device.name}
              >
                <span className="device-icon">{device.icon}</span>
                <span className="device-name">{device.name}</span>
              </button>
            ))}
          </div>
          
          {selectedDevice.name === 'Custom' && (
            <div className="custom-dimensions">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                placeholder="Width"
                min="200"
                max="2000"
              />
              <span>×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                placeholder="Height"
                min="200"
                max="2000"
              />
            </div>
          )}
          
          <div className="preview-actions">
            <button className="btn btn-small" onClick={handleRefresh} title="Refresh Preview">
              🔄
            </button>
            <button className="btn btn-small" onClick={handleOpenInNewTab} title="Open in New Tab">
              🔗
            </button>
            <button className="btn btn-small" onClick={handleShareUrl} title="Copy Preview URL">
              📋
            </button>
            <button 
              className={`btn btn-small ${showConsole ? 'active' : ''}`}
              onClick={() => setShowConsole(!showConsole)}
              title="Toggle Console"
            >
              🖥️
            </button>
          </div>
        </div>
      </div>

      <div className="preview-content">
        {error ? (
          <div className="preview-error">
            <div className="error-icon">⚠️</div>
            <h4>Preview Error</h4>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="preview-container">
            <div className="preview-frame-container" style={{ width: dimensions.width, height: dimensions.height }}>
              {isLoading && (
                <div className="preview-loading">
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                  </div>
                  <p>Loading preview...</p>
                </div>
              )}
              
              {previewUrl && (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="preview-iframe"
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    opacity: isLoading ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                  }}
                  onLoad={() => {
                    // Loading state is managed by the hook
                  }}
                />
              )}
            </div>
            
            <div className="preview-info">
              <span className="dimensions-info">
                {dimensions.width} × {dimensions.height}
              </span>
              {selectedDevice.name !== 'Custom' && (
                <span className="device-info">{selectedDevice.name}</span>
              )}
            </div>
          </div>
        )}

        {showConsole && (
          <div className="preview-console">
            <div className="console-header">
              <h4>Console</h4>
              <div className="console-controls">
                <button className="btn btn-small" onClick={clearConsole}>
                  Clear
                </button>
              </div>
            </div>
            <div className="console-content">
              {consoleMessages.length === 0 ? (
                <div className="console-empty">No console messages</div>
              ) : (
                consoleMessages.map((msg) => (
                  <div key={msg.id} className={`console-message console-${msg.type}`}>
                    <span className="console-timestamp">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="console-type">{msg.type.toUpperCase()}</span>
                    <span className="console-text">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePreview;