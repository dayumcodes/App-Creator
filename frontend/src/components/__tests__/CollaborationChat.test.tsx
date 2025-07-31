import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CollaborationChat } from '../CollaborationChat';
import { ChatMessage } from '../../services/collaborationApi';

describe('CollaborationChat', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      message: 'Hello team!',
      timestamp: '2023-01-01T10:00:00Z',
      user: {
        id: 'user-1',
        username: 'alice',
      },
      isEdited: false,
    },
    {
      id: 'msg-2',
      message: 'How is everyone doing?',
      timestamp: '2023-01-01T10:05:00Z',
      user: {
        id: 'user-2',
        username: 'bob',
      },
      isEdited: false,
    },
    {
      id: 'msg-3',
      message: 'Great! Working on the new feature.',
      timestamp: '2023-01-01T10:10:00Z',
      user: {
        id: 'user-1',
        username: 'alice',
      },
      isEdited: true,
      editedAt: '2023-01-01T10:11:00Z',
    },
  ];

  const defaultProps = {
    messages: mockMessages,
    onSendMessage: vi.fn(),
    currentUserId: 'user-1',
    isConnected: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render in collapsed state initially', () => {
    render(<CollaborationChat {...defaultProps} />);

    expect(screen.getByText('💬 Chat')).toBeInTheDocument();
    expect(screen.queryByText('Project Chat')).not.toBeInTheDocument();
  });

  it('should expand when chat toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('Project Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('should show unread badge when there are recent messages from others', () => {
    const recentMessages = [
      ...mockMessages,
      {
        id: 'msg-4',
        message: 'New message',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        user: {
          id: 'user-2',
          username: 'bob',
        },
        isEdited: false,
      },
    ];

    render(<CollaborationChat {...defaultProps} messages={recentMessages} />);

    expect(screen.getByText('1')).toBeInTheDocument(); // Unread badge
  });

  it('should render messages when expanded', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('Hello team!')).toBeInTheDocument();
    expect(screen.getByText('How is everyone doing?')).toBeInTheDocument();
    expect(screen.getByText('Great! Working on the new feature.')).toBeInTheDocument();
  });

  it('should show usernames for other users messages', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getAllByText('bob')).toHaveLength(1);
    // Alice's messages should not show username since she's the current user
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });

  it('should show edited indicator for edited messages', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('should group messages by date', async () => {
    const messagesWithDifferentDates = [
      {
        ...mockMessages[0],
        timestamp: '2023-01-01T10:00:00Z',
      },
      {
        ...mockMessages[1],
        timestamp: '2023-01-02T10:00:00Z',
      },
    ];

    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} messages={messagesWithDifferentDates} />);

    await user.click(screen.getByText('💬 Chat'));

    // Should show date separators
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should send message when form is submitted', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();
    
    render(<CollaborationChat {...defaultProps} onSendMessage={mockSendMessage} />);

    await user.click(screen.getByText('💬 Chat'));
    
    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'New message');
    await user.click(screen.getByText('Send'));

    expect(mockSendMessage).toHaveBeenCalledWith('New message');
    expect(input).toHaveValue(''); // Input should be cleared
  });

  it('should send message when Enter is pressed', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();
    
    render(<CollaborationChat {...defaultProps} onSendMessage={mockSendMessage} />);

    await user.click(screen.getByText('💬 Chat'));
    
    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'New message{enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('New message');
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();
    
    render(<CollaborationChat {...defaultProps} onSendMessage={mockSendMessage} />);

    await user.click(screen.getByText('💬 Chat'));
    await user.click(screen.getByText('Send'));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should not send messages when disconnected', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();
    
    render(<CollaborationChat {...defaultProps} onSendMessage={mockSendMessage} isConnected={false} />);

    await user.click(screen.getByText('💬 Chat'));
    
    const input = screen.getByPlaceholderText('Connecting...');
    const sendButton = screen.getByText('Send');
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should show connection status', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('🟢')).toBeInTheDocument(); // Connected indicator
  });

  it('should show disconnected status', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} isConnected={false} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('🔴')).toBeInTheDocument(); // Disconnected indicator
  });

  it('should minimize when minimize button is clicked', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));
    expect(screen.getByText('Project Chat')).toBeInTheDocument();

    await user.click(screen.getByText('─'));
    expect(screen.queryByText('Project Chat')).not.toBeInTheDocument();
    expect(screen.getByText('💬 Chat')).toBeInTheDocument();
  });

  it('should show empty state when no messages', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} messages={[]} />);

    await user.click(screen.getByText('💬 Chat'));

    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation with your team!')).toBeInTheDocument();
  });

  it('should format timestamps correctly', async () => {
    const user = userEvent.setup();
    const messageWithSpecificTime = [
      {
        id: 'msg-1',
        message: 'Test message',
        timestamp: '2023-01-01T14:30:00Z',
        user: { id: 'user-2', username: 'bob' },
        isEdited: false,
      },
    ];

    render(<CollaborationChat {...defaultProps} messages={messageWithSpecificTime} />);

    await user.click(screen.getByText('💬 Chat'));

    // Should show formatted time (this will depend on locale)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('should handle message length limit', async () => {
    const user = userEvent.setup();
    render(<CollaborationChat {...defaultProps} />);

    await user.click(screen.getByText('💬 Chat'));
    
    const input = screen.getByPlaceholderText('Type a message...');
    expect(input).toHaveAttribute('maxLength', '500');
  });
});