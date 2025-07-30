// Form validation utilities

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Email validation
export const validateEmail = (email: string): ValidationError | null => {
  if (!email) {
    return { field: 'email', message: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { field: 'email', message: 'Please enter a valid email address' };
  }
  
  return null;
};

// Password validation
export const validatePassword = (password: string): ValidationError | null => {
  if (!password) {
    return { field: 'password', message: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { field: 'password', message: 'Password must be at least 6 characters long' };
  }
  
  return null;
};

// Username validation
export const validateUsername = (username: string): ValidationError | null => {
  if (!username) {
    return { field: 'username', message: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { field: 'username', message: 'Username must be at least 3 characters long' };
  }
  
  if (username.length > 20) {
    return { field: 'username', message: 'Username must be less than 20 characters' };
  }
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { field: 'username', message: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return null;
};

// Confirm password validation
export const validateConfirmPassword = (password: string, confirmPassword: string): ValidationError | null => {
  if (!confirmPassword) {
    return { field: 'confirmPassword', message: 'Please confirm your password' };
  }
  
  if (password !== confirmPassword) {
    return { field: 'confirmPassword', message: 'Passwords do not match' };
  }
  
  return null;
};

// Login form validation
export const validateLoginForm = (email: string, password: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);
  
  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Registration form validation
export const validateRegisterForm = (
  username: string,
  email: string,
  password: string,
  confirmPassword: string
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const usernameError = validateUsername(username);
  if (usernameError) errors.push(usernameError);
  
  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);
  
  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);
  
  const confirmPasswordError = validateConfirmPassword(password, confirmPassword);
  if (confirmPasswordError) errors.push(confirmPasswordError);
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Profile update form validation
export const validateProfileForm = (
  username: string,
  email: string,
  currentPassword?: string,
  newPassword?: string,
  confirmNewPassword?: string
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const usernameError = validateUsername(username);
  if (usernameError) errors.push(usernameError);
  
  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);
  
  // If changing password, validate all password fields
  if (newPassword || confirmNewPassword) {
    if (!currentPassword) {
      errors.push({ field: 'currentPassword', message: 'Current password is required to change password' });
    }
    
    if (newPassword) {
      const newPasswordError = validatePassword(newPassword);
      if (newPasswordError) {
        errors.push({ field: 'newPassword', message: newPasswordError.message });
      }
    }
    
    if (newPassword && confirmNewPassword) {
      const confirmError = validateConfirmPassword(newPassword, confirmNewPassword);
      if (confirmError) {
        errors.push({ field: 'confirmNewPassword', message: confirmError.message });
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};