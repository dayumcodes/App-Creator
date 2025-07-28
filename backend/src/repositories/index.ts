import { UserRepository } from './UserRepository';
import { ProjectRepository } from './ProjectRepository';
import { ProjectFileRepository } from './ProjectFileRepository';
import { PromptHistoryRepository } from './PromptHistoryRepository';

export { UserRepository, ProjectRepository, ProjectFileRepository, PromptHistoryRepository };

// Create singleton instances
export const userRepository = new UserRepository();
export const projectRepository = new ProjectRepository();
export const projectFileRepository = new ProjectFileRepository();
export const promptHistoryRepository = new PromptHistoryRepository();