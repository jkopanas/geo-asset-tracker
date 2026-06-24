import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import app, { store } from '../src/app.js';
import type { Asset } from '@shared/types.js';

const seedUrl = new URL('../../seed.json', import.meta.url);
const seedData: Asset[] = JSON.parse(readFileSync(seedUrl, 'utf-8'));

beforeEach(async () => {
  await store.seed(seedData);
});

// Test 1 — bbox: asset inside box is returned
describe('GET /assets bbox filter', () => {
  it('returns assets inside the bounding box', async () => {
    // seed asset 0: lat=42.373366, lng=-71.133174
    const res = await request(app)
      .get('/assets?bbox=-71.14,42.37,-71.13,42.38&limit=500')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    const ids = (res.body.data as Asset[]).map((a) => a.id);
    expect(ids).toContain('17fc695a-07a0-4a6e-8822-e8f36c031199');
  });

  // Test 2 — bbox: asset outside box is excluded
  it('excludes assets outside the bounding box', async () => {
    const res = await request(app)
      .get('/assets?bbox=0,0,1,1&limit=500')
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  // Test 3 — antimeridian bbox uses OR logic
  it('returns assets crossing the antimeridian', async () => {
    await store.create({
      name: 'Antimeridian Sensor',
      type: 'sensor',
      status: 'ok',
      lat: 42,
      lng: 175,
      installed_at: '2025-01-01',
      last_inspected_at: null,
      notes: '',
    });

    const res = await request(app)
      .get('/assets?bbox=170,35,-170,50&limit=500')
      .expect(200);

    const names = (res.body.data as Asset[]).map((a) => a.name);
    expect(names).toContain('Antimeridian Sensor');
    // Verify the filter excluded non-antimeridian assets (e.g. lng≈-71 seed data)
    expect(
      (res.body.data as Asset[]).every((a) => a.lng >= 170 || a.lng <= -170)
    ).toBe(true);
  });
});

// Test 4 — type AND status filters compose as AND (not OR)
describe('GET /assets filter composition', () => {
  it('returns only assets matching both type and status', async () => {
    const res = await request(app)
      .get('/assets?type=pipe&status=warning&limit=500')
      .expect(200);

    expect((res.body.data as Asset[]).length).toBeGreaterThan(0);
    for (const asset of res.body.data as Asset[]) {
      expect(asset.type).toBe('pipe');
      expect(asset.status).toBe('warning');
    }
  });
});

// Tests 5 & 6 — POST validation
describe('POST /assets validation', () => {
  it('returns 400 with VALIDATION_ERROR when lat is missing', async () => {
    const res = await request(app)
      .post('/assets')
      .send({
        name: 'Test',
        type: 'sensor',
        status: 'ok',
        lng: -71.0,
        installed_at: '2025-01-01',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.lat).toBeDefined();
  });

  it('returns 400 with field error when lat is out of range', async () => {
    const res = await request(app)
      .post('/assets')
      .send({
        name: 'Test',
        type: 'sensor',
        status: 'ok',
        lat: 999,
        lng: -71.0,
        installed_at: '2025-01-01',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.lat).toBeDefined();
  });
});

// Test 7 — PATCH unknown id returns 404
describe('PATCH /assets/:id', () => {
  it('returns 404 NOT_FOUND for a non-existent id', async () => {
    const res = await request(app)
      .patch('/assets/00000000-0000-0000-0000-000000000000')
      .send({ status: 'critical' })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// Test 8 — DELETE then GET proves deletion is durable
describe('DELETE /assets/:id', () => {
  it('returns 204 then 404 for the same id', async () => {
    const id = seedData[0].id;

    await request(app).delete(`/assets/${id}`).expect(204);

    const res = await request(app).get(`/assets/${id}`).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
