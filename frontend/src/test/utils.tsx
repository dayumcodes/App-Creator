import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import uiReducer from '../store/slices/uiSlice';
import projectReducer from '../store/slices/projectSlice';

// Create a test store
export const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      project: projectReducer,
    },
    preloadedState,
  });
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: ReturnType<typeof createTestStore>;
  initialEntries?: string[];
}

// Custom render function that includes providers
export const renderWithProviders = (
  ui: ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    initialEntries = ['/'],
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

// Mock API responses
export const mockApiResponse = (data: any, error?: string) => {
  return Promise.resolve({
    ok: !error,
    json: () => Promise.resolve(error ? { error: { message: error } } : data),
  });
};

// Mock successful login response
export const mockLoginSuccess = {
  user: {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
  },
  token: 'mock-jwt-token',
};

// Mock user data
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
};