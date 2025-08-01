import React, { useEffect, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { initializeAuth } from '../store/slices/authSlice';
import Layout from '../components/Layout';

// Lazy load components for code splitting
const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const Editor = React.lazy(() => import('../pages/Editor'));
const Login = React.lazy(() => import('../pages/Login'));
const Register = React.lazy(() => import('../pages/Register'));
const Profile = React.lazy(() => import('../pages/Profile'));

// Loading component for lazy loading
const LazyLoadingSpinner: React.FC = () => (
  <div className="loading-spinner loading-spinner--large">
    <div className="spinner"></div>
    <p className="loading-message">Loading...</p>
  </div>
);

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth);
  
  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitialized]);

  // Show loading while initializing
  if (!isInitialized || isLoading) {
    return <LazyLoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <Suspense fallback={<LazyLoadingSpinner />}>
      {children}
    </Suspense>
  );
};

// Public Route component (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth);
  
  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitialized]);

  // Show loading while initializing
  if (!isInitialized || isLoading) {
    return <LazyLoadingSpinner />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <Suspense fallback={<LazyLoadingSpinner />}>
      {children}
    </Suspense>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'editor',
        element: (
          <ProtectedRoute>
            <Editor />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);