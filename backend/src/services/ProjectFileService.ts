import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import { FileChangeRepository } from '../repositories/FileChangeRepository';
import {
  ProjectFile,
  CreateProjectFileInput,
  UpdateProjectFileInput,
  ChangeType,
} from '../types/database';

export class ProjectFileService {
  constructor(
    private projectFileRepo: ProjectFileRepository,
    private fileChangeRepo: FileChangeRepository
  ) {}

  /**
   * Create a new file and track the change
   */
  async create(data: CreateProjectFileInput): Promise<ProjectFile> {
    const file = await this.projectFileRepo.create(data);
    
    // Track the creation
    await this.fileChangeRepo.create({
      projectId: data.projectId,
      filename: data.filename,
      oldContent: null,
      newContent: data.content,
      changeType: ChangeType.CREATE,
    });

    return file;
  }

  /**
   * Update a file and track the change
   */
  async update(id: string, data: UpdateProjectFileInput): Promise<ProjectFile> {
    // Get the current file content before updating
    const currentFile = await this.projectFileRepo.findByIdOrThrow(id);
    const oldContent = currentFile.content;

    const updatedFile = await this.projectFileRepo.update(id, data);

    // Track the update if content changed
    if (data.content && data.content !== oldContent) {
      await this.fileChangeRepo.create({
        projectId: currentFile.projectId,
        filename: currentFile.filename,
        oldContent,
        newContent: data.content,
        changeType: ChangeType.UPDATE,
      });
    }

    return updatedFile;
  }

  /**
   * Update file by project and filename and track the change
   */
  async updateByProjectAndFilename(
    projectId: string,
    filename: string,
    data: Omit<UpdateProjectFileInput, 'filename'>
  ): Promise<ProjectFile> {
    // Get the current file content before updating
    const currentFile = await this.projectFileRepo.findByProjectAndFilename(projectId, filename);
    const oldContent = currentFile?.content || '';

    const updatedFile = await this.projectFileRepo.updateByProjectAndFilename(
      projectId,
      filename,
      data
    );

    // Track the update if content changed
    if (data.content && data.content !== oldContent) {
      await this.fileChangeRepo.create({
        projectId,
        filename,
        oldContent,
        newContent: data.content,
        changeType: ChangeType.UPDATE,
      });
    }

    return updatedFile;
  }

  /**
   * Delete a file and track the change
   */
  async delete(id: string): Promise<ProjectFile> {
    // Get the file before deleting to track the change
    const file = await this.projectFileRepo.findByIdOrThrow(id);
    
    const deletedFile = await this.projectFileRepo.delete(id);

    // Track the deletion
    await this.fileChangeRepo.create({
      projectId: file.projectId,
      filename: file.filename,
      oldContent: file.content,
      newContent: '',
      changeType: ChangeType.DELETE,
    });

    return deletedFile;
  }

  /**
   * Delete file by project and filename and track the change
   */
  async deleteByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<ProjectFile> {
    // Get the file before deleting to track the change
    const file = await this.projectFileRepo.findByProjectAndFilename(projectId, filename);
    if (!file) {
      throw new Error(`File ${filename} not found in project ${projectId}`);
    }
    
    const deletedFile = await this.projectFileRepo.deleteByProjectAndFilename(
      projectId,
      filename
    );

    // Track the deletion
    await this.fileChangeRepo.create({
      projectId,
      filename,
      oldContent: file.content,
      newContent: '',
      changeType: ChangeType.DELETE,
    });

    return deletedFile;
  }

  /**
   * Create or update a file and track the change
   */
  async createOrUpdate(data: CreateProjectFileInput): Promise<ProjectFile> {
    const existing = await this.projectFileRepo.findByProjectAndFilename(
      data.projectId,
      data.filename
    );

    if (existing) {
      // Update existing file
      return await this.update(existing.id, {
        content: data.content,
        type: data.type,
      });
    } else {
      // Create new file
      return await this.create(data);
    }
  }

  // Delegate read operations to the repository (no tracking needed)
  async findById(id: string): Promise<ProjectFile | null> {
    return await this.projectFileRepo.findById(id);
  }

  async findByIdOrThrow(id: string): Promise<ProjectFile> {
    return await this.projectFileRepo.findByIdOrThrow(id);
  }

  async findByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<ProjectFile | null> {
    return await this.projectFileRepo.findByProjectAndFilename(projectId, filename);
  }

  async findByProject(projectId: string): Promise<ProjectFile[]> {
    return await this.projectFileRepo.findByProject(projectId);
  }

  async exists(id: string): Promise<boolean> {
    return await this.projectFileRepo.exists(id);
  }

  async existsByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<boolean> {
    return await this.projectFileRepo.existsByProjectAndFilename(projectId, filename);
  }

  async getFileCount(projectId: string): Promise<number> {
    return await this.projectFileRepo.getFileCount(projectId);
  }

  async deleteAllByProject(projectId: string): Promise<number> {
    return await this.projectFileRepo.deleteAllByProject(projectId);
  }
}