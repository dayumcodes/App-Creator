import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CollaboratorList } from '../CollaboratorList';
import { Collaborator } from '../../services/collaborationApi';
import { CollaboratorPresence } from '../../hooks/useCollaboration';

describe('CollaboratorList', () => {
  const mockCollaborators: Collaborator[] = [
    {
      id: 'collab-1',
      user: {
        id: 'user-1',
        username: 'owner',
        email: 'owner@example.com',
      },
      role: 'OWNER',
      invitedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    },
    {
      id: 'collab-2',
      user: {
        id: 'user-2',
        username: 'editor',
        email: 'editor@example.com',
      },
      role: 'EDITOR',
      invitedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    },
  ];

  const mockCollaboratorPresence: CollaboratorPresence[] = [
    {
      sessionId: 'session-1',
      userId: 'user-1',
      username: 'owner',
      status: 'active',
      lastSeen: '2023-01-01T00:00:00Z',
    },
    {
      sessionId: 'session-2',
      userId: 'user-2',
      username: 'editor',
      status: 'idle',
      lastSeen: '2023-01-01T00:00:00Z',
    },
  ];

  const defaultProps = {
    collaborators: mockCollaborators,
    collaboratorPresence: mockCollaboratorPresence,
    userRole: 'OWNER' as const,
    onInviteCollaborator: vi.fn(),
    onRemoveCollaborator: vi.fn(),
    onUpdateRole: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render collaborators list', () => {
    render(<CollaboratorList {...defaultProps} />);

    expect(screen.getByText('Collaborators (2)')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('editor@example.com')).toBeInTheDocument();
  });

  it('should show presence indicators', () => {
    render(<CollaboratorList {...defaultProps} />);

    // Check for presence indicators (emojis)
    expect(screen.getByText('🟢')).toBeInTheDocument(); // active
    expect(screen.getByText('🟡')).toBeInTheDocument(); // idle
  });

  it('should show online badges for active users', () => {
    render(<CollaboratorList {...defaultProps} />);

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('should show invite button for owners', () => {
    render(<CollaboratorList {...defaultProps} />);

    expect(screen.getByText('+ Invite')).toBeInTheDocument();
  });

  it('should not show invite button for non-owners', () => {
    render(<CollaboratorList {...defaultProps} userRole="EDITOR" />);

    expect(screen.queryByText('+ Invite')).not.toBeInTheDocument();
  });

  it('should show invite form when invite button is clicked', async () => {
    const user = userEvent.setup();
    render(<CollaboratorList {...defaultProps} />);

    await user.click(screen.getByText('+ Invite'));

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viewer')).toBeInTheDocument();
    expect(screen.getByText('Send Invite')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should invite collaborator when form is submitted', async () => {
    const user = userEvent.setup();
    const mockInvite = vi.fn().mockResolvedValue({});
    
    render(<CollaboratorList {...defaultProps} onInviteCollaborator={mockInvite} />);

    await user.click(screen.getByText('+ Invite'));
    await user.type(screen.getByPlaceholderText('Email address'), 'new@example.com');
    await user.selectOptions(screen.getByDisplayValue('Viewer'), 'EDITOR');
    await user.click(screen.getByText('Send Invite'));

    await waitFor(() => {
      expect(mockInvite).toHaveBeenCalledWith('new@example.com', 'EDITOR');
    });
  });

  it('should cancel invite form', async () => {
    const user = userEvent.setup();
    render(<CollaboratorList {...defaultProps} />);

    await user.click(screen.getByText('+ Invite'));
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Email address')).not.toBeInTheDocument();
  });

  it('should update collaborator role', async () => {
    const user = userEvent.setup();
    const mockUpdateRole = vi.fn().mockResolvedValue({});
    
    render(<CollaboratorList {...defaultProps} onUpdateRole={mockUpdateRole} />);

    const roleSelect = screen.getAllByDisplayValue('EDITOR')[0];
    await user.selectOptions(roleSelect, 'VIEWER');

    await waitFor(() => {
      expect(mockUpdateRole).toHaveBeenCalledWith('collab-2', 'VIEWER');
    });
  });

  it('should remove collaborator with confirmation', async () => {
    const user = userEvent.setup();
    const mockRemove = vi.fn().mockResolvedValue({});
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(true);
    
    render(<CollaboratorList {...defaultProps} onRemoveCollaborator={mockRemove} />);

    const removeButtons = screen.getAllByText('×');
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('collab-2');
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should not remove collaborator if confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const mockRemove = vi.fn();
    
    // Mock window.confirm to return false
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(false);
    
    render(<CollaboratorList {...defaultProps} onRemoveCollaborator={mockRemove} />);

    const removeButtons = screen.getAllByText('×');
    await user.click(removeButtons[0]);

    expect(mockRemove).not.toHaveBeenCalled();

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should show role badges for non-owners when user cannot manage', () => {
    render(<CollaboratorList {...defaultProps} userRole="EDITOR" />);

    expect(screen.getByText('OWNER')).toBeInTheDocument();
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
  });

  it('should show empty state when no collaborators', () => {
    render(<CollaboratorList {...defaultProps} collaborators={[]} />);

    expect(screen.getByText('No collaborators yet.')).toBeInTheDocument();
    expect(screen.getByText('Invite team members to start collaborating!')).toBeInTheDocument();
  });

  it('should not show management options for owner role', () => {
    const collaboratorsWithOwner = [
      {
        ...mockCollaborators[0],
        role: 'OWNER' as const,
      },
    ];

    render(<CollaboratorList {...defaultProps} collaborators={collaboratorsWithOwner} />);

    // Owner should not have remove button or role select
    expect(screen.queryByText('×')).not.toBeInTheDocument();
    expect(screen.getByText('OWNER')).toBeInTheDocument();
  });

  it('should handle invite form validation', async () => {
    const user = userEvent.setup();
    const mockInvite = vi.fn();
    
    render(<CollaboratorList {...defaultProps} onInviteCollaborator={mockInvite} />);

    await user.click(screen.getByText('+ Invite'));
    await user.click(screen.getByText('Send Invite'));

    // Should not call invite with empty email
    expect(mockInvite).not.toHaveBeenCalled();
  });
});