import { GeneratedFile } from './CodeGenerationService';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileValidationResult {
  filename: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CodeValidationService {
  /**
   * Validate multiple files
   */
  async validateFiles(files: GeneratedFile[]): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const file of files) {
      const result = await this.validateFile(file);
      allErrors.push(...result.errors.map(error => `${file.filename}: ${error}`));
      allWarnings.push(...result.warnings.map(warning => `${file.filename}: ${warning}`));
    }

    // Additional cross-file validations
    const crossFileValidation = this.validateCrossFileReferences(files);
    allErrors.push(...crossFileValidation.errors);
    allWarnings.push(...crossFileValidation.warnings);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Validate a single file based on its type
   */
  async validateFile(file: GeneratedFile): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (file.type) {
      case 'HTML':
        const htmlValidation = this.validateHTML(file.content);
        errors.push(...htmlValidation.errors);
        warnings.push(...htmlValidation.warnings);
        break;
      
      case 'CSS':
        const cssValidation = this.validateCSS(file.content);
        errors.push(...cssValidation.errors);
        warnings.push(...cssValidation.warnings);
        break;
      
      case 'JS':
        const jsValidation = this.validateJavaScript(file.content);
        errors.push(...jsValidation.errors);
        warnings.push(...jsValidation.warnings);
        break;
      
      case 'JSON':
        const jsonValidation = this.validateJSON(file.content);
        errors.push(...jsonValidation.errors);
        warnings.push(...jsonValidation.warnings);
        break;
    }

    return {
      filename: file.filename,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate HTML content
   */
  private validateHTML(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic HTML structure validation
    if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
      warnings.push('Missing DOCTYPE declaration or html tag');
    }

    // Check for basic required elements
    if (!content.includes('<head>') && !content.includes('<head ')) {
      warnings.push('Missing head element');
    }

    if (!content.includes('<body>') && !content.includes('<body ')) {
      warnings.push('Missing body element');
    }

    // Check for unclosed tags (basic validation)
    const openTags = content.match(/<[^/][^>]*>/g) || [];
    const closeTags = content.match(/<\/[^>]*>/g) || [];
    
    // Simple tag balance check (not perfect but catches obvious issues)
    const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
    const filteredOpenTags = openTags.filter(tag => {
      const tagName = tag.match(/<(\w+)/)?.[1]?.toLowerCase();
      return tagName && !selfClosingTags.includes(tagName) && !tag.endsWith('/>');
    });

    if (filteredOpenTags.length !== closeTags.length) {
      warnings.push('Potential unclosed HTML tags detected');
    }

    // Check for accessibility basics
    if (content.includes('<img') && !content.includes('alt=')) {
      warnings.push('Images should have alt attributes for accessibility');
    }

    return { errors, warnings };
  }

  /**
   * Validate CSS content
   */
  private validateCSS(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic CSS syntax issues
    const braceCount = (content.match(/{/g) || []).length - (content.match(/}/g) || []).length;
    if (braceCount !== 0) {
      errors.push('Unmatched CSS braces detected');
    }

    // Check for common CSS mistakes
    if (content.includes(';;')) {
      warnings.push('Double semicolons found in CSS');
    }

    // Check for vendor prefixes without standard property
    const vendorPrefixes = ['-webkit-', '-moz-', '-ms-', '-o-'];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      for (const prefix of vendorPrefixes) {
        if (line.includes(prefix)) {
          const property = line.split(':')[0]?.trim().replace(prefix, '');
          if (property && !content.includes(`${property}:`)) {
            warnings.push(`Vendor prefix ${prefix} used without standard property on line ${i + 1}`);
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate JavaScript content
   */
  private validateJavaScript(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic syntax check using Function constructor
      new Function(content);
    } catch (error) {
      errors.push(`JavaScript syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check for common issues
    if (content.includes('var ')) {
      warnings.push('Consider using let or const instead of var');
    }

    // Check for console.log statements
    if (content.includes('console.log')) {
      warnings.push('Console.log statements found - consider removing for production');
    }

    // Check for eval usage
    if (content.includes('eval(')) {
      warnings.push('eval() usage detected - potential security risk');
    }

    // Check for missing semicolons (basic check)
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (line && 
          !line.endsWith(';') && 
          !line.endsWith('{') && 
          !line.endsWith('}') && 
          !line.startsWith('//') && 
          !line.startsWith('/*') &&
          !line.includes('if ') &&
          !line.includes('for ') &&
          !line.includes('while ') &&
          !line.includes('function ')) {
        warnings.push(`Missing semicolon on line ${i + 1}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate JSON content
   */
  private validateJSON(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      JSON.parse(content);
    } catch (error) {
      errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate cross-file references
   */
  private validateCrossFileReferences(files: GeneratedFile[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const fileNames = files.map(f => f.filename);
    
    // Check HTML files for references to CSS and JS files
    const htmlFiles = files.filter(f => f.type === 'HTML');
    
    for (const htmlFile of htmlFiles) {
      // Check CSS references
      const cssLinks = htmlFile.content.match(/href=["']([^"']+\.css)["']/g) || [];
      for (const link of cssLinks) {
        const cssFile = link.match(/href=["']([^"']+)["']/)?.[1];
        if (cssFile && !fileNames.includes(cssFile)) {
          warnings.push(`${htmlFile.filename} references missing CSS file: ${cssFile}`);
        }
      }

      // Check JS references
      const jsScripts = htmlFile.content.match(/src=["']([^"']+\.js)["']/g) || [];
      for (const script of jsScripts) {
        const jsFile = script.match(/src=["']([^"']+)["']/)?.[1];
        if (jsFile && !fileNames.includes(jsFile)) {
          warnings.push(`${htmlFile.filename} references missing JavaScript file: ${jsFile}`);
        }
      }
    }

    return { errors, warnings };
  }
}