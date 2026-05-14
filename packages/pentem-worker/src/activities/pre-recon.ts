import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PreReconParams {
  targetUrl: string;
  auditDir: string;
}

export async function runNmapScan(params: PreReconParams): Promise<string> {
  const { targetUrl, auditDir } = params;
  const url = new URL(targetUrl);
  const host = url.hostname;
  const outputPath = path.join(auditDir, 'nmap-results.txt');

  try {
    const result = execSync(`nmap -sV -sC -p 80,443,8080,8443 ${host}`, {
      timeout: 300_000,
      encoding: 'utf-8',
    });
    fs.writeFileSync(outputPath, result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(outputPath, `nmap failed: ${msg}`);
  }
  return outputPath;
}

export async function runSubfinder(params: PreReconParams): Promise<string> {
  const { targetUrl, auditDir } = params;
  const url = new URL(targetUrl);
  const domain = url.hostname;
  const outputPath = path.join(auditDir, 'subfinder-results.txt');

  try {
    const result = execSync(`subfinder -d ${domain} -silent`, {
      timeout: 120_000,
      encoding: 'utf-8',
    });
    fs.writeFileSync(outputPath, result);
  } catch {
    fs.writeFileSync(outputPath, 'subfinder not available or failed');
  }
  return outputPath;
}

export async function runWhatWeb(params: PreReconParams): Promise<string> {
  const { targetUrl, auditDir } = params;
  const outputPath = path.join(auditDir, 'whatweb-results.txt');

  try {
    const result = execSync(`whatweb ${targetUrl}`, {
      timeout: 120_000,
      encoding: 'utf-8',
    });
    fs.writeFileSync(outputPath, result);
  } catch {
    fs.writeFileSync(outputPath, 'whatweb not available or failed');
  }
  return outputPath;
}

export async function runSourceAnalysis(params: PreReconParams & { repoPath?: string }): Promise<string> {
  const { auditDir, repoPath } = params;
  const outputPath = path.join(auditDir, 'source-analysis.txt');

  if (!repoPath || !fs.existsSync(repoPath)) {
    fs.writeFileSync(outputPath, 'No source code path provided for analysis');
    return outputPath;
  }

  const rp: string = repoPath;
  const files: string[] = [];
  function walk(dir: string): void {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && /\.(js|ts|py|php|rb|java|go|rs)$/.test(entry.name)) {
          files.push(fullPath.replace(rp, ''));
        }
      }
    } catch {
      // permission denied, skip
    }
  }
  walk(rp);
  fs.writeFileSync(outputPath, `Source files found in ${rp}:\n${files.join('\n')}`);
  return outputPath;
}
