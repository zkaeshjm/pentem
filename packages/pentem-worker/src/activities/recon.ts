import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';

export interface ReconParams {
  targetUrl: string;
  auditDir: string;
  authConfig?: string;
}

export async function runBrowserExploration(params: ReconParams): Promise<string> {
  const { targetUrl, auditDir } = params;
  const outputPath = path.join(auditDir, 'browser-exploration.txt');
  const screenshotDir = path.join(auditDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const findings: string[] = [];

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.screenshot({ path: path.join(screenshotDir, 'home.png') });

    const links = await page.$$eval('a[href]', (els) => els.map((e) => (e as HTMLAnchorElement).href));
    const forms = await page.$$eval('form', (els) =>
      els.map((e) => ({
        action: (e as HTMLFormElement).action,
        method: (e as HTMLFormElement).method,
        inputs: Array.from(e.querySelectorAll('input')).map((i) => ({ name: i.name, type: i.type })),
      })),
    );

    findings.push(`URL: ${targetUrl}`);
    findings.push(`Title: ${await page.title()}`);
    findings.push(`Links found: ${links.length}`);
    findings.push(`Forms found: ${forms.length}`);
    for (const form of forms) {
      findings.push(`  Form: ${form.method} ${form.action} (${form.inputs.length} inputs)`);
    }
    for (const link of links.slice(0, 50)) {
      findings.push(`  Link: ${link}`);
    }

    const visited = new Set<string>([targetUrl]);
    for (const link of links) {
      if (visited.size >= 10) break;
      if (visited.has(link)) continue;
      if (!link.startsWith(targetUrl)) continue;
      try {
        visited.add(link);
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await page.screenshot({ path: path.join(screenshotDir, `page-${visited.size}.png`) });
        findings.push(`\n--- Page: ${link} ---`);
        findings.push(`Title: ${await page.title()}`);
        const pForms = await page.$$eval('form', (els) =>
          els.map((e) => ({
            action: (e as HTMLFormElement).action,
            method: (e as HTMLFormElement).method,
          })),
        );
        for (const f of pForms) {
          findings.push(`  Form: ${f.method} ${f.action}`);
        }
      } catch {
        // skip
      }
    }
  } catch (error) {
    findings.push(`Browser exploration error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(outputPath, findings.join('\n'));
  return outputPath;
}

export async function runApiMapping(params: ReconParams): Promise<string> {
  const { targetUrl, auditDir } = params;
  const outputPath = path.join(auditDir, 'api-mapping.txt');
  const findings: string[] = [];
  const url = new URL(targetUrl);

  const apiPaths = [
    '/api',
    '/api/v1',
    '/api/v2',
    '/graphql',
    '/swagger.json',
    '/openapi.json',
    '/.well-known/openid-configuration',
    '/health',
    '/metrics',
    '/admin',
    '/api/health',
  ];

  for (const apiPath of apiPaths) {
    try {
      const testUrl = `${url.origin}${apiPath}`;
      const resp = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
      const status = resp.status;
      const contentType = resp.headers.get('content-type') ?? '';
      const body = await resp.text().catch(() => '');
      findings.push(`${testUrl} -> ${status} [${contentType}]`);
      if (body.length > 0 && body.length < 500) {
        findings.push(`  Response: ${body.slice(0, 200)}`);
      }
    } catch {
      findings.push(`${url.origin}${apiPath} -> error/timeout`);
    }
  }

  fs.writeFileSync(outputPath, findings.join('\n'));
  return outputPath;
}
