import request from 'supertest';
import app from '../index';

describe('API Endpoints', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should return API message', async () => {
    const response = await request(app).get('/api');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Lovable Clone API');
  });
});
