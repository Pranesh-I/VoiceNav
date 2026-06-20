import { describe, it, expect } from 'vitest';
import { discoverApiEndpoints } from '../src/discovery/api/index.js';
import { createAstCache, parseFile } from '../src/discovery/parser.js';
import { walkProject } from '../src/discovery/walker.js';
import path from 'node:path';

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'api-app');

describe('API Discovery (A3)', () => {
  it('finds ≥95% of known endpoints and resolves nested Express mounts', async () => {
    const files = await walkProject(FIXTURE_ROOT);
    const cache = createAstCache();
    await Promise.all(files.map((f) => parseFile(f, cache)));

    const capabilities = await discoverApiEndpoints(files, cache, FIXTURE_ROOT, 'unknown');
    
    // Total valid endpoints we created:
    // Express AST: 9
    // Fastify AST: 6
    // OpenAPI: 6
    // Total = 21
    
    expect(capabilities.length).toBeGreaterThanOrEqual(21 * 0.95);

    // 1. Verify cross-file nested Express mounts
    const usersGetId = capabilities.find(c => c.metadata.method === 'GET' && c.metadata.path === '/api/v1/users/:id');
    expect(usersGetId).toBeDefined();
    expect(usersGetId?.metadata.sourceType).toBe('express');
    expect(usersGetId?.metadata.pathParams).toContain('id');

    const productsGet = capabilities.find(c => c.metadata.method === 'GET' && c.metadata.path === '/api/v1/products');
    expect(productsGet).toBeDefined();

    const healthGet = capabilities.find(c => c.metadata.method === 'GET' && c.metadata.path === '/health');
    expect(healthGet).toBeDefined();

    const apiStatus = capabilities.find(c => c.metadata.method === 'GET' && c.metadata.path === '/api/status');
    expect(apiStatus).toBeDefined();

    // 2. Verify Fastify routes
    const authUpdate = capabilities.find(c => c.metadata.method === 'PUT' && c.metadata.path === '/auth/update');
    expect(authUpdate).toBeDefined();
    expect(authUpdate?.metadata.sourceType).toBe('fastify');

    const fastApiWorld = capabilities.find(c => c.metadata.method === 'POST' && c.metadata.path === '/fast-api/world');
    expect(fastApiWorld).toBeDefined();

    // 3. Verify OpenAPI parsing
    const petPost = capabilities.find(c => c.metadata.method === 'POST' && c.metadata.path === '/pet');
    expect(petPost).toBeDefined();
    expect(petPost?.metadata.sourceType).toBe('openapi_spec');
    expect(petPost?.metadata.requestSchema).toBeDefined(); // We added a schema for this in the fixture

    const petIdDelete = capabilities.find(c => c.metadata.method === 'DELETE' && c.metadata.path === '/pet/{petId}');
    expect(petIdDelete).toBeDefined();
    expect(petIdDelete?.metadata.pathParams).toContain('petId');
  });
});
