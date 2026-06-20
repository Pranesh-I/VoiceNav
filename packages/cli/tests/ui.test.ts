import { describe, it, expect } from 'vitest';
import { discoverUiActions } from '../src/discovery/ui/index.js';
import { createAstCache, parseFile } from '../src/discovery/parser.js';
import { walkProject } from '../src/discovery/walker.js';
import path from 'node:path';

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'ui-app');

describe('UI Discovery (A4)', () => {
  it('finds ≥80% of known UI elements and captures correct static/dynamic labels', async () => {
    const files = await walkProject(FIXTURE_ROOT);
    const cache = createAstCache();
    await Promise.all(files.map((f) => parseFile(f, cache)));

    const capabilities = await discoverUiActions(files, cache, FIXTURE_ROOT, 'unknown');
    
    // Total valid elements across fixtures: 26
    const expectedTotal = 26;
    expect(capabilities.length).toBeGreaterThanOrEqual(expectedTotal * 0.8);

    // 1. Buttons & Links
    const submitBtn = capabilities.find(c => c.metadata.elementType === 'button' && c.metadata.label === 'Submit');
    expect(submitBtn).toBeDefined();
    expect(submitBtn?.metadata.labelSource).toBe('static');

    const dynamicBtn = capabilities.find(c => c.metadata.elementType === 'button' && c.metadata.labelSource === 'dynamic' && typeof c.metadata.label === 'string' && c.metadata.label.includes("t('login.button')"));
    expect(dynamicBtn).toBeDefined();

    const homeLink = capabilities.find(c => c.metadata.elementType === 'link' && c.metadata.label === 'Home');
    expect(homeLink).toBeDefined();
    expect(homeLink?.metadata.href).toBe('/home');

    // 2. Menus
    const mainMenu = capabilities.find(c => c.metadata.elementType === 'menu' && c.metadata.label === 'main-nav');
    expect(mainMenu).toBeDefined();

    const dashboardItem = capabilities.find(c => c.metadata.elementType === 'menuitem' && c.metadata.label === 'Dashboard');
    expect(dashboardItem).toBeDefined();
    expect(dashboardItem?.metadata.parentMenu).toBe('main-nav');

    const profileDropdown = capabilities.find(c => c.metadata.elementType === 'menu' && c.metadata.label === 'ProfileDropdown');
    expect(profileDropdown).toBeDefined();
    expect(profileDropdown?.metadata.parentMenu).toBe('main-nav');

    // 3. Forms & Inputs
    const contactForm = capabilities.find(c => c.metadata.elementType === 'form' && c.metadata.label === 'Contact Us');
    expect(contactForm).toBeDefined();

    const emailInput = capabilities.find(c => c.metadata.elementType === 'input' && c.metadata.label === 'Email Address');
    expect(emailInput).toBeDefined();
    expect(emailInput?.metadata.inputType).toBe('email');

    const subjectInput = capabilities.find(c => c.metadata.elementType === 'input' && c.metadata.label === 'Subject');
    expect(subjectInput).toBeDefined();

    const subscribeCheck = capabilities.find(c => c.metadata.elementType === 'input' && c.metadata.label === 'Subscribe to newsletter');
    expect(subscribeCheck).toBeDefined();

    // 4. Custom UI
    const customDiv = capabilities.find(c => c.metadata.elementType === 'button' && c.metadata.label === 'Clickable Div');
    expect(customDiv).toBeDefined();

    const paymentForm = capabilities.find(c => c.metadata.elementType === 'form' && c.metadata.label === 'Payment Details');
    expect(paymentForm).toBeDefined();
  });
});
