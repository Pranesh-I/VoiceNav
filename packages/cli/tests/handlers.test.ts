import { describe, it, expect } from 'vitest';
import { discoverHandlers } from '../src/discovery/handlers/index.js';
import { createAstCache, parseFile } from '../src/discovery/parser.js';
import { walkProject } from '../src/discovery/walker.js';
import path from 'node:path';

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'handlers-app');

describe('Handler Discovery (A2)', () => {
  it('finds ≥85% of known handlers and extracts correct metadata', async () => {
    const files = await walkProject(FIXTURE_ROOT);
    const cache = createAstCache();
    await Promise.all(files.map((f) => parseFile(f, cache)));

    const capabilities = await discoverHandlers(files, cache, FIXTURE_ROOT, 'unknown');
    
    // Total valid handlers we created:
    // Button.tsx: 11
    // Form.tsx: 5
    // UserService.ts: 8
    // api.ts: 5
    // UserController.ts: 5
    // Total = 34
    
    expect(capabilities.length).toBeGreaterThanOrEqual(34 * 0.85);

    // Verify onClick handlers
    const onClickHandlers = capabilities.filter(c => c.metadata.triggerType === 'onClick');
    expect(onClickHandlers.length).toBe(11);
    
    // Assert on inline handler metadata
    const inlineOnClicks = onClickHandlers.filter(c => c.metadata.inlineHandler === true);
    expect(inlineOnClicks.length).toBe(5); // The 5 inline arrows/functions
    
    const namedOnClicks = onClickHandlers.filter(c => !c.metadata.inlineHandler);
    expect(namedOnClicks.length).toBe(6); // The 3 handleClicks, 2 onActions, 1 findUser1

    // Verify onSubmit handlers
    const onSubmitHandlers = capabilities.filter(c => c.metadata.triggerType === 'onSubmit');
    expect(onSubmitHandlers.length).toBe(5);

    // Verify service handlers
    const serviceHandlers = capabilities.filter(c => c.metadata.triggerType === 'service');
    expect(serviceHandlers.length).toBe(13); // 8 from UserService, 5 from api.ts
    
    // Verify type guard is not included
    const typeGuard = serviceHandlers.find(c => c.metadata.handlerName === 'isUser' || c.metadata.handlerName === 'isSpecialUser');
    expect(typeGuard).toBeUndefined();

    // Verify controller handlers
    const controllerHandlers = capabilities.filter(c => c.metadata.triggerType === 'controller');
    expect(controllerHandlers.length).toBe(5);
    
    // Verify JSDoc capture
    const login1 = controllerHandlers.find(c => c.metadata.handlerName === 'login1');
    expect(login1).toBeDefined();
    expect(login1?.metadata.docComment).toContain('Logs in the user.');

    const logout1 = controllerHandlers.find(c => c.metadata.handlerName === 'logout1');
    expect(logout1).toBeDefined();
    expect(logout1?.metadata.docComment).toContain('Logs out the user.');

    // Duplicate capability check: 
    // findUser1 is exported in UserService (service) and wired in Button (onClick)
    const findUserCaps = capabilities.filter(c => c.metadata.handlerName === 'findUser1');
    expect(findUserCaps.length).toBe(2);
    expect(findUserCaps.some(c => c.metadata.triggerType === 'service')).toBe(true);
    expect(findUserCaps.some(c => c.metadata.triggerType === 'onClick')).toBe(true);

    // Assert decoy elements are ignored
    const unknownHandlers = capabilities.filter(c => 
      c.metadata.handlerName === 'helperFunction' || 
      c.metadata.handlerName === 'somethingElse' ||
      c.metadata.handlerName === 'constructor'
    );
    expect(unknownHandlers.length).toBe(0);
  });
});
