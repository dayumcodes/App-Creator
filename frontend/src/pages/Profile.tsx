import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { updateUserProfile, clearError } from '../store/slices/authSlice';
import { validateProfileForm, type ValidationError } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isLoading, error } = useAppSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username,
        email: user.email,
      }));
    }
  }, [user]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateProfileForm(
      formData.username,
      formData.email,
      formData.currentPassword,
      formData.newPassword,
      formData.confirmNewPassword
    );
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setTouched({
        username: true,
        email: true,
        currentPassword: true,
        newPassword: true,
        confirmNewPassword: true,
      });
      return;
    }

    setValidationErrors([]);
    
    const updateData: any = {
      username: formData.username,
      email: formData.email,
    };

    // Only include password fields if changing password
    if (formData.newPassword) {
      updateData.currentPassword = formData.currentPassword;
      updateData.newPassword = formData.newPassword;
    }

    try {
      await dispatch(updateUserProfile(updateData)).unwrap();
      setSuccessMessage('Profile updated successfully!');
      
      // Reset password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      setShowPasswordFields(false);
    } catch (error) {
      // Error is handled by the reducer
    }
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

    // Clear success message when user starts editing
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate individual field on blur
    const validation = validateProfileForm(
      formData.username,
      formData.email,
      formData.currentPassword,
      formData.newPassword,
      formData.confirmNewPassword
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

  const togglePasswordFields = () => {
    setShowPasswordFields(!showPasswordFields);
    if (!showPasswordFields) {
      // Clear password fields when hiding
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      // Clear password-related errors
      setValidationErrors(prev => 
        prev.filter(err => !['currentPassword', 'newPassword', 'confirmNewPassword'].includes(err.field))
      );
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="error-message">
            User not found. Please log in again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>Profile Settings</h1>
          <p>Manage your account information and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="profile-form" noValidate>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          <div className="form-section">
            <h3>Account Information</h3>
            
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
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Password</h3>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={togglePasswordFields}
              >
                {showPasswordFields ? 'Cancel Password Change' : 'Change Password'}
              </button>
            </div>

            {showPasswordFields && (
              <>
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    className={getFieldError('currentPassword') ? 'error' : ''}
                    aria-describedby={getFieldError('currentPassword') ? 'currentPassword-error' : undefined}
                  />
                  {getFieldError('currentPassword') && (
                    <div id="currentPassword-error" className="field-error">
                      {getFieldError('currentPassword')}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    className={getFieldError('newPassword') ? 'error' : ''}
                    aria-describedby={getFieldError('newPassword') ? 'newPassword-error' : undefined}
                  />
                  {getFieldError('newPassword') && (
                    <div id="newPassword-error" className="field-error">
                      {getFieldError('newPassword')}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    name="confirmNewPassword"
                    value={formData.confirmNewPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    className={getFieldError('confirmNewPassword') ? 'error' : ''}
                    aria-describedby={getFieldError('confirmNewPassword') ? 'confirmNewPassword-error' : undefined}
                  />
                  {getFieldError('confirmNewPassword') && (
                    <div id="confirmNewPassword-error" className="field-error">
                      {getFieldError('confirmNewPassword')}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner size="small" message="" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;