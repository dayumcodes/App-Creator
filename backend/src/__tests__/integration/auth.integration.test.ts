import request from 'supertest';
import app from '../../index';
import { databaseService } from '../../services/DatabaseService';
import { userRepository } from '../../repositories';

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    await databaseService.connect();
  });

  afterAll(async () => {
    await databaseService.disconnect();
  });

  beforeEach(async () => {
    // Clean up users before each test
    try {
      const users = await userRepository.findByEmail('integration@test.com');
      if (users) {
        await userRepository.delete(users.id);
      }
    } catch (error) {
      // User doesn't exist, which is fine
    }
  });

  describe('User Registration and Login Flow', () => {
    const testUser = {
      email: 'integration@test.com',
      username: 'integrationtest',
      password: 'testpassword123'
    };

    it('should complete full authentication flow', async () => {
      // 1. Register a new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.message).toBe('User registered successfully');
      expect(registerResponse.body.user.email).toBe(testUser.email);
      expect(registerResponse.body.user.username).toBe(testUser.username);
      expect(registerResponse.body.token).toBeDefined();
      expect(registerResponse.body.user.passwordHash).toBeUndefined();

      const token = registerResponse.body.token;

      // 2. Get user profile with token
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.email).toBe(testUser.email);
      expect(profileResponse.body.user.username).toBe(testUser.username);

      // 3. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logout successful');

      // 4. Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.body.user.email).toBe(testUser.email);
      expect(loginResponse.body.token).toBeDefined();

      // 5. Verify new token works
      const newToken = loginResponse.body.token;
      const verifyResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.user.email).toBe(testUser.email);
    });

    it('should prevent duplicate registration', async () => {
      // Register user first time
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Try to register same user again
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject invalid login credentials', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Try to login with wrong password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.error.code).toBe('LOGIN_FAILED');
    });

    it('should reject requests with invalid tokens', async () => {
      const invalidTokenResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidTokenResponse.status).toBe(401);
      expect(invalidTokenResponse.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject requests without tokens', async () => {
      const noTokenResponse = await request(app)
        .get('/api/auth/me');

      expect(noTokenResponse.status).toBe(401);
      expect(noTokenResponse.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});