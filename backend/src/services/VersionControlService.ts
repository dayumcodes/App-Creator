import { ProjectVersionRepository } from '../repositories/ProjectVersionRepository';
import { FileSnapshotRepository } from '../repositories/FileSnapshotRepository';
import { FileChangeRepository } from '../repositories/FileChangeRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import {
  ProjectVersion,
  ProjectVersionWithSnapshots,
  FileSnapshot,
  FileChange,
  ProjectFile,
  ChangeType,
  NotFoundError,
} from '../types/database';

export interface DiffResult {
  filename: string;
  oldContent: string;
  newContent: string;
  diff: string;
  changeType: ChangeType;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  currentPosition: number;
  totalChanges: number;
}

export class VersionControlService {
  constructor(
    private projectVersionRepo: ProjectVersionRepository,
    private fileSnapshotRepo: FileSnapshotRepository,
    private fileChangeRepo: FileChangeRepository,
    private projectFileRepo: ProjectFileRepository
  ) {}

  /**
   * Create a new version from current project state
   */
  async createVersion(
    projectId: string,
    name: string,
    description?: string
  ): Promise<ProjectVersionWithSnapshots> {
    return await this.projectVersionRepo.createVersionFromCurrentFiles(
      projectId,
      name,
      description
    );
  }

  /**
   * Get all versions for a project
   */
  async getVersionHistory(projectId: string): Promise<ProjectVersion[]> {
    return await this.projectVersionRepo.findByProject(projectId);
  }

  /**
   * Get a specific version with its file snapshots
   */
  async getVersionWithFiles(versionId: string): Promise<ProjectVersionWithSnapshots> {
    const version = await this.projectVersionRepo.findByIdWithSnapshots(versionId);
    if (!version) {
      throw new NotFoundError('ProjectVersion', versionId);
    }
    return version;
  }

  /**
   * Rollback project to a specific version
   */
  async rollbackToVersion(versionId: string): Promise<void> {
    const version = await this.getVersionWithFiles(versionId);
    
    // Get current project files
    const currentFiles = await this.projectFileRepo.findByProject(version.projectId);
    
    // Track changes for undo/redo
    const changes: Array<{
      filename: string;
      oldContent: string | null;
      newContent: string;
      changeType: ChangeType;
    }> = [];

    // Update existing files and track changes
    for (const snapshot of version.snapshots) {
      const currentFile = currentFiles.find(f => f.filename === snapshot.filename);
      
      if (currentFile) {
        // File exists, update it
        if (currentFile.content !== snapshot.content) {
          changes.push({
            filename: snapshot.filename,
            oldContent: currentFile.content,
            newContent: snapshot.content,
            changeType: ChangeType.UPDATE,
          });
          
          await this.projectFileRepo.update(currentFile.id, {
            content: snapshot.content,
            type: snapshot.type,
          });
        }
      } else {
        // File doesn't exist, create it
        changes.push({
          filename: snapshot.filename,
          oldContent: null,
          newContent: snapshot.content,
          changeType: ChangeType.CREATE,
        });
        
        await this.projectFileRepo.create({
          projectId: version.projectId,
          filename: snapshot.filename,
          content: snapshot.content,
          type: snapshot.type,
        });
      }
    }

    // Delete files that don't exist in the version
    for (const currentFile of currentFiles) {
      const snapshotExists = version.snapshots.some(s => s.filename === currentFile.filename);
      if (!snapshotExists) {
        changes.push({
          filename: currentFile.filename,
          oldContent: currentFile.content,
          newContent: '',
          changeType: ChangeType.DELETE,
        });
        
        await this.projectFileRepo.delete(currentFile.id);
      }
    }

    // Record all changes for undo/redo
    await this.recordChanges(version.projectId, changes);

    // Set this version as active
    await this.projectVersionRepo.setActiveVersion(versionId);
  }

  /**
   * Track a file change for undo/redo functionality
   */
  async trackFileChange(
    projectId: string,
    filename: string,
    oldContent: string | null,
    newContent: string,
    changeType: ChangeType
  ): Promise<FileChange> {
    return await this.fileChangeRepo.create({
      projectId,
      filename,
      oldContent,
      newContent,
      changeType,
    });
  }

  /**
   * Get change history for a project
   */
  async getChangeHistory(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<FileChange[]> {
    return await this.fileChangeRepo.findByProject(projectId, limit, offset);
  }

  /**
   * Get change history for a specific file
   */
  async getFileChangeHistory(
    projectId: string,
    filename: string,
    limit?: number,
    offset?: number
  ): Promise<FileChange[]> {
    return await this.fileChangeRepo.findByProjectAndFile(projectId, filename, limit, offset);
  }

  /**
   * Undo the last change
   */
  async undoLastChange(projectId: string): Promise<boolean> {
    const changes = await this.fileChangeRepo.findByProject(projectId, 1);
    if (changes.length === 0) {
      return false;
    }

    const lastChange = changes[0];
    const currentFile = await this.projectFileRepo.findByProjectAndFilename(
      projectId,
      lastChange.filename
    );

    switch (lastChange.changeType) {
      case ChangeType.CREATE:
        // Undo create by deleting the file
        if (currentFile) {
          await this.projectFileRepo.delete(currentFile.id);
        }
        break;
        
      case ChangeType.UPDATE:
        // Undo update by reverting to old content
        if (currentFile && lastChange.oldContent !== null) {
          await this.projectFileRepo.update(currentFile.id, {
            content: lastChange.oldContent,
          });
        }
        break;
        
      case ChangeType.DELETE:
        // Undo delete by recreating the file
        if (!currentFile && lastChange.oldContent !== null) {
          // Determine file type from extension
          const extension = lastChange.filename.split('.').pop()?.toLowerCase();
          let fileType = 'HTML' as any;
          
          switch (extension) {
            case 'css':
              fileType = 'CSS';
              break;
            case 'js':
              fileType = 'JS';
              break;
            case 'ts':
              fileType = 'TS';
              break;
            case 'tsx':
              fileType = 'TSX';
              break;
            case 'jsx':
              fileType = 'JSX';
              break;
            case 'json':
              fileType = 'JSON';
              break;
          }
          
          await this.projectFileRepo.create({
            projectId,
            filename: lastChange.filename,
            content: lastChange.oldContent,
            type: fileType,
          });
        }
        break;
    }

    // Remove the change from history (it's been undone)
    await this.fileChangeRepo.delete(lastChange.id);
    
    return true;
  }

  /**
   * Get undo/redo state for a project
   */
  async getUndoRedoState(projectId: string): Promise<UndoRedoState> {
    const totalChanges = await this.fileChangeRepo.getChangeCount(projectId);
    
    return {
      canUndo: totalChanges > 0,
      canRedo: false, // Simple implementation - no redo stack for now
      currentPosition: totalChanges,
      totalChanges,
    };
  }

  /**
   * Compare two versions and generate diff
   */
  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<DiffResult[]> {
    const [version1, version2] = await Promise.all([
      this.getVersionWithFiles(versionId1),
      this.getVersionWithFiles(versionId2),
    ]);

    const diffs: DiffResult[] = [];
    const allFilenames = new Set([
      ...version1.snapshots.map(s => s.filename),
      ...version2.snapshots.map(s => s.filename),
    ]);

    for (const filename of allFilenames) {
      const file1 = version1.snapshots.find(s => s.filename === filename);
      const file2 = version2.snapshots.find(s => s.filename === filename);

      let changeType: ChangeType;
      let oldContent = '';
      let newContent = '';

      if (!file1 && file2) {
        // File was created
        changeType = ChangeType.CREATE;
        newContent = file2.content;
      } else if (file1 && !file2) {
        // File was deleted
        changeType = ChangeType.DELETE;
        oldContent = file1.content;
      } else if (file1 && file2) {
        // File was modified
        changeType = ChangeType.UPDATE;
        oldContent = file1.content;
        newContent = file2.content;
      } else {
        continue; // This shouldn't happen
      }

      const diff = this.generateDiff(oldContent, newContent);
      
      diffs.push({
        filename,
        oldContent,
        newContent,
        diff,
        changeType,
      });
    }

    return diffs;
  }

  /**
   * Compare current project state with a version
   */
  async compareWithCurrentState(versionId: string): Promise<DiffResult[]> {
    const version = await this.getVersionWithFiles(versionId);
    const currentFiles = await this.projectFileRepo.findByProject(version.projectId);

    const diffs: DiffResult[] = [];
    const allFilenames = new Set([
      ...version.snapshots.map(s => s.filename),
      ...currentFiles.map(f => f.filename),
    ]);

    for (const filename of allFilenames) {
      const versionFile = version.snapshots.find(s => s.filename === filename);
      const currentFile = currentFiles.find(f => f.filename === filename);

      let changeType: ChangeType;
      let oldContent = '';
      let newContent = '';

      if (!versionFile && currentFile) {
        // File was created since version
        changeType = ChangeType.CREATE;
        newContent = currentFile.content;
      } else if (versionFile && !currentFile) {
        // File was deleted since version
        changeType = ChangeType.DELETE;
        oldContent = versionFile.content;
      } else if (versionFile && currentFile) {
        // File was modified since version
        if (versionFile.content === currentFile.content) {
          continue; // No changes
        }
        changeType = ChangeType.UPDATE;
        oldContent = versionFile.content;
        newContent = currentFile.content;
      } else {
        continue; // This shouldn't happen
      }

      const diff = this.generateDiff(oldContent, newContent);
      
      diffs.push({
        filename,
        oldContent,
        newContent,
        diff,
        changeType,
      });
    }

    return diffs;
  }

  /**
   * Create a branch-like version for experimentation
   */
  async createExperimentalBranch(
    projectId: string,
    baseName: string,
    description?: string
  ): Promise<ProjectVersionWithSnapshots> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const branchName = `${baseName}-experiment-${timestamp}`;
    
    return await this.createVersion(projectId, branchName, description);
  }

  /**
   * Delete a version (cleanup)
   */
  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.projectVersionRepo.findByIdOrThrow(versionId);
    
    // Don't allow deleting the active version
    if (version.isActive) {
      throw new Error('Cannot delete the active version');
    }

    await this.projectVersionRepo.delete(versionId);
  }

  /**
   * Record multiple changes in a batch
   */
  private async recordChanges(
    projectId: string,
    changes: Array<{
      filename: string;
      oldContent: string | null;
      newContent: string;
      changeType: ChangeType;
    }>
  ): Promise<void> {
    const changeInputs = changes.map(change => ({
      projectId,
      filename: change.filename,
      oldContent: change.oldContent,
      newContent: change.newContent,
      changeType: change.changeType,
    }));

    await this.fileChangeRepo.createBatch(changeInputs);
  }

  /**
   * Generate a simple diff between two strings
   */
  private generateDiff(oldContent: string, newContent: string): string {
    // Simple line-by-line diff implementation
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const diff: string[] = [];
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine !== newLine) {
        if (oldLine && !newLine) {
          diff.push(`- ${oldLine}`);
        } else if (!oldLine && newLine) {
          diff.push(`+ ${newLine}`);
        } else {
          diff.push(`- ${oldLine}`);
          diff.push(`+ ${newLine}`);
        }
      } else if (oldLine) {
        diff.push(`  ${oldLine}`);
      }
    }
    
    return diff.join('\n');
  }
}