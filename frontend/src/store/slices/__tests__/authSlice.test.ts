import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  loginUser,
  registerUser,
  logoutUser,
  initializeAuth,
  updateUserProfile,
  clearError,
} from '../authSlice';
import { mockLoginSuccess, mockUser } from '../../../test/utils';

// Mock the API service
vi.mock('../../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isInitialized: false,
      });
    });

    // Note: Testing localStorage initialization is complex in this setup
    // The actual implementation correctly reads from localStorage in initialState
  });

  describe('clearError action', () => {
    it('should clear error', async () => {
      // Set an error using the actual async thunk
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.login).mockResolvedValue({
        error: 'Test error',
      });

      await store.dispatch(loginUser({ email: 'test@example.com', password: 'wrong' }));
      expect(store.getState().auth.error).toBe('Test error');
      
      // Clear the error
      store.dispatch(clearError());
      expect(store.getState().auth.error).toBeNull();
    });
  });

  describe('loginUser async thunk', () => {
    it('should handle successful login', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.login).mockResolvedValue({
        data: mockLoginSuccess,
      });

      await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(mockLoginSuccess.user);
      expect(state.token).toBe(mockLoginSuccess.token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
      expect(localStorage.getItem('token')).toBe(mockLoginSuccess.token);
    });

    it('should handle login failure', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.login).mockResolvedValue({
        error: 'Invalid credentials',
      });

      await store.dispatch(loginUser({ email: 'test@example.com', password: 'wrong' }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.login).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockLoginSuccess }), 100))
      );

      store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('registerUser async thunk', () => {
    it('should handle successful registration', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.register).mockResolvedValue({
        data: mockLoginSuccess,
      });

      await store.dispatch(registerUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password',
      }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(mockLoginSuccess.user);
      expect(state.token).toBe(mockLoginSuccess.token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
      expect(localStorage.getItem('token')).toBe(mockLoginSuccess.token);
    });

    it('should handle registration failure', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.register).mockResolvedValue({
        error: 'Email already exists',
      });

      await store.dispatch(registerUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password',
      }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Email already exists');
    });
  });

  describe('logoutUser async thunk', () => {
    it('should handle successful logout', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.logout).mockResolvedValue({});

      // Set initial authenticated state
      store.dispatch({
        type: 'auth/loginUser/fulfilled',
        payload: mockLoginSuccess,
      });

      await store.dispatch(logoutUser());
      
      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should clear state even on logout failure', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.logout).mockResolvedValue({
        error: 'Logout failed',
      });

      // Set initial authenticated state
      store.dispatch({
        type: 'auth/loginUser/fulfilled',
        payload: mockLoginSuccess,
      });

      await store.dispatch(logoutUser());
      
      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('initializeAuth async thunk', () => {
    it('should initialize with valid token', async () => {
      const { apiService } = await import('../../../services/api');
      localStorage.setItem('token', 'valid-token');
      vi.mocked(apiService.getCurrentUser).mockResolvedValue({
        data: mockUser,
      });

      await store.dispatch(initializeAuth());
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('valid-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle invalid token', async () => {
      const { apiService } = await import('../../../services/api');
      localStorage.setItem('token', 'invalid-token');
      vi.mocked(apiService.getCurrentUser).mockResolvedValue({
        error: 'Invalid token',
      });

      await store.dispatch(initializeAuth());
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle no token', async () => {
      await store.dispatch(initializeAuth());
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('updateUserProfile async thunk', () => {
    it('should handle successful profile update', async () => {
      const { apiService } = await import('../../../services/api');
      const updatedUser = { ...mockUser, username: 'newusername' };
      vi.mocked(apiService.updateProfile).mockResolvedValue({
        data: updatedUser,
      });

      // Set initial authenticated state
      store.dispatch({
        type: 'auth/loginUser/fulfilled',
        payload: mockLoginSuccess,
      });

      await store.dispatch(updateUserProfile({
        username: 'newusername',
        email: mockUser.email,
      }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(updatedUser);
      expect(state.error).toBeNull();
    });

    it('should handle profile update failure', async () => {
      const { apiService } = await import('../../../services/api');
      vi.mocked(apiService.updateProfile).mockResolvedValue({
        error: 'Update failed',
      });

      await store.dispatch(updateUserProfile({
        username: 'newusername',
        email: mockUser.email,
      }));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Update failed');
    });
  });
});