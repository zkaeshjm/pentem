import * as fs from 'node:fs';
import * as path from 'node:path';

interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  description: string;
  detail: string;
}

export interface CloudCheck {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: () => Promise<Finding | null>;
}

export function getAwsChecks(targetUrl: string): CloudCheck[] {
  const domain = extractDomain(targetUrl);
  return [
    {
      name: 'S3 Bucket DNS Resolution',
      description: 'Check if common S3 bucket names resolve',
      severity: 'medium',
      check: async () => {
        const bucketName = domain.replace(/[^a-z0-9.-]/g, '-').toLowerCase();
        const urls = [
          `https://${bucketName}.s3.amazonaws.com`,
          `https://s3.amazonaws.com/${bucketName}`,
          `https://${bucketName}.s3.${detectRegion(domain)}.amazonaws.com`,
        ];
        for (const url of urls) {
          try {
            const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (resp.status === 200) {
              return {
                type: 'cloud-insecure-config',
                severity: 'high',
                url,
                description: `S3 bucket "${bucketName}" is publicly accessible`,
                detail: `Bucket ${bucketName} returned HTTP ${resp.status} with headers: ${JSON.stringify(Array.from(resp.headers.entries()).slice(0, 5))}`,
              };
            }
            if (resp.status === 403) {
              return {
                type: 'cloud-insecure-config',
                severity: 'medium',
                url,
                description: `S3 bucket "${bucketName}" exists but access is denied (may be misconfigured)`,
                detail: `Bucket ${bucketName} returned HTTP 403 Forbidden`,
              };
            }
          } catch {}
        }
        return null;
      },
    },
    {
      name: 'CloudFront Distribution Check',
      description: 'Check if domain uses CloudFront',
      severity: 'low',
      check: async () => {
        try {
          const resp = await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          const server = resp.headers.get('Server');
          const via = resp.headers.get('Via');
          if (server?.includes('CloudFront') || via?.includes('CloudFront')) {
            return {
              type: 'information-disclosure',
              severity: 'low',
              url: `https://${domain}`,
              description: 'CloudFront CDN detected',
              detail: `Server: ${server}, Via: ${via}`,
            };
          }
        } catch {}
        return null;
      },
    },
    {
      name: 'AWS WAF Detection',
      description: 'Check if AWS WAF is protecting the application',
      severity: 'low',
      check: async () => {
        try {
          const resp = await fetch(`https://${domain}/?x=${'<script>'}`, { signal: AbortSignal.timeout(5000) });
          const xAmzReqId = resp.headers.get('x-amz-request-id');
          const xAmzId2 = resp.headers.get('x-amz-id-2');
          if (xAmzReqId || xAmzId2) {
            return {
              type: 'information-disclosure',
              severity: 'low',
              url: `https://${domain}`,
              description: 'AWS WAF or ALB detected',
              detail: `x-amz-request-id: ${xAmzReqId}, x-amz-id-2: ${xAmzId2}`,
            };
          }
        } catch {}
        return null;
      },
    },
  ];
}

export function getGcpChecks(targetUrl: string): CloudCheck[] {
  const domain = extractDomain(targetUrl);
  return [
    {
      name: 'GCP Bucket Discovery',
      description: 'Check for public GCP storage buckets',
      severity: 'medium',
      check: async () => {
        const bucketName = domain.replace(/[^a-z0-9.-]/g, '-').toLowerCase();
        const urls = [`https://storage.googleapis.com/${bucketName}`, `https://${bucketName}.storage.googleapis.com`];
        for (const url of urls) {
          try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (resp.ok) {
              const text = await resp.text();
              return {
                type: 'cloud-insecure-config',
                severity: 'high',
                url,
                description: `GCP Storage bucket "${bucketName}" is publicly accessible`,
                detail: `Bucket listing returned ${resp.status}. Content length: ${text.length}`,
              };
            }
          } catch {}
        }
        return null;
      },
    },
  ];
}

export function getAzureChecks(targetUrl: string): CloudCheck[] {
  const domain = extractDomain(targetUrl);
  return [
    {
      name: 'Azure Blob Discovery',
      description: 'Check for public Azure Blob storage containers',
      severity: 'medium',
      check: async () => {
        const accountName = domain
          .split('.')[0]
          ?.replace(/[^a-z0-9]/g, '')
          .toLowerCase();
        if (!accountName) return null;
        const urls = [
          `https://${accountName}.blob.core.windows.net`,
          `https://${accountName}.blob.core.windows.net/?restype=container&comp=list`,
        ];
        for (const url of urls) {
          try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (resp.ok || resp.status === 403) {
              return {
                type: 'cloud-insecure-config',
                severity: resp.ok ? 'high' : 'medium',
                url,
                description: `Azure Blob storage "${accountName}" ${resp.ok ? 'is publicly accessible' : 'exists but access denied'}`,
                detail: `HTTP ${resp.status} for account ${accountName}`,
              };
            }
          } catch {}
        }
        return null;
      },
    },
  ];
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function detectRegion(_domain: string): string {
  return 'us-east-1';
}
