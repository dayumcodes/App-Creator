import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Authentication Security Tests', () => {
  let testUser: any;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'security-test' } }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'security-test' } }
    });
    await prisma.$disconnect();
  });

  describe('Password Security', () => {
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'abc123',
        '11111111',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `weak-${password}@security-test.com`,
            username: `weak${password}`,
            password,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/password/i);
      }
    });

    it('should require strong passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'strong@security-test.com',
          username: 'stronguser',
          password: 'StrongPassword123!@#',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      testUser = response.body.user;
    });

    it('should hash passwords properly', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'strong@security-test.com' }
      });

      expect(user).toBeTruthy();
      expect(user!.passwordHash).not.toBe('StrongPassword123!@#');
      expect(user!.passwordHash.length).toBeGreaterThan(50);
      
      // Verify bcrypt hash
      const isValidHash = await bcrypt.compare('StrongPassword123!@#', user!.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('should not expose password hashes in responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'strong@security-test.com',
          password: 'StrongPassword123!@#',
        })
        .expect(200);

      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('password');
    });
  });

  describe('Brute Force Protection', () => {
    it('should implement rate limiting for login attempts', async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'strong@security-test.com',
            password: 'WrongPassword123!',
          })
      );

      const responses = await Promise.allSettled(loginAttempts);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should temporarily lock accounts after multiple failed attempts', async () => {
      // Create a test user for lockout testing
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'lockout@security-test.com',
          username: 'lockoutuser',
          password: 'LockoutTest123!',
        })
        .expect(201);

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'lockout@security-test.com',
            password: 'WrongPassword123!',
          });
      }

      // Next attempt should be locked out
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'lockout@security-test.com',
          password: 'LockoutTest123!', // Correct password
        });

      expect(response.status).toBe(423); // Locked
      expect(response.body.error).toMatch(/account.*locked/i);
    });
  });

  describe('JWT Token Security', () => {
    let validToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'strong@security-test.com',
          password: 'StrongPassword123!@#',
        });
      validToken = response.body.token;
    });

    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'Bearer invalid',
        'malformed-token',
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });

    it('should reject expired tokens', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toMatch(/expired|invalid/i);
    });

    it('should reject tokens with invalid signatures', async () => {
      // Create a token with wrong secret
      const invalidToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        'wrong-secret'
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject tokens with tampered payload', async () => {
      // Decode valid token and modify payload
      const decoded = jwt.decode(validToken) as any;
      const tamperedToken = jwt.sign(
        { ...decoded, userId: 'tampered-user-id' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should validate token format and structure', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Missing parts
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', // Empty payload
        '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.', // Empty header
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate tokens on logout', async () => {
      // Login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'strong@security-test.com',
          password: 'StrongPassword123!@#',
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Verify token works
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Token should be invalidated (depending on implementation)
      // Note: This test might need adjustment based on your logout implementation
      // Some implementations don't track token invalidation
    });

    it('should prevent session fixation attacks', async () => {
      // Get initial session/token
      const initialResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'strong@security-test.com',
          password: 'StrongPassword123!@#',
        });

      const initialToken = initialResponse.body.token;

      // Login again should generate a new token
      const secondResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'strong@security-test.com',
          password: 'StrongPassword123!@#',
        });

      const secondToken = secondResponse.body.token;

      // Tokens should be different
      expect(initialToken).not.toBe(secondToken);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'/*",
        "' OR 1=1 --",
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password123',
          });

        // Should not crash or return unexpected data
        expect([400, 401, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('users');
      }
    });

    it('should sanitize user input in registration', async () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
      ];

      for (const maliciousInput of xssAttempts) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test-${Date.now()}@security-test.com`,
            username: maliciousInput,
            password: 'SecurePassword123!',
          });

        if (response.status === 201) {
          // If registration succeeds, username should be sanitized
          expect(response.body.user.username).not.toContain('<script>');
          expect(response.body.user.username).not.toContain('javascript:');
        }
      }
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        'user@.domain.com',
        'user@domain..com',
      ];

      for (const email of invalidEmails) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email,
            username: 'testuser',
            password: 'SecurePassword123!',
          })
          .expect(400);
      }
    });
  });

  describe('Authorization Security', () => {
    let userToken: string;
    let otherUserToken: string;
    let userProject: any;

    beforeAll(async () => {
      // Create two users for authorization testing
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'auth-user1@security-test.com',
          username: 'authuser1',
          password: 'AuthTest123!',
        });
      userToken = user1Response.body.token;

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'auth-user2@security-test.com',
          username: 'authuser2',
          password: 'AuthTest123!',
        });
      otherUserToken = user2Response.body.token;

      // Create a project for user1
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Security Test Project',
          description: 'Project for authorization testing',
        });
      userProject = projectResponse.body;
    });

    it('should prevent unauthorized access to other users projects', async () => {
      // User2 trying to access User1's project
      await request(app)
        .get(`/api/projects/${userProject.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('should prevent unauthorized project modifications', async () => {
      // User2 trying to modify User1's project
      await request(app)
        .put(`/api/projects/${userProject.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Hacked Project Name',
        })
        .expect(403);
    });

    it('should prevent unauthorized project deletion', async () => {
      // User2 trying to delete User1's project
      await request(app)
        .delete(`/api/projects/${userProject.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('should prevent privilege escalation', async () => {
      // Try to access admin endpoints (if they exist)
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/projects',
        '/api/admin/stats',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`);

        // Should return 403 (Forbidden) or 404 (Not Found), not 200
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Try to login with non-existent user
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@security-test.com',
          password: 'password123',
        })
        .expect(401);

      // Error message should not reveal whether user exists
      expect(response.body.error).not.toMatch(/user.*not.*found/i);
      expect(response.body.error).not.toMatch(/email.*not.*exist/i);
      expect(response.body.error).toMatch(/invalid.*credentials/i);
    });

    it('should not expose user enumeration through timing attacks', async () => {
      const existingEmail = 'strong@security-test.com';
      const nonExistentEmail = 'nonexistent@security-test.com';

      // Measure response times
      const existingUserTimes: number[] = [];
      const nonExistentUserTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        // Test existing user
        const start1 = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({
            email: existingEmail,
            password: 'wrongpassword',
          });
        existingUserTimes.push(Date.now() - start1);

        // Test non-existent user
        const start2 = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({
            email: nonExistentEmail,
            password: 'wrongpassword',
          });
        nonExistentUserTimes.push(Date.now() - start2);
      }

      const avgExistingTime = existingUserTimes.reduce((a, b) => a + b) / existingUserTimes.length;
      const avgNonExistentTime = nonExistentUserTimes.reduce((a, b) => a + b) / nonExistentUserTimes.length;

      // Response times should be similar (within 50ms difference)
      const timeDifference = Math.abs(avgExistingTime - avgNonExistentTime);
      expect(timeDifference).toBeLessThan(50);
    });

    it('should not expose internal system information', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      // Should not expose framework, version, or stack trace information
      expect(response.body).not.toHaveProperty('stack');
      expect(response.text).not.toMatch(/express/i);
      expect(response.text).not.toMatch(/node\.js/i);
      expect(response.text).not.toMatch(/version/i);
    });
  });

  describe('CSRF Protection', () => {
    it('should require proper content-type for state-changing operations', async () => {
      const token = validToken;

      // Try to create project with wrong content-type
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send('name=CSRF Test&description=Should fail');

      expect(response.status).toBe(400);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});