import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    if (!process.env['OPENAI_API_KEY']) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }

  /**
   * Generate code from a natural language prompt with retry logic
   */
  async generateCode(prompt: string, context?: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = context 
          ? `Context: ${context}\n\nRequest: ${prompt}`
          : prompt;

        const completion = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new Error('No response received from OpenAI');
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenAI API attempt ${attempt} failed:`, error);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw new Error(`OpenAI API failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Modify existing code based on a prompt
   */
  async modifyCode(prompt: string, existingCode: string, filename: string): Promise<string> {
    const systemPrompt = this.buildModificationSystemPrompt();
    const userPrompt = `File: ${filename}\n\nExisting code:\n${existingCode}\n\nModification request: ${prompt}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 4000,
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new Error('No response received from OpenAI');
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenAI API modification attempt ${attempt} failed:`, error);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw new Error(`OpenAI API modification failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Build system prompt for code generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert web developer assistant that generates complete, functional web applications.

IMPORTANT INSTRUCTIONS:
1. Generate complete, working HTML, CSS, and JavaScript code
2. Use modern web standards (HTML5, CSS3, ES6+)
3. Make applications responsive and mobile-friendly
4. Include proper error handling and validation
5. Use semantic HTML and accessible design patterns
6. Generate clean, well-commented code
7. Return ONLY the code files in the following format:

===== index.html =====
[HTML content here]

===== styles.css =====
[CSS content here]

===== script.js =====
[JavaScript content here]

8. If additional files are needed, use the same format with appropriate filenames
9. Ensure all files work together as a complete application
10. Do not include explanations outside of code comments`;
  }

  /**
   * Build system prompt for code modification
   */
  private buildModificationSystemPrompt(): string {
    return `You are an expert web developer assistant that modifies existing code based on user requests.

IMPORTANT INSTRUCTIONS:
1. Modify the existing code according to the user's request
2. Preserve existing functionality unless explicitly asked to change it
3. Maintain code quality and consistency with the existing style
4. Add proper error handling for new features
5. Keep the code clean and well-commented
6. Return ONLY the modified code without explanations
7. Ensure the modified code is syntactically correct and functional
8. If the modification affects multiple files, indicate which files need changes`;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}