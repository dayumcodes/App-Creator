import { databaseService } from '../services/DatabaseService';
import { FileType } from '../generated/prisma';

describe('Database Service', () => {
  // Generate unique test data for each test run
  const timestamp = Date.now();
  const testUsers: string[] = [];
  const testProjects: string[] = [];

  beforeAll(async () => {
    await databaseService.connect();
  });

  afterAll(async () => {
    // Clean up test data
    try {
      // Delete test projects and their files
      for (const projectId of testProjects) {
        try {
          await databaseService.deleteProject(projectId);
        } catch (error) {
          // Project might not exist, continue cleanup
        }
      }

      // Delete test users
      for (const userId of testUsers) {
        try {
          await databaseService.deleteUser(userId);
        } catch (error) {
          // User might not exist, continue cleanup
        }
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }

    await databaseService.disconnect();
  });

  describe('Health Check', () => {
    it('should return true for healthy database', async () => {
      const isHealthy = await databaseService.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('User Operations', () => {
    const testUser = {
      email: `test-${timestamp}@example.com`,
      username: `testuser-${timestamp}`,
      passwordHash: 'hashedpassword123',
    };

    let userId: string;

    it('should create a user', async () => {
      const user = await databaseService.createUser(testUser);
      userId = user.id;
      testUsers.push(userId);

      expect(user.email).toBe(testUser.email);
      expect(user.username).toBe(testUser.username);
      expect(user.passwordHash).toBe(testUser.passwordHash);
      expect(user.id).toBeDefined();
    });

    it('should find user by email', async () => {
      const user = await databaseService.getUserByEmail(testUser.email);
      expect(user).toBeTruthy();
      expect(user?.email).toBe(testUser.email);
    });

    it('should get user with projects', async () => {
      const userWithProjects = await databaseService.getUserWithProjects(userId);
      expect(userWithProjects).toBeTruthy();
      expect(userWithProjects?.projects).toBeDefined();
      expect(Array.isArray(userWithProjects?.projects)).toBe(true);
    });
  });

  describe('Project Operations', () => {
    let userId: string;
    let projectId: string;

    beforeAll(async () => {
      // Create a test user first
      const user = await databaseService.createUser({
        email: `project-test-${timestamp}@example.com`,
        username: `projecttester-${timestamp}`,
        passwordHash: 'hashedpassword123',
      });
      userId = user.id;
      testUsers.push(userId);
    });

    it('should create a project', async () => {
      const projectData = {
        userId,
        name: 'Test Project',
        description: 'A test project for unit testing',
      };

      const project = await databaseService.createProject(projectData);
      projectId = project.id;

      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
      expect(project.userId).toBe(userId);
    });

    it('should get project with files', async () => {
      const project = await databaseService.getProjectWithFiles(projectId);
      expect(project).toBeTruthy();
      expect(project?.files).toBeDefined();
      expect(Array.isArray(project?.files)).toBe(true);
    });

    it('should validate project ownership', async () => {
      const isOwner = await databaseService.validateProjectOwnership(projectId, userId);
      expect(isOwner).toBe(true);

      // Test with wrong user
      const isNotOwner = await databaseService.validateProjectOwnership(projectId, 'wrong-user-id');
      expect(isNotOwner).toBe(false);
    });
  });

  describe('Project File Operations', () => {
    let userId: string;
    let projectId: string;

    beforeAll(async () => {
      // Create test user and project
      const user = await databaseService.createUser({
        email: `file-test-${timestamp}@example.com`,
        username: `filetester-${timestamp}`,
        passwordHash: 'hashedpassword123',
      });
      userId = user.id;
      testUsers.push(userId);

      const project = await databaseService.createProject({
        userId,
        name: 'File Test Project',
        description: 'Project for testing file operations',
      });
      projectId = project.id;
      testProjects.push(projectId);
    });

    it('should create a project file', async () => {
      const fileData = {
        projectId,
        filename: 'index.html',
        content: '<html><body>Hello World</body></html>',
        type: FileType.HTML,
      };

      const file = await databaseService.createProjectFile(fileData);
      expect(file.filename).toBe(fileData.filename);
      expect(file.content).toBe(fileData.content);
      expect(file.type).toBe(fileData.type);
    });

    it('should get project files', async () => {
      const files = await databaseService.getProjectFiles(projectId);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]?.filename).toBe('index.html');
    });

    it('should create or update project file', async () => {
      const fileData = {
        projectId,
        filename: 'styles.css',
        content: 'body { margin: 0; }',
        type: FileType.CSS,
      };

      // First creation
      const file1 = await databaseService.createOrUpdateProjectFile(fileData);
      expect(file1.content).toBe(fileData.content);

      // Update existing file
      const updatedFileData = {
        ...fileData,
        content: 'body { margin: 0; padding: 0; }',
      };
      const file2 = await databaseService.createOrUpdateProjectFile(updatedFileData);
      expect(file2.content).toBe(updatedFileData.content);
      expect(file2.id).toBe(file1.id); // Same file, updated
    });
  });

  describe('Complex Operations', () => {
    let userId: string;

    beforeAll(async () => {
      const user = await databaseService.createUser({
        email: `complex-test-${timestamp}@example.com`,
        username: `complextester-${timestamp}`,
        passwordHash: 'hashedpassword123',
      });
      userId = user.id;
      testUsers.push(userId);
    });

    it('should create project with files in transaction', async () => {
      const projectData = {
        userId,
        name: 'Complex Test Project',
        description: 'Project created with files in transaction',
      };

      const files = [
        {
          filename: 'index.html',
          content: '<html><body>Test</body></html>',
          type: FileType.HTML,
        },
        {
          filename: 'styles.css',
          content: 'body { color: red; }',
          type: FileType.CSS,
        },
        {
          filename: 'script.js',
          content: 'console.log("Hello");',
          type: FileType.JS,
        },
      ];

      const result = await databaseService.createProjectWithFiles(projectData, files);

      expect(result.project.name).toBe(projectData.name);
      expect(result.files).toHaveLength(3);
      expect(result.files[0]?.filename).toBe('index.html');
      expect(result.files[1]?.filename).toBe('styles.css');
      expect(result.files[2]?.filename).toBe('script.js');
    });
  });
});