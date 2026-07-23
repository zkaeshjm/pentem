import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AuthSession {
  cookies: Array<{ name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean }>;
  headers: Record<string, string>;
  tokens: Record<string, string>;
  loggedInAt: string | null;
  expiresAt: string | null;
  loginMethod: 'form' | 'sso' | 'apikey' | 'basic' | null;
}

export class AuthSessionManager {
  private session: AuthSession;
  private readonly persistPath: string | null;

  constructor(persistPath?: string) {
    this.session = this.createEmpty();
    this.persistPath = persistPath ?? null;
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      this.load();
    }
  }

  private createEmpty(): AuthSession {
    return {
      cookies: [],
      headers: {},
      tokens: {},
      loggedInAt: null,
      expiresAt: null,
      loginMethod: null,
    };
  }

  setCookie(cookie: {
    name: string;
    value: string;
    domain: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
  }): void {
    const existing = this.session.cookies.findIndex((c) => c.name === cookie.name && c.domain === cookie.domain);
    const entry = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path ?? '/',
      secure: cookie.secure ?? false,
      httpOnly: cookie.httpOnly ?? false,
    };
    if (existing >= 0) {
      this.session.cookies[existing] = entry;
    } else {
      this.session.cookies.push(entry);
    }
    this.persist();
  }

  setHeader(key: string, value: string): void {
    this.session.headers[key] = value;
    this.persist();
  }

  setToken(service: string, token: string): void {
    this.session.tokens[service] = token;
    this.persist();
  }

  setLoginMethod(method: 'form' | 'sso' | 'apikey' | 'basic'): void {
    this.session.loginMethod = method;
    this.session.loggedInAt = new Date().toISOString();
    this.persist();
  }

  getCookieHeader(domain: string): string {
    return this.session.cookies
      .filter((c) => domain.endsWith(c.domain) || c.domain.endsWith(domain))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.session.headers };
    for (const [service, token] of Object.entries(this.session.tokens)) {
      if (service === 'bearer') {
        headers.Authorization = `Bearer ${token}`;
      } else if (service === 'apikey') {
        headers['X-API-Key'] = token;
      }
    }
    return headers;
  }

  applyToHeaders(headers: Record<string, string>, targetDomain: string): Record<string, string> {
    const result = { ...headers };
    const cookieStr = this.getCookieHeader(targetDomain);
    if (cookieStr) {
      result.Cookie = cookieStr;
    }
    const authHeaders = this.getAuthHeaders();
    for (const [key, value] of Object.entries(authHeaders)) {
      result[key] = value;
    }
    return result;
  }

  isLoggedIn(): boolean {
    if (!this.session.loggedInAt) return false;
    if (this.session.expiresAt && new Date(this.session.expiresAt) < new Date()) return false;
    return true;
  }

  getSession(): AuthSession {
    return { ...this.session };
  }

  clear(): void {
    this.session = this.createEmpty();
    this.persist();
  }

  private persist(): void {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.session, null, 2));
    fs.renameSync(tmp, this.persistPath);
  }

  private load(): void {
    if (!this.persistPath) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.session = { ...this.createEmpty(), ...data };
    } catch {
      this.session = this.createEmpty();
    }
  }
}
