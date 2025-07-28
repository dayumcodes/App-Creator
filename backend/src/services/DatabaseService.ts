import {
  userRepository,
  projectRepository,
  projectFileRepository,
  promptHistoryRepository,
} from '../repositories';
import { connectDatabase, disconnectDatabase, checkDatabaseHealth, withTransaction } from '../lib/database';
import {
  CreateUserInput,
  CreateProjectInput,
  CreateProjectFileInput,
  CreatePromptHistoryInput,
  ProjectListOptions,
  PaginationOptions,
} from '../types/database';

export class DatabaseService {
  // Connection management
  async connect(): Promise<void> {
    await connectDatabase();
  }

  async disconnect(): Promise<void> {
    await disconnectDatabase();
  }

  async healthCheck(): Promise<boolean> {
    return await checkDatabaseHealth();
  }

  // User operations
  async createUser(data: CreateUserInput) {
    return await userRepository.create(data);
  }

  async getUserById(id: string) {
    return await userRepository.findByIdOrThrow(id);
  }

  async getUserByEmail(email: string) {
    return await userRepository.findByEmail(email);
  }

  async getUserWithProjects(id: string) {
    return await userRepository.findWithProjects(id);
  }

  async deleteUser(id: string) {
    return await withTransaction(async (_tx) => {
      // First delete all user's projects (which will cascade to files and prompts)
      const userProjects = await projectRepository.findByUser({ userId: id, page: 1, limit: 1000 });
      for (const project of userProjects.projects) {
        await this.deleteProject(project.id);
      }
      
      // Then delete the user
      return await userRepository.delete(id);
    });
  }

  // Project operations
  async createProject(data: CreateProjectInput) {
    return await projectRepository.create(data);
  }

  async getProjectById(id: string) {
    return await projectRepository.findByIdOrThrow(id);
  }

  async getProjectWithFiles(id: string) {
    return await projectRepository.findWithFiles(id);
  }

  async getProjectWithAll(id: string) {
    return await projectRepository.findWithAll(id);
  }

  async getUserProjects(options: ProjectListOptions) {
    return await projectRepository.findByUser(options);
  }

  async deleteProject(id: string) {
    return await withTransaction(async (_tx) => {
      // Delete all related data in the correct order
      await promptHistoryRepository.deleteAllByProject(id);
      await projectFileRepository.deleteAllByProject(id);
      return await projectRepository.delete(id);
    });
  }

  // Project file operations
  async createProjectFile(data: CreateProjectFileInput) {
    return await projectFileRepository.create(data);
  }

  async createOrUpdateProjectFile(data: CreateProjectFileInput) {
    return await projectFileRepository.createOrUpdate(data);
  }

  async getProjectFiles(projectId: string) {
    return await projectFileRepository.findByProject(projectId);
  }

  async updateProjectFile(projectId: string, filename: string, content: string) {
    return await projectFileRepository.updateByProjectAndFilename(
      projectId,
      filename,
      { content }
    );
  }

  async deleteProjectFile(projectId: string, filename: string) {
    return await projectFileRepository.deleteByProjectAndFilename(projectId, filename);
  }

  // Prompt history operations
  async createPromptHistory(data: CreatePromptHistoryInput) {
    return await promptHistoryRepository.create(data);
  }

  async getProjectPrompts(projectId: string, options?: PaginationOptions) {
    return await promptHistoryRepository.findByProject(projectId, options);
  }

  async getLatestPrompts(projectId: string, limit?: number) {
    return await promptHistoryRepository.findLatestByProject(projectId, limit);
  }

  async searchPrompts(projectId: string, searchTerm: string, options?: PaginationOptions) {
    return await promptHistoryRepository.searchPrompts(projectId, searchTerm, options);
  }

  // Complex operations
  async createProjectWithFiles(
    projectData: CreateProjectInput,
    files: Omit<CreateProjectFileInput, 'projectId'>[]
  ) {
    return await withTransaction(async (_tx) => {
      const project = await projectRepository.create(projectData);
      
      const projectFiles = await Promise.all(
        files.map(file =>
          projectFileRepository.create({
            ...file,
            projectId: project.id,
          })
        )
      );

      return {
        project,
        files: projectFiles,
      };
    });
  }

  async updateProjectFiles(
    projectId: string,
    files: { filename: string; content: string; type: any }[]
  ) {
    return await withTransaction(async (_tx) => {
      const updatedFiles = await Promise.all(
        files.map(file =>
          projectFileRepository.createOrUpdate({
            projectId,
            filename: file.filename,
            content: file.content,
            type: file.type,
          })
        )
      );

      return updatedFiles;
    });
  }

  // Validation helpers
  async validateProjectOwnership(projectId: string, userId: string): Promise<boolean> {
    return await projectRepository.belongsToUser(projectId, userId);
  }

  async validateUserExists(userId: string): Promise<boolean> {
    return await userRepository.exists(userId);
  }

  async validateProjectExists(projectId: string): Promise<boolean> {
    return await projectRepository.exists(projectId);
  }

  // Statistics
  async getUserStats(userId: string) {
    const [user, projectCount] = await Promise.all([
      userRepository.findByIdOrThrow(userId),
      projectRepository.getProjectCount(userId),
    ]);

    return {
      user,
      projectCount,
    };
  }

  async getProjectStats(projectId: string) {
    const [project, fileCount, promptCount] = await Promise.all([
      projectRepository.findByIdOrThrow(projectId),
      projectFileRepository.getFileCount(projectId),
      promptHistoryRepository.getPromptCount(projectId),
    ]);

    return {
      project,
      fileCount,
      promptCount,
    };
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();