/**
 * Lighthouse Accessibility Audit Script
 * Uses Puppeteer to authenticate, then runs Lighthouse on key pages.
 * Usage: node scripts/lighthouse-audit.mjs [WEB_PORT]
 */
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import fs from 'fs';

const WEB_PORT = process.argv[2] || '5174';
const BASE_URL = `http://localhost:${WEB_PORT}`;

// Unauthenticated pages (run before login)
const UNAUTH_PAGES = [
  ['/login', 'Login'],
];

// Authenticated pages (run after login)
const AUTH_PAGES = [
  ['/week', 'My Week'],
  ['/dashboard', 'Dashboard'],
  ['/issues', 'Issues List'],
  ['/projects', 'Projects List'],
  ['/docs', 'Documents List'],
];

async function runLH(port, url, label) {
  console.log(`\n🔍 Lighthouse: ${label} (${url})`);

  const result = await lighthouse(url, {
    port,
    output: 'json',
    onlyCategories: ['accessibility'],
    formFactor: 'desktop',
    screenEmulation: { disabled: true },
    throttling: { cpuSlowdownMultiplier: 1 },
    disableStorageReset: true,
  });

  const report = JSON.parse(result.report);
  const a11yScore = Math.round(report.categories.accessibility.score * 100);
  const finalUrl = report.finalDisplayedUrl || report.requestedUrl;

  const failingAudits = report.categories.accessibility.auditRefs
    .map(ref => report.audits[ref.id])
    .filter(a => a.score !== null && a.score < 1)
    .map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      items: a.details?.items?.length || 0,
    }));

  console.log(`  Final URL: ${finalUrl}`);
  console.log(`  Score: ${a11yScore}/100, Failing: ${failingAudits.length}`);
  for (const a of failingAudits) {
    console.log(`    - ${a.title} (${a.items} items)`);
  }

  const outputFile = `/tmp/lh-${label.replace(/\s+/g, '-').toLowerCase()}.json`;
  fs.writeFileSync(outputFile, result.report);

  return { label, url, finalUrl, score: a11yScore, failingAudits };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const port = new URL(browser.wsEndpoint()).port;
  console.log(`Chrome debugging port: ${port}`);

  const results = [];

  // Phase 1: Unauthenticated pages
  console.log('=== Phase 1: Unauthenticated pages ===');
  for (const [path, label] of UNAUTH_PAGES) {
    try {
      const r = await runLH(port, `${BASE_URL}${path}`, label);
      results.push(r);
    } catch (err) {
      console.error(`${label} failed: ${err.message}`);
    }
  }

  // Phase 2: Log in
  console.log('\n=== Logging in ===');
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', 'dev@ship.local');
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', 'admin123');

  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/auth/login') && resp.request().method() === 'POST' && resp.status() === 200,
      { timeout: 15000 }
    ),
    page.click('button[type="submit"]'),
  ]);
  await new Promise(r => setTimeout(r, 5000));
  console.log(`Logged in. URL: ${page.url()}`);
  await page.close();

  // Phase 3: Authenticated pages
  console.log('\n=== Phase 2: Authenticated pages ===');
  for (const [path, label] of AUTH_PAGES) {
    try {
      const r = await runLH(port, `${BASE_URL}${path}`, label);
      results.push(r);
    } catch (err) {
      console.error(`${label} failed: ${err.message}`);
      results.push({ label, url: `${BASE_URL}${path}`, score: null, error: err.message, failingAudits: [] });
    }
  }

  await browser.close();

  // Summary
  console.log('\n\n===== LIGHTHOUSE ACCESSIBILITY SCORES =====\n');
  console.log('| Page | Score | Failing Audits |');
  console.log('|------|-------|----------------|');
  for (const r of results) {
    const score = r.score != null ? `${r.score}/100` : 'ERROR';
    const fails = r.failingAudits?.length || 0;
    console.log(`| ${r.label} | ${score} | ${fails} |`);
  }

  const outputPath = 'shipshape/audit/07-lighthouse-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
