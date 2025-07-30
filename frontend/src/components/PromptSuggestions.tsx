import React from 'react';
import { useAppSelector } from '../hooks/redux';

interface PromptSuggestionsProps {
  onSelect: (suggestion: string) => void;
}

const categoryIcons = {
  ui: '🎨',
  functionality: '⚙️',
  styling: '💅',
  data: '📊',
};

const categoryColors = {
  ui: '#3b82f6',
  functionality: '#10b981',
  styling: '#f59e0b',
  data: '#8b5cf6',
};

const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({ onSelect }) => {
  const { suggestions } = useAppSelector((state) => state.prompt);

  const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.category]) {
      acc[suggestion.category] = [];
    }
    acc[suggestion.category].push(suggestion);
    return acc;
  }, {} as Record<string, typeof suggestions>);

  return (
    <div className="prompt-suggestions">
      <div className="suggestions-header">
        <h4>💡 Suggestions</h4>
        <p>Click on any suggestion to use it as your prompt</p>
      </div>
      
      <div className="suggestions-grid">
        {Object.entries(groupedSuggestions).map(([category, categoryItems]) => (
          <div key={category} className="suggestion-category">
            <div 
              className="category-header"
              style={{ borderLeftColor: categoryColors[category as keyof typeof categoryColors] }}
            >
              <span className="category-icon">
                {categoryIcons[category as keyof typeof categoryIcons]}
              </span>
              <span className="category-name">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
            </div>
            
            <div className="category-items">
              {categoryItems.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className="suggestion-item"
                  onClick={() => onSelect(suggestion.text)}
                  title={`Click to use: ${suggestion.text}`}
                >
                  <span className="suggestion-text">{suggestion.text}</span>
                  <span className="suggestion-action">→</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="suggestions-footer">
        <p className="suggestions-tip">
          💡 <strong>Tip:</strong> Be specific about what you want to create or modify for better results
        </p>
      </div>
    </div>
  );
};

export default PromptSuggestions;