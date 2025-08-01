import React from 'react';
import { lazyLoad } from '../utils/lazyLoad';

// Lazy load Monaco Editor with custom fallback
const MonacoEditorFallback: React.FC = () => (
  <div className="editor-loading">
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p className="loading-message">Loading code editor...</p>
    </div>
  </div>
);

// Lazy load the Monaco Editor component
export const LazyMonacoEditor = lazyLoad(
  () => import('./MonacoEditor'),
  { 
    fallback: MonacoEditorFallback,
    delay: 100 // Small delay to prevent flash
  }
);

export default LazyMonacoEditor;