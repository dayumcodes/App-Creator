import { OpenAIService } from './OpenAIService';
import { CodeValidationService } from './CodeValidationService';
import { PromptHistoryRepository } from '../repositories/PromptHistoryRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';

export interface GeneratedFile {
  filename: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  isValid: boolean;
  validationErrors: string[];
}

export interface IterationResult {
  modifiedFiles: GeneratedFile[];
  isValid: boolean;
  validationErrors: string[];
}

export class CodeGenerationService {
  private openAIService: OpenAIService;
  private validationService: CodeValidationService;
  private promptHistoryRepo: PromptHistoryRepository;
  private projectFileRepo: ProjectFileRepository;

  constructor() {
    this.openAIService = new OpenAIService();
    this.validationService = new CodeValidationService();
    this.promptHistoryRepo = new PromptHistoryRepository();
    this.projectFileRepo = new ProjectFileRepository();
  }

  /**
   * Generate a complete web application from a natural language prompt
   */
  async generateApplication(
    prompt: string, 
    projectId: string, 
    _userId: string
  ): Promise<CodeGenerationResult> {
    try {
      // Enhance the prompt with web application context
      const enhancedPrompt = this.enhancePromptForWebApp(prompt);
      
      // Generate code using OpenAI
      const generatedCode = await this.openAIService.generateCode(enhancedPrompt);
      
      // Parse the generated code into files
      const files = this.parseGeneratedCode(generatedCode);
      
      // Validate the generated code
      const validationResults = await this.validationService.validateFiles(files);
      
      // Store the prompt and response in history
      await this.promptHistoryRepo.create({
        projectId,
        prompt,
        response: generatedCode,
        filesChanged: files.map(f => f.filename)
      });

      return {
        files,
        isValid: validationResults.isValid,
        validationErrors: validationResults.errors
      };
    } catch (error) {
      console.error('Code generation failed:', error);
      throw new Error(`Failed to generate application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Iterate on existing code with additional prompts
   */
  async iterateOnCode(
    prompt: string,
    projectId: string,
    _userId: string
  ): Promise<IterationResult> {
    try {
      // Get existing project files
      const existingFiles = await this.projectFileRepo.findByProject(projectId);
      
      if (existingFiles.length === 0) {
        throw new Error('No existing files found for iteration');
      }

      // Determine which files need modification based on the prompt
      const filesToModify = this.determineFilesToModify(prompt, existingFiles);
      
      const modifiedFiles: GeneratedFile[] = [];
      
      // Modify each relevant file
      for (const file of filesToModify) {
        const modifiedContent = await this.openAIService.modifyCode(
          prompt,
          file.content,
          file.filename
        );
        
        modifiedFiles.push({
          filename: file.filename,
          content: modifiedContent,
          type: file.type as 'html' | 'css' | 'js' | 'json'
        });
      }
      
      // Validate the modified code
      const validationResults = await this.validationService.validateFiles(modifiedFiles);
      
      // Store the iteration in prompt history
      await this.promptHistoryRepo.create({
        projectId,
        prompt,
        response: JSON.stringify(modifiedFiles),
        filesChanged: modifiedFiles.map(f => f.filename)
      });

      return {
        modifiedFiles,
        isValid: validationResults.isValid,
        validationErrors: validationResults.errors
      };
    } catch (error) {
      console.error('Code iteration failed:', error);
      throw new Error(`Failed to iterate on code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance user prompt with web application context
   */
  private enhancePromptForWebApp(prompt: string): string {
    return `Create a complete, functional web application for the following request:

${prompt}

Requirements:
- Create a responsive, modern web application
- Use semantic HTML5 elements
- Include CSS for styling and layout
- Add JavaScript for interactivity
- Ensure the application works on both desktop and mobile
- Include proper error handling
- Use modern web development best practices
- Make the application accessible (ARIA labels, keyboard navigation)
- Include loading states and user feedback where appropriate`;
  }

  /**
   * Parse generated code into separate files
   */
  private parseGeneratedCode(generatedCode: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const filePattern = /===== (.+?) =====([\s\S]*?)(?====== |$)/g;
    let match;

    while ((match = filePattern.exec(generatedCode)) !== null) {
      const filename = match[1]?.trim();
      const content = match[2]?.trim();
      if (!filename || !content) continue;
      
      const type = this.getFileType(filename);
      
      files.push({
        filename,
        content,
        type
      });
    }

    // If no files were parsed with the delimiter format, treat the entire response as index.html
    if (files.length === 0) {
      files.push({
        filename: 'index.html',
        content: generatedCode,
        type: 'html'
      });
    }

    return files;
  }

  /**
   * Determine file type from filename
   */
  private getFileType(filename: string): 'html' | 'css' | 'js' | 'json' {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'html':
      case 'htm':
        return 'html';
      case 'css':
        return 'css';
      case 'js':
      case 'mjs':
        return 'js';
      case 'json':
        return 'json';
      default:
        return 'html'; // Default to HTML for unknown extensions
    }
  }

  /**
   * Build context string from existing files
   */
  private buildContextFromFiles(files: any[]): string {
    return files.map(file => 
      `File: ${file.filename}\n${file.content}\n`
    ).join('\n---\n');
  }

  /**
   * Determine which files need modification based on the prompt
   */
  private determineFilesToModify(prompt: string, existingFiles: any[]): any[] {
    const lowerPrompt = prompt.toLowerCase();
    
    // Simple heuristics to determine which files to modify
    const shouldModifyHTML = lowerPrompt.includes('html') || 
                            lowerPrompt.includes('structure') || 
                            lowerPrompt.includes('content') ||
                            lowerPrompt.includes('element') ||
                            lowerPrompt.includes('add') ||
                            lowerPrompt.includes('remove');
    
    const shouldModifyCSS = lowerPrompt.includes('css') || 
                           lowerPrompt.includes('style') || 
                           lowerPrompt.includes('color') ||
                           lowerPrompt.includes('layout') ||
                           lowerPrompt.includes('design') ||
                           lowerPrompt.includes('responsive');
    
    const shouldModifyJS = lowerPrompt.includes('js') || 
                          lowerPrompt.includes('javascript') || 
                          lowerPrompt.includes('function') ||
                          lowerPrompt.includes('interactive') ||
                          lowerPrompt.includes('click') ||
                          lowerPrompt.includes('event');

    const filesToModify = [];

    for (const file of existingFiles) {
      const fileType = this.getFileType(file.filename);
      
      if ((fileType === 'html' && shouldModifyHTML) ||
          (fileType === 'css' && shouldModifyCSS) ||
          (fileType === 'js' && shouldModifyJS)) {
        filesToModify.push(file);
      }
    }

    // If no specific files were identified, modify all files
    if (filesToModify.length === 0) {
      return existingFiles;
    }

    return filesToModify;
  }
}