import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { registerUser, clearError } from '../store/slices/authSlice';
import { validateRegisterForm, type ValidationError } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';

const Register: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useAppSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateRegisterForm(
      formData.username,
      formData.email,
      formData.password,
      formData.confirmPassword
    );
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setTouched({
        username: true,
        email: true,
        password: true,
        confirmPassword: true,
      });
      return;
    }

    setValidationErrors([]);
    dispatch(registerUser({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear validation errors for this field when user starts typing
    if (touched[name]) {
      setValidationErrors(prev => prev.filter(err => err.field !== name));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate individual field on blur
    const validation = validateRegisterForm(
      formData.username,
      formData.email,
      formData.password,
      formData.confirmPassword
    );
    const fieldErrors = validation.errors.filter(err => err.field === name);
    
    setValidationErrors(prev => [
      ...prev.filter(err => err.field !== name),
      ...fieldErrors
    ]);
  };

  const getFieldError = (fieldName: string): string | undefined => {
    return validationErrors.find(err => err.field === fieldName)?.message;
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join us and start building amazing applications</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              className={getFieldError('username') ? 'error' : ''}
              aria-describedby={getFieldError('username') ? 'username-error' : undefined}
            />
            {getFieldError('username') && (
              <div id="username-error" className="field-error">
                {getFieldError('username')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              className={getFieldError('email') ? 'error' : ''}
              aria-describedby={getFieldError('email') ? 'email-error' : undefined}
            />
            {getFieldError('email') && (
              <div id="email-error" className="field-error">
                {getFieldError('email')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              className={getFieldError('password') ? 'error' : ''}
              aria-describedby={getFieldError('password') ? 'password-error' : undefined}
            />
            {getFieldError('password') && (
              <div id="password-error" className="field-error">
                {getFieldError('password')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              className={getFieldError('confirmPassword') ? 'error' : ''}
              aria-describedby={getFieldError('confirmPassword') ? 'confirmPassword-error' : undefined}
            />
            {getFieldError('confirmPassword') && (
              <div id="confirmPassword-error" className="field-error">
                {getFieldError('confirmPassword')}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="small" message="" /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;