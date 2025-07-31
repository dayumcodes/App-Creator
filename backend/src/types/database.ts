import { 
  User, 
  Project, 
  ProjectFile, 
  PromptHistory, 
  ProjectVersion,
  FileSnapshot,
  FileChange,
  FileType,
  ChangeType 
} from '../generated/prisma';

// Deployment types (will be generated after migration)
export enum DeploymentPlatform {
  NETLIFY = 'NETLIFY',
  VERCEL = 'VERCEL',
  GITHUB_PAGES = 'GITHUB_PAGES',
}

export enum DeploymentStatus {
  PENDING = 'PENDING',
  BUILDING = 'BUILDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface Deployment {
  id: string;
  projectId: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  url?: string;
  customDomain?: string;
  buildCommand?: string;
  outputDir?: string;
  envVars?: Record<string, string>;
  errorMessage?: string;
  deploymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export Prisma types
export { 
  User, 
  Project, 
  ProjectFile, 
  PromptHistory, 
  ProjectVersion,
  FileSnapshot,
  FileChange,
  FileType,
  ChangeType 
};

// Extended types for API responses
export interface UserWithProjects extends User {
  projects: Project[];
}

export interface ProjectWithFiles extends Project {
  files: ProjectFile[];
  user: User;
}

export interface ProjectWithAll extends Project {
  files: ProjectFile[];
  prompts: PromptHistory[];
  user: User;
}

// Input types for creating/updating records
export interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  passwordHash?: string;
}

export interface CreateProjectInput {
  userId: string;
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

export interface CreateProjectFileInput {
  projectId: string;
  filename: string;
  content: string;
  type: FileType;
}

export interface UpdateProjectFileInput {
  filename?: string;
  content?: string;
  type?: FileType;
}

export interface CreatePromptHistoryInput {
  projectId: string;
  prompt: string;
  response: string;
  filesChanged: string[];
}

export interface CreateProjectVersionInput {
  projectId: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateProjectVersionInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateFileSnapshotInput {
  versionId: string;
  filename: string;
  content: string;
  type: FileType;
}

export interface CreateFileChangeInput {
  projectId: string;
  filename: string;
  oldContent?: string;
  newContent: string;
  changeType: ChangeType;
}

export interface CreateDeploymentInput {
  projectId: string;
  platform: DeploymentPlatform;
  customDomain?: string | undefined;
  buildCommand?: string | undefined;
  outputDir?: string | undefined;
  envVars?: Record<string, string> | undefined;
}

export interface UpdateDeploymentInput {
  status?: DeploymentStatus | undefined;
  url?: string | undefined;
  customDomain?: string | undefined;
  buildCommand?: string | undefined;
  outputDir?: string | undefined;
  envVars?: Record<string, string> | undefined;
  errorMessage?: string | undefined;
  deploymentId?: string | undefined;
}

export interface ProjectVersionWithSnapshots extends ProjectVersion {
  snapshots: FileSnapshot[];
}

export interface FileChangeWithDiff extends FileChange {
  diff?: string;
}

// Query options
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ProjectListOptions extends PaginationOptions {
  userId: string;
  search?: string;
}

// Database error types
export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
  }
}

export class DuplicateError extends DatabaseError {
  constructor(resource: string, field: string) {
    super(`${resource} with this ${field} already exists`);
    this.name = 'DuplicateError';
    this.code = 'DUPLICATE';
  }
}