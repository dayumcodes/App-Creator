export interface ErrorMessage {
  code: string;
  message: string;
  userMessage: string;
  suggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Authentication Errors
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    userMessage: 'The email or password you entered is incorrect.',
    suggestions: [
      'Double-check your email address and password',
      'Use the "Forgot Password" link if you can\'t remember your password',
      'Make sure Caps Lock is not enabled'
    ],
    severity: 'medium'
  },
  
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Authentication token has expired',
    userMessage: 'Your session has expired. Please log in again.',
    suggestions: [
      'Click the login button to sign in again',
      'Your work has been saved automatically'
    ],
    severity: 'medium'
  },
  
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    message: 'Account has been temporarily locked',
    userMessage: 'Your account has been temporarily locked due to multiple failed login attempts.',
    suggestions: [
      'Wait 15 minutes before trying again',
      'Use the "Forgot Password" link to reset your password',
      'Contact support if you need immediate access'
    ],
    severity: 'high'
  },

  // Project Errors
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Project not found',
    userMessage: 'The project you\'re looking for doesn\'t exist or has been deleted.',
    suggestions: [
      'Check the project URL and try again',
      'Go back to your project list',
      'Contact the project owner if it was shared with you'
    ],
    severity: 'medium'
  },
  
  PROJECT_ACCESS_DENIED: {
    code: 'PROJECT_ACCESS_DENIED',
    message: 'Access denied to project',
    userMessage: 'You don\'t have permission to access this project.',
    suggestions: [
      'Ask the project owner to share it with you',
      'Make sure you\'re logged into the correct account',
      'Check if the project is public or private'
    ],
    severity: 'medium'
  },
  
  PROJECT_LIMIT_EXCEEDED: {
    code: 'PROJECT_LIMIT_EXCEEDED',
    message: 'Project limit exceeded',
    userMessage: 'You\'ve reached the maximum number of projects for your account.',
    suggestions: [
      'Delete some unused projects',
      'Upgrade your account for more projects',
      'Archive old projects you no longer need'
    ],
    severity: 'medium'
  },

  // Code Generation Errors
  AI_SERVICE_UNAVAILABLE: {
    code: 'AI_SERVICE_UNAVAILABLE',
    message: 'AI service is temporarily unavailable',
    userMessage: 'The AI code generation service is currently unavailable.',
    suggestions: [
      'Try again in a few minutes',
      'Check your internet connection',
      'Edit your code manually while the service is down'
    ],
    severity: 'high'
  },
  
  PROMPT_TOO_LONG: {
    code: 'PROMPT_TOO_LONG',
    message: 'Prompt exceeds maximum length',
    userMessage: 'Your prompt is too long. Please make it shorter and more specific.',
    suggestions: [
      'Break your request into smaller, more specific prompts',
      'Focus on one feature at a time',
      'Remove unnecessary details from your prompt'
    ],
    severity: 'low'
  },
  
  INVALID_PROMPT: {
    code: 'INVALID_PROMPT',
    message: 'Invalid or unsafe prompt detected',
    userMessage: 'Your prompt contains content that cannot be processed.',
    suggestions: [
      'Rephrase your request using different words',
      'Focus on describing the functionality you want',
      'Avoid requesting harmful or inappropriate content'
    ],
    severity: 'medium'
  },

  // File System Errors
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'File size exceeds limit',
    userMessage: 'The file you\'re trying to upload is too large.',
    suggestions: [
      'Compress your file before uploading',
      'Split large files into smaller parts',
      'Remove unnecessary content from the file'
    ],
    severity: 'medium'
  },
  
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE',
    message: 'Invalid file type',
    userMessage: 'This file type is not supported.',
    suggestions: [
      'Use supported file types (HTML, CSS, JS, JSON)',
      'Convert your file to a supported format',
      'Check the file extension'
    ],
    severity: 'low'
  },
  
  STORAGE_QUOTA_EXCEEDED: {
    code: 'STORAGE_QUOTA_EXCEEDED',
    message: 'Storage quota exceeded',
    userMessage: 'You\'ve used all your available storage space.',
    suggestions: [
      'Delete some old projects or files',
      'Upgrade your account for more storage',
      'Export and backup projects locally'
    ],
    severity: 'high'
  },

  // Network Errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection error',
    userMessage: 'There was a problem connecting to our servers.',
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a moment and try again'
    ],
    severity: 'high'
  },
  
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    message: 'Request timeout',
    userMessage: 'The request took too long to complete.',
    suggestions: [
      'Try again with a simpler request',
      'Check your internet connection',
      'Break complex operations into smaller steps'
    ],
    severity: 'medium'
  },

  // Validation Errors
  REQUIRED_FIELD_MISSING: {
    code: 'REQUIRED_FIELD_MISSING',
    message: 'Required field is missing',
    userMessage: 'Please fill in all required fields.',
    suggestions: [
      'Check for fields marked with an asterisk (*)',
      'Make sure all form fields are completed',
      'Scroll up to see if there are any empty required fields'
    ],
    severity: 'low'
  },
  
  INVALID_EMAIL_FORMAT: {
    code: 'INVALID_EMAIL_FORMAT',
    message: 'Invalid email format',
    userMessage: 'Please enter a valid email address.',
    suggestions: [
      'Make sure your email includes @ and a domain',
      'Check for typos in your email address',
      'Use a format like: user@example.com'
    ],
    severity: 'low'
  },
  
  PASSWORD_TOO_WEAK: {
    code: 'PASSWORD_TOO_WEAK',
    message: 'Password does not meet requirements',
    userMessage: 'Your password is too weak. Please choose a stronger password.',
    suggestions: [
      'Use at least 8 characters',
      'Include uppercase and lowercase letters',
      'Add numbers and special characters'
    ],
    severity: 'medium'
  }
};

export function getErrorMessage(code: string): ErrorMessage {
  return ERROR_MESSAGES[code] || {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    userMessage: 'Something went wrong. Please try again.',
    suggestions: [
      'Refresh the page and try again',
      'Contact support if the problem persists'
    ],
    severity: 'medium'
  };
}