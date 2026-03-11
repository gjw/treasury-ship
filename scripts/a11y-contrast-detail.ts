/**
 * Detailed color contrast audit - captures specific failing elements
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.WEB_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'dev@ship.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  // Pages with known contrast issues
  const failingPages = [
    { name: 'My Week', path: '/my-week' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Projects List', path: '/projects' },
    { name: 'Team Allocation', path: '/team/allocation' },
    { name: 'Issue Editor', path: '' }, // will be filled
  ];

  // Get an issue ID
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const resp = await fetch(`${API_URL}/api/documents`, { headers: { Cookie: cookieHeader } });
  const docs = await resp.json() as Array<{ id: string; document_type: string }>;
  const issueId = docs.find((d) => d.document_type === 'issue')?.id;
  if (issueId) failingPages[4]!.path = `/documents/${issueId}`;

  const allDetails: Array<{
    page: string;
    elements: Array<{
      html: string;
      target: string[];
      data: Record<string, unknown>;
      failureSummary: string;
    }>;
  }> = [];

  for (const p of failingPages) {
    if (!p.path) continue;
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const contrastViolation = results.violations.find((v) => v.id === 'color-contrast');
    if (contrastViolation) {
      allDetails.push({
        page: p.name,
        elements: contrastViolation.nodes.map((n) => ({
          html: n.html,
          target: n.target as string[],
          data: (n.any[0]?.data ?? {}) as Record<string, unknown>,
          failureSummary: n.failureSummary ?? '',
        })),
      });
    }
  }

  await browser.close();

  const outPath = path.join(process.cwd(), 'audit', 'a11y-contrast-details.json');
  fs.writeFileSync(outPath, JSON.stringify(allDetails, null, 2));
  console.log(`Written to ${outPath}`);

  // Print readable summary
  for (const detail of allDetails) {
    console.log(`\n=== ${detail.page} (${detail.elements.length} failing elements) ===`);
    for (const el of detail.elements) {
      const data = el.data as Record<string, string>;
      console.log(`  FG: ${data.fgColor} | BG: ${data.bgColor} | Ratio: ${data.contrastRatio} | Expected: ${data.expectedContrastRatio}`);
      console.log(`  Target: ${el.target.join(' > ')}`);
      console.log(`  HTML: ${el.html.substring(0, 120)}`);
      console.log('');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
