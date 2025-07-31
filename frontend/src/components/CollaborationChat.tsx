import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../services/collaborationApi';
import './CollaborationChat.css';

interface CollaborationChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId?: string;
  isConnected: boolean;
}

export const CollaborationChat: React.FC<CollaborationChatProps> = ({
  messages,
  onSendMessage,
  currentUserId,
  isConnected,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom();
    }
  }, [messages, isExpanded]);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    onSendMessage(newMessage.trim());
    setNewMessage('');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.timestamp).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return Object.entries(groups).map(([dateKey, messages]) => ({
      date: dateKey,
      messages,
    }));
  };

  const messageGroups = groupMessagesByDate(messages);
  const unreadCount = messages.filter(m => 
    m.user.id !== currentUserId && 
    new Date(m.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
  ).length;

  if (!isExpanded) {
    return (
      <div className="chat-collapsed">
        <button
          className="chat-toggle"
          onClick={() => setIsExpanded(true)}
        >
          💬 Chat
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="collaboration-chat">
      <div className="chat-header">
        <h3>Project Chat</h3>
        <div className="chat-actions">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <button
            className="chat-minimize"
            onClick={() => setIsExpanded(false)}
          >
            ─
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messageGroups.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet.</p>
            <p>Start a conversation with your team!</p>
          </div>
        ) : (
          messageGroups.map(({ date, messages }) => (
            <div key={date} className="message-group">
              <div className="date-separator">
                <span>{formatDate(date)}</span>
              </div>
              {messages.map((message) => {
                const isOwnMessage = message.user.id === currentUserId;
                
                return (
                  <div
                    key={message.id}
                    className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}
                  >
                    {!isOwnMessage && (
                      <div className="message-avatar">
                        {message.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="message-content">
                      {!isOwnMessage && (
                        <div className="message-author">
                          {message.user.username}
                        </div>
                      )}
                      <div className="message-text">
                        {message.message}
                        {message.isEdited && (
                          <span className="edited-indicator">(edited)</span>
                        )}
                      </div>
                      <div className="message-time">
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="send-button"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};