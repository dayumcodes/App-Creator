import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockUser } from '../../test/utils';
import Profile from '../Profile';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    updateProfile: vi.fn(),
  },
}));

describe('Profile Component', () => {
  const authenticatedState = {
    auth: {
      user: mockUser,
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      isInitialized: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile form correctly', () => {
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your account information and preferences')).toBeInTheDocument();
    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('populates form with user data', () => {
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    
    expect(usernameInput.value).toBe(mockUser.username);
    expect(emailInput.value).toBe(mockUser.email);
  });

  it('shows password fields when "Change Password" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    const changePasswordButton = screen.getByRole('button', { name: 'Change Password' });
    await user.click(changePasswordButton);
    
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Password Change' })).toBeInTheDocument();
  });

  it('hides password fields when "Cancel Password Change" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    // Show password fields
    const changePasswordButton = screen.getByRole('button', { name: 'Change Password' });
    await user.click(changePasswordButton);
    
    // Hide password fields
    const cancelButton = screen.getByRole('button', { name: 'Cancel Password Change' });
    await user.click(cancelButton);
    
    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm New Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('shows validation errors for invalid data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    
    // Clear fields to trigger validation
    await user.clear(usernameInput);
    await user.clear(emailInput);
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('validates password fields when changing password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    // Show password fields
    const changePasswordButton = screen.getByRole('button', { name: 'Change Password' });
    await user.click(changePasswordButton);
    
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmNewPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    
    await user.type(newPasswordInput, 'newpass');
    await user.type(confirmNewPasswordInput, 'differentpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Current password is required to change password')).toBeInTheDocument();
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('submits profile update successfully', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock successful API response
    const updatedUser = { ...mockUser, username: 'newusername' };
    vi.mocked(apiService.updateProfile).mockResolvedValue({
      data: updatedUser,
    });
    
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    
    await user.clear(usernameInput);
    await user.type(usernameInput, 'newusername');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(apiService.updateProfile).toHaveBeenCalledWith({
        username: 'newusername',
        email: mockUser.email,
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });

  it('submits password change successfully', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock successful API response
    vi.mocked(apiService.updateProfile).mockResolvedValue({
      data: mockUser,
    });
    
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    // Show password fields
    const changePasswordButton = screen.getByRole('button', { name: 'Change Password' });
    await user.click(changePasswordButton);
    
    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmNewPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    
    await user.type(currentPasswordInput, 'currentpass');
    await user.type(newPasswordInput, 'newpassword123');
    await user.type(confirmNewPasswordInput, 'newpassword123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(apiService.updateProfile).toHaveBeenCalledWith({
        username: mockUser.username,
        email: mockUser.email,
        currentPassword: 'currentpass',
        newPassword: 'newpassword123',
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });

  it('shows error message on update failure', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock API error response
    vi.mocked(apiService.updateProfile).mockResolvedValue({
      error: 'Current password is incorrect',
    });
    
    renderWithProviders(<Profile />, { preloadedState: authenticatedState });
    
    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
    });
  });

  it('shows error when user is not found', () => {
    const unauthenticatedState = {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isInitialized: true,
      },
    };
    
    renderWithProviders(<Profile />, { preloadedState: unauthenticatedState });
    
    expect(screen.getByText('User not found. Please log in again.')).toBeInTheDocument();
  });
});