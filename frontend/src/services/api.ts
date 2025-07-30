// API service for making HTTP requests to the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  token: string;
}

interface UpdateProfileRequest {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectFile {
  id: string;
  filename: string;
  content: string;
  type: 'HTML' | 'CSS' | 'JS' | 'JSON';
}

interface CreateProjectRequest {
  name: string;
  description?: string;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

interface ProjectListResponse {
  data: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: this.getAuthHeaders(),
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error?.message || data.message || 'An error occurred',
        };
      }

      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<ApiResponse<AuthResponse['user']>> {
    return this.request<AuthResponse['user']>('/auth/me');
  }

  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<AuthResponse['user']>> {
    return this.request<AuthResponse['user']>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Project endpoints
  async getProjects(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<ProjectListResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/projects?${queryString}` : '/projects';
    
    return this.request<ProjectListResponse>(endpoint);
  }

  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProject(id: string, includeFiles = true): Promise<ApiResponse<Project>> {
    const params = includeFiles ? '?includeFiles=true' : '?includeFiles=false';
    return this.request<Project>(`/projects/${id}${params}`);
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async exportProject(id: string): Promise<Response> {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}/projects/${id}/export`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  }

  async importProject(file: File, name: string, description?: string): Promise<ApiResponse<Project>> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/projects/import`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error?.message || data.message || 'An error occurred',
        };
      }

      return { data: data.data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Code generation endpoints
  async generateCode(projectId: string, prompt: string): Promise<ApiResponse<{
    files: ProjectFile[];
    promptHistory: {
      id: string;
      prompt: string;
      response: string;
      filesChanged: string[];
      createdAt: string;
    };
  }>> {
    return this.request(`/generate`, {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt }),
    });
  }

  async iterateCode(projectId: string, prompt: string): Promise<ApiResponse<{
    files: ProjectFile[];
    promptHistory: {
      id: string;
      prompt: string;
      response: string;
      filesChanged: string[];
      createdAt: string;
    };
  }>> {
    return this.request(`/iterate`, {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt }),
    });
  }

  async validateCode(code: string, language: string): Promise<ApiResponse<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }>> {
    return this.request(`/validate`, {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });
  }

  async getPromptHistory(projectId: string): Promise<ApiResponse<Array<{
    id: string;
    prompt: string;
    response: string;
    filesChanged: string[];
    createdAt: string;
  }>>> {
    return this.request(`/projects/${projectId}/prompts`);
  }

  // Preview endpoints
  async generateShareableUrl(projectId: string): Promise<ApiResponse<{
    shareUrl: string;
    expiresAt: string;
  }>> {
    return this.request('/preview/generate-share-url', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async getPreviewInfo(previewId: string): Promise<ApiResponse<{
    previewId: string;
    projectId: string;
    createdAt: string;
    expiresAt: string;
    isExpired: boolean;
  }>> {
    return this.request(`/preview/info/${previewId}`);
  }

  // Streaming code generation
  async generateCodeStream(
    projectId: string, 
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ projectId, prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.error?.message || 'Generation failed');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('Failed to read response stream');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'chunk') {
                onChunk(parsed.content);
              } else if (parsed.type === 'complete') {
                onComplete(parsed.result);
              } else if (parsed.type === 'error') {
                onError(parsed.message);
              }
            } catch (e) {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
}

export const apiService = new ApiService();
export type { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  UpdateProfileRequest,
  Project,
  ProjectFile,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectListResponse
};