/**
 * Accessibility Audit Script
 * Runs axe-core against all major pages, outputs JSON results.
 * Usage: npx tsx scripts/a11y-audit.ts
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.WEB_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface PageResult {
  page: string;
  url: string;
  violations: Array<{
    id: string;
    impact: string | undefined;
    description: string;
    helpUrl: string;
    nodes: number;
    tags: string[];
  }>;
  passes: number;
  incomplete: number;
  inapplicable: number;
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

async function login(page: import('playwright').Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await page.fill('input[type="email"], input[name="email"]', 'dev@ship.local');
  await page.fill('input[type="password"], input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log('✅ Logged in successfully');
}

async function scanPage(page: import('playwright').Page, name: string, url: string): Promise<PageResult> {
  console.log(`\n🔍 Scanning: ${name} (${url})`);
  await page.goto(url, { waitUntil: 'networkidle' });
  // Extra wait for dynamic content
  await page.waitForTimeout(2000);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'section508'])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? undefined,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    tags: v.tags,
  }));

  const criticalCount = violations.filter((v) => v.impact === 'critical').reduce((sum, v) => sum + v.nodes, 0);
  const seriousCount = violations.filter((v) => v.impact === 'serious').reduce((sum, v) => sum + v.nodes, 0);
  const moderateCount = violations.filter((v) => v.impact === 'moderate').reduce((sum, v) => sum + v.nodes, 0);
  const minorCount = violations.filter((v) => v.impact === 'minor').reduce((sum, v) => sum + v.nodes, 0);

  console.log(`  Violations: ${violations.length} rules (${criticalCount} critical, ${seriousCount} serious, ${moderateCount} moderate, ${minorCount} minor)`);
  console.log(`  Passes: ${results.passes.length}, Incomplete: ${results.incomplete.length}`);

  return {
    page: name,
    url,
    violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length,
    violationCount: violations.length,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
  };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // First, scan login page (unauthenticated)
  const results: PageResult[] = [];

  console.log('=== Scanning Login Page (unauthenticated) ===');
  results.push(await scanPage(page, 'Login', `${BASE_URL}/login`));

  // Log in
  await login(page);

  // We need document IDs for editor pages. Fetch from API using cookies from the browser.
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  // Get some documents to test editor pages
  let issueId: string | null = null;
  let wikiId: string | null = null;
  let projectId: string | null = null;
  let sprintId: string | null = null;

  try {
    const resp = await fetch(`${API_URL}/api/documents`, {
      headers: { Cookie: cookieHeader },
    });
    if (resp.ok) {
      const docs = await resp.json() as Array<{ id: string; document_type: string }>;
      issueId = docs.find((d) => d.document_type === 'issue')?.id ?? null;
      wikiId = docs.find((d) => d.document_type === 'wiki')?.id ?? null;
      projectId = docs.find((d) => d.document_type === 'project')?.id ?? null;
      sprintId = docs.find((d) => d.document_type === 'sprint')?.id ?? null;
      console.log(`\nFound docs: issue=${issueId}, wiki=${wikiId}, project=${projectId}, sprint=${sprintId}`);
    }
  } catch (e) {
    console.warn('Could not fetch documents from API, skipping editor pages');
  }

  // Define pages to scan
  const pages: Array<{ name: string; path: string }> = [
    { name: 'My Week', path: '/my-week' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Issues List', path: '/issues' },
    { name: 'Documents List', path: '/docs' },
    { name: 'Projects List', path: '/projects' },
    { name: 'Programs List', path: '/programs' },
    { name: 'Team Allocation', path: '/team/allocation' },
    { name: 'Team Directory', path: '/team/directory' },
    { name: 'Settings', path: '/settings' },
  ];

  if (issueId) pages.push({ name: 'Issue Editor', path: `/documents/${issueId}` });
  if (wikiId) pages.push({ name: 'Wiki Editor', path: `/documents/${wikiId}` });
  if (projectId) pages.push({ name: 'Project Editor', path: `/documents/${projectId}` });
  if (sprintId) pages.push({ name: 'Sprint Editor', path: `/documents/${sprintId}` });

  for (const p of pages) {
    try {
      results.push(await scanPage(page, p.name, `${BASE_URL}${p.path}`));
    } catch (err) {
      console.error(`  ❌ Failed to scan ${p.name}: ${err}`);
    }
  }

  await browser.close();

  // Write results
  const outDir = path.join(process.cwd(), 'audit');
  fs.writeFileSync(path.join(outDir, 'a11y-axe-results.json'), JSON.stringify(results, null, 2));
  console.log(`\n✅ Results written to audit/a11y-axe-results.json`);

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log('Page'.padEnd(25) + 'Violations'.padEnd(12) + 'Critical'.padEnd(10) + 'Serious'.padEnd(10) + 'Moderate'.padEnd(10) + 'Minor');
  for (const r of results) {
    console.log(
      r.page.padEnd(25) +
      String(r.violationCount).padEnd(12) +
      String(r.criticalCount).padEnd(10) +
      String(r.seriousCount).padEnd(10) +
      String(r.moderateCount).padEnd(10) +
      String(r.minorCount)
    );
  }

  const totalCritical = results.reduce((s, r) => s + r.criticalCount, 0);
  const totalSerious = results.reduce((s, r) => s + r.seriousCount, 0);
  console.log(`\nTotal Critical: ${totalCritical}, Total Serious: ${totalSerious}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
