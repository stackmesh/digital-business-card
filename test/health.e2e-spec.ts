import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'postgresql://business_card:business_card@127.0.0.1:5432/business_card?schema=public';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('serves Apollo Sandbox and answers the health query', async () => {
    const sandbox = await request(app.getHttpServer())
      .get('/graphql')
      .set('Accept', 'text/html');

    expect(sandbox.status, sandbox.text).toBe(200);
    expect(sandbox.headers['content-type']).toContain('text/html');
    expect(sandbox.text.toLowerCase()).toContain('sandbox');

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health { status } }' })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        health: {
          status: 'ok',
        },
      },
    });
  });
});
