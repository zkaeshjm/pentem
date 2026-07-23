export interface ScopeConfig {
  allowedDomains?: string[];
  allowedPaths?: string[];
  excludedDomains?: string[];
  excludedPaths?: string[];
  allowedPorts?: number[];
  allowedSchemes?: string[];
  maxDepth?: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstSize: number;
  concurrency: number;
}

export interface SafetyConfig {
  dryRun: boolean;
  requireExploitApproval: boolean;
  maxRedirects: number;
  maxResponseSize: number;
  timeout: number;
  allowDestructiveActions: boolean;
}

export function validateUrlAgainstScope(
  url: string,
  baseUrl: string,
  scope: ScopeConfig,
): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);

    const scheme = parsed.protocol.replace(':', '');
    if (scope.allowedSchemes && !scope.allowedSchemes.includes(scheme)) {
      return { allowed: false, reason: `Scheme "${scheme}" not in allowed list` };
    }

    if (scope.excludedDomains) {
      for (const excluded of scope.excludedDomains) {
        if (parsed.hostname === excluded || parsed.hostname.endsWith(`.${excluded}`)) {
          return { allowed: false, reason: `Domain "${parsed.hostname}" is excluded` };
        }
      }
    }

    if (scope.allowedDomains) {
      const isAllowed = scope.allowedDomains.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
      if (!isAllowed) {
        return { allowed: false, reason: `Domain "${parsed.hostname}" not in allowed list` };
      }
    }

    if (parsed.hostname !== base.hostname && !parsed.hostname.endsWith(`.${base.hostname}`)) {
      if (!scope.allowedDomains || scope.allowedDomains.length === 0) {
        return { allowed: false, reason: `Domain "${parsed.hostname}" differs from base target` };
      }
    }

    if (scope.excludedPaths) {
      for (const excluded of scope.excludedPaths) {
        if (parsed.pathname.startsWith(excluded)) {
          return { allowed: false, reason: `Path "${parsed.pathname}" matches excluded path "${excluded}"` };
        }
      }
    }

    if (scope.allowedPaths) {
      const isAllowed = scope.allowedPaths.some((p) => parsed.pathname.startsWith(p));
      if (!isAllowed) {
        return { allowed: false, reason: `Path "${parsed.pathname}" not in allowed paths` };
      }
    }

    if (scope.allowedPorts) {
      const port = parsed.port ? Number.parseInt(parsed.port, 10) : scheme === 'https' ? 443 : 80;
      if (!scope.allowedPorts.includes(port)) {
        return { allowed: false, reason: `Port ${port} not in allowed list` };
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: `Invalid URL: ${url}` };
  }
}

export function computeScopeFromTarget(
  targetUrl: string,
  focus?: { include?: string[]; exclude?: string[] },
): ScopeConfig {
  try {
    const parsed = new URL(targetUrl);
    return {
      allowedDomains: [parsed.hostname],
      allowedPaths: focus?.include,
      excludedPaths: focus?.exclude,
      allowedPorts: parsed.port ? [Number.parseInt(parsed.port, 10)] : [80, 443],
      allowedSchemes: ['https', 'http'],
      maxDepth: 5,
    };
  } catch {
    return {};
  }
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 10,
  requestsPerMinute: 300,
  burstSize: 20,
  concurrency: 3,
};

export const DEFAULT_SAFETY: SafetyConfig = {
  dryRun: false,
  requireExploitApproval: true,
  maxRedirects: 10,
  maxResponseSize: 2 * 1024 * 1024,
  timeout: 30000,
  allowDestructiveActions: false,
};
