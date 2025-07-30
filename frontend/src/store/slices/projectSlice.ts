import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface ProjectFile {
  id: string;
  filename: string;
  content: string;
  type: 'HTML' | 'CSS' | 'JS' | 'JSON';
}

interface Project {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  activeFile: string | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  activeFile: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setProjects: (state, action: PayloadAction<{ projects: Project[]; pagination?: any }>) => {
      state.projects = action.payload.projects;
      if (action.payload.pagination) {
        state.pagination = action.payload.pagination;
      }
    },
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
      state.activeFile = action.payload?.files[0]?.filename || null;
    },
    setActiveFile: (state, action: PayloadAction<string>) => {
      state.activeFile = action.payload;
    },
    updateFileContent: (state, action: PayloadAction<{ filename: string; content: string }>) => {
      if (state.currentProject) {
        const file = state.currentProject.files.find(f => f.filename === action.payload.filename);
        if (file) {
          file.content = action.payload.content;
        }
      }
    },
    addProject: (state, action: PayloadAction<Project>) => {
      state.projects.unshift(action.payload);
      state.pagination.total += 1;
    },
    updateProject: (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      }
      if (state.currentProject?.id === action.payload.id) {
        state.currentProject = action.payload;
      }
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(p => p.id !== action.payload);
      if (state.currentProject?.id === action.payload) {
        state.currentProject = null;
        state.activeFile = null;
      }
      state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      if (action.payload.page !== undefined) {
        state.pagination.page = action.payload.page;
      }
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit;
      }
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setProjects,
  setCurrentProject,
  setActiveFile,
  updateFileContent,
  addProject,
  updateProject,
  removeProject,
  setSearchQuery,
  setPagination,
  setError,
  clearError,
} = projectSlice.actions;

export default projectSlice.reducer;