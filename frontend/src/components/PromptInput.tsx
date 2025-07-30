import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { 
  setCurrentPrompt, 
  setGenerating, 
  setStreaming, 
  appendStreamingContent,
  setStreamingContent,
  addToHistory,
  setError,
  clearError,
  setTypingIndicator,
  clearPrompt
} from '../store/slices/promptSlice';
import { updateProject } from '../store/slices/projectSlice';
import { addNotification } from '../store/slices/uiSlice';
import { apiService } from '../services/api';
import PromptSuggestions from './PromptSuggestions';
import PromptHistory from './PromptHistory';

const PromptInput: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentProject } = useAppSelector((state) => state.project);
  const { 
    currentPrompt, 
    isGenerating, 
    isStreaming, 
    streamingContent, 
    error, 
    typingIndicator 
  } = useAppSelector((state) => state.prompt);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [currentPrompt]);

  useEffect(() => {
    // Clear error after 5 seconds
    if (error) {
      const timeout = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, dispatch]);

  const handlePromptChange = (value: string) => {
    dispatch(setCurrentPrompt(value));
    
    // Show typing indicator
    dispatch(setTypingIndicator(true));
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Hide typing indicator after 1 second of no typing
    typingTimeoutRef.current = setTimeout(() => {
      dispatch(setTypingIndicator(false));
    }, 1000);

    // Show suggestions when typing
    setShowSuggestions(value.length > 0 && value.length < 10);
  };

  const handleSubmit = async () => {
    if (!currentProject || !currentPrompt.trim() || isGenerating) {
      return;
    }

    const prompt = currentPrompt.trim();
    dispatch(setGenerating(true));
    dispatch(clearError());
    dispatch(clearPrompt());

    try {
      // Check if streaming is supported
      const supportsStreaming = 'ReadableStream' in window;
      
      if (supportsStreaming) {
        dispatch(setStreaming(true));
        dispatch(setStreamingContent(''));

        await apiService.generateCodeStream(
          currentProject.id,
          prompt,
          (chunk: string) => {
            dispatch(appendStreamingContent(chunk));
          },
          (result: any) => {
            dispatch(setStreaming(false));
            
            // Update project with new files
            if (result.files) {
              const updatedProject = {
                ...currentProject,
                files: result.files,
                updatedAt: new Date().toISOString(),
              };
              dispatch(updateProject(updatedProject));
            }

            // Add to history
            if (result.promptHistory) {
              dispatch(addToHistory(result.promptHistory));
            }

            dispatch(addNotification({
              type: 'success',
              message: 'Code generated successfully!',
            }));
          },
          (error: string) => {
            dispatch(setError(error));
            dispatch(addNotification({
              type: 'error',
              message: error,
            }));
          }
        );
      } else {
        // Fallback to regular API call
        const response = await apiService.generateCode(currentProject.id, prompt);
        
        if (response.error) {
          dispatch(setError(response.error));
          dispatch(addNotification({
            type: 'error',
            message: response.error,
          }));
        } else if (response.data) {
          // Update project with new files
          if (response.data.files) {
            const updatedProject = {
              ...currentProject,
              files: response.data.files,
              updatedAt: new Date().toISOString(),
            };
            dispatch(updateProject(updatedProject));
          }

          // Add to history
          if (response.data.promptHistory) {
            dispatch(addToHistory(response.data.promptHistory));
          }

          dispatch(addNotification({
            type: 'success',
            message: 'Code generated successfully!',
          }));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate code';
      dispatch(setError(errorMessage));
      dispatch(addNotification({
        type: 'error',
        message: errorMessage,
      }));
    } finally {
      dispatch(setGenerating(false));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    dispatch(setCurrentPrompt(suggestion));
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleHistorySelect = (prompt: string) => {
    dispatch(setCurrentPrompt(prompt));
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  if (!currentProject) {
    return (
      <div className="prompt-input-container">
        <div className="prompt-empty-state">
          <div className="empty-icon">🤖</div>
          <p>Select a project to start generating code with AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-input-container">
      <div className="prompt-header">
        <h3>AI Assistant</h3>
        <div className="prompt-controls">
          <button
            className={`btn btn-small ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            title="Show prompt history"
          >
            📝 History
          </button>
          <button
            className={`btn btn-small ${showSuggestions ? 'active' : ''}`}
            onClick={() => setShowSuggestions(!showSuggestions)}
            title="Show suggestions"
          >
            💡 Suggestions
          </button>
        </div>
      </div>

      {error && (
        <div className="prompt-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-close"
            onClick={() => dispatch(clearError())}
          >
            ×
          </button>
        </div>
      )}

      {showSuggestions && (
        <PromptSuggestions onSelect={handleSuggestionSelect} />
      )}

      {showHistory && (
        <PromptHistory onSelect={handleHistorySelect} />
      )}

      <div className="prompt-input-wrapper">
        <div className="prompt-input">
          <textarea
            ref={textareaRef}
            value={currentPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build or modify... (Ctrl+Enter to submit)"
            disabled={isGenerating}
            className={`prompt-textarea ${isGenerating ? 'generating' : ''}`}
            rows={3}
          />
          
          {typingIndicator && (
            <div className="typing-indicator">
              <span className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>

        <div className="prompt-actions">
          <div className="prompt-info">
            {isStreaming && (
              <span className="streaming-indicator">
                🔄 Generating...
              </span>
            )}
            {!isGenerating && (
              <span className="shortcut-hint">
                Ctrl+Enter to submit
              </span>
            )}
          </div>
          
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!currentPrompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="loading-spinner"></span>
                {isStreaming ? 'Generating...' : 'Processing...'}
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>

      {isStreaming && streamingContent && (
        <div className="streaming-preview">
          <div className="streaming-header">
            <h4>Live Generation</h4>
            <div className="streaming-status">
              <span className="streaming-dot"></span>
              Streaming...
            </div>
          </div>
          <div className="streaming-content">
            <pre>{streamingContent}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptInput;