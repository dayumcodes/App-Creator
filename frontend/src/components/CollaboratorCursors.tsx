import React, { useEffect, useState } from 'react';
import { CollaboratorPresence } from '../hooks/useCollaboration';
import './CollaboratorCursors.css';

interface CollaboratorCursorsProps {
  collaboratorPresence: CollaboratorPresence[];
  currentUserId?: string;
  editorContainer?: HTMLElement | null;
}

interface CursorPosition {
  x: number;
  y: number;
  visible: boolean;
}

export const CollaboratorCursors: React.FC<CollaboratorCursorsProps> = ({
  collaboratorPresence,
  currentUserId,
  editorContainer,
}) => {
  const [cursorPositions, setCursorPositions] = useState<Map<string, CursorPosition>>(new Map());

  // Filter out current user and inactive collaborators
  const activeCursors = collaboratorPresence.filter(
    presence => 
      presence.userId !== currentUserId && 
      presence.status === 'active' && 
      presence.cursor
  );

  useEffect(() => {
    if (!editorContainer) return;

    const updateCursorPositions = () => {
      const newPositions = new Map<string, CursorPosition>();

      activeCursors.forEach(presence => {
        if (!presence.cursor) return;

        try {
          // This is a simplified cursor position calculation
          // In a real implementation, you'd need to integrate with Monaco Editor's API
          // to convert line/column positions to pixel coordinates
          
          const { line, column } = presence.cursor;
          const lineHeight = 18; // Monaco's default line height
          const charWidth = 7.2; // Approximate character width
          
          // Calculate position relative to editor
          const x = column * charWidth;
          const y = line * lineHeight;
          
          // Check if position is within visible area
          const editorRect = editorContainer.getBoundingClientRect();
          const visible = x >= 0 && y >= 0 && 
                          x <= editorRect.width && 
                          y <= editorRect.height;

          newPositions.set(presence.sessionId, {
            x: Math.max(0, Math.min(x, editorRect.width - 20)),
            y: Math.max(0, Math.min(y, editorRect.height - 20)),
            visible,
          });
        } catch (error) {
          console.warn('Error calculating cursor position:', error);
        }
      });

      setCursorPositions(newPositions);
    };

    updateCursorPositions();

    // Update positions when editor scrolls or resizes
    const handleScroll = () => updateCursorPositions();
    const handleResize = () => updateCursorPositions();

    editorContainer.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      editorContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeCursors, editorContainer]);

  if (!editorContainer || activeCursors.length === 0) {
    return null;
  }

  const getUserColor = (userId: string): string => {
    // Generate consistent colors for users
    const colors = [
      '#e53e3e', '#dd6b20', '#d69e2e', '#38a169',
      '#319795', '#3182ce', '#553c9a', '#b83280'
    ];
    
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="collaborator-cursors">
      {activeCursors.map(presence => {
        const position = cursorPositions.get(presence.sessionId);
        if (!position || !position.visible) return null;

        const color = getUserColor(presence.userId);

        return (
          <div
            key={presence.sessionId}
            className="collaborator-cursor"
            style={{
              left: position.x,
              top: position.y,
              borderColor: color,
            }}
          >
            <div 
              className="cursor-line"
              style={{ backgroundColor: color }}
            />
            <div 
              className="cursor-label"
              style={{ backgroundColor: color }}
            >
              {presence.username}
            </div>
            {presence.cursor?.selection && (
              <div
                className="cursor-selection"
                style={{
                  backgroundColor: `${color}20`,
                  borderColor: color,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};