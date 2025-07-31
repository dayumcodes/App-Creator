import { UserRepository } from './UserRepository';
import { ProjectRepository } from './ProjectRepository';
import { ProjectFileRepository } from './ProjectFileRepository';
import { PromptHistoryRepository } from './PromptHistoryRepository';
import { ProjectVersionRepository } from './ProjectVersionRepository';
import { FileSnapshotRepository } from './FileSnapshotRepository';
import { FileChangeRepository } from './FileChangeRepository';
import { DeploymentRepository } from './DeploymentRepository';

export { 
  UserRepository, 
  ProjectRepository, 
  ProjectFileRepository, 
  PromptHistoryRepository,
  ProjectVersionRepository,
  FileSnapshotRepository,
  FileChangeRepository,
  DeploymentRepository
};

// Create singleton instances
export const userRepository = new UserRepository();
export const projectRepository = new ProjectRepository();
export const projectFileRepository = new ProjectFileRepository();
export const promptHistoryRepository = new PromptHistoryRepository();
export const projectVersionRepository = new ProjectVersionRepository();
export const fileSnapshotRepository = new FileSnapshotRepository();
export const fileChangeRepository = new FileChangeRepository();