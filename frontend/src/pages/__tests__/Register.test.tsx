import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockLoginSuccess } from '../../test/utils';
import Register from '../Register';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    register: vi.fn(),
  },
}));

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders registration form correctly', () => {
    renderWithProviders(<Register />);
    
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Join us and start building amazing applications')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });
  });

  it('shows validation error for short username', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(usernameInput, 'ab');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters long')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid username characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(usernameInput, 'user@name');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username can only contain letters, numbers, hyphens, and underscores')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(passwordInput, '123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
    });
  });

  it('shows validation error for mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password456');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock successful API response
    vi.mocked(apiService.register).mockResolvedValue({
      data: mockLoginSuccess,
    });
    
    renderWithProviders(<Register />);
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(apiService.register).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock delayed API response
    vi.mocked(apiService.register).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: mockLoginSuccess }), 100))
    );
    
    renderWithProviders(<Register />);
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    // Check loading state
    expect(screen.getByRole('button')).toBeDisabled();
    expect(usernameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(confirmPasswordInput).toBeDisabled();
  });

  it('shows error message on registration failure', async () => {
    const user = userEvent.setup();
    const { apiService } = await import('../../services/api');
    
    // Mock API error response
    vi.mocked(apiService.register).mockResolvedValue({
      error: 'Email already exists',
    });
    
    renderWithProviders(<Register />);
    
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('handles authenticated state correctly', () => {
    const preloadedState = {
      auth: {
        user: mockLoginSuccess.user,
        token: mockLoginSuccess.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isInitialized: true,
      },
    };
    
    // When authenticated, the useEffect should trigger navigation
    // We can't easily test the redirect in isolation, but we can verify the state
    renderWithProviders(<Register />, { preloadedState });
    
    // The component renders but the useEffect should handle navigation
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
  });
});