import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult, PluginManifest } from '@internal/pentem-shared';

const manifest: PluginManifest = {
  name: 'email-notification',
  version: '1.0.0',
  description: 'Send scan notifications via email (SMTP)',
  type: 'notification',
  hooks: ['after-scan', 'on-error'],
  configSchema: {
    smtpHost: { type: 'string', required: true },
    smtpPort: { type: 'number', default: 587 },
    smtpSecure: { type: 'boolean', default: false },
    username: { type: 'string', required: false },
    password: { type: 'string', required: false },
    from: { type: 'string', required: true },
    to: { type: 'string', required: true },
  },
};

function buildEmailBody(ctx: PluginContext, hook: string): string {
  const findings = ctx.findings as Array<{ type: string; severity: string; description: string; url: string }>;
  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');
  const medium = findings.filter((f) => f.severity === 'medium');
  const low = findings.filter((f) => f.severity === 'low');

  let body = `Pentem Security Scan - ${hook === 'on-error' ? 'ERROR' : 'COMPLETE'}\n\n`;
  body += `Target: ${ctx.targetUrl}\n`;
  body += `Scan ID: ${ctx.scanId}\n`;
  body += `Date: ${new Date().toISOString()}\n\n`;
  body += 'Findings Summary:\n';
  body += `  Critical: ${critical.length}\n`;
  body += `  High: ${high.length}\n`;
  body += `  Medium: ${medium.length}\n`;
  body += `  Low: ${low.length}\n`;
  body += `  Total: ${findings.length}\n\n`;

  if (critical.length > 0) {
    body += 'Top Critical Findings:\n';
    for (const f of critical.slice(0, 5)) {
      body += `  - [${f.severity}] ${f.description} (${f.url})\n`;
    }
    body += '\n';
  }

  return body;
}

export function createEmailPlugin(_config?: Record<string, unknown>): PentemPlugin {
  return {
    manifest,
    async init(_ctx: PluginContext): Promise<void> {},
    async execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult> {
      const ctx = data as PluginContext;
      const smtpHost = (ctx.config?.smtpHost || process.env.SMTP_HOST || '') as string;
      if (!smtpHost) return {};

      const smtpPort = (ctx.config?.smtpPort as number) || 587;
      const smtpSecure = (ctx.config?.smtpSecure as boolean) || false;
      const username = (ctx.config?.username || process.env.SMTP_USERNAME || '') as string;
      const password = (ctx.config?.password || process.env.SMTP_PASSWORD || '') as string;
      const from = (ctx.config?.from || process.env.SMTP_FROM || '') as string;
      const to = (ctx.config?.to || process.env.SMTP_TO || '') as string;

      if (!from || !to) {
        return {
          notifications: [{ type: 'email-error', message: 'Email plugin requires from/to addresses', level: 'error' }],
        };
      }

      try {
        let nodemailerMod: unknown;
        try {
          nodemailerMod = await import('nodemailer');
        } catch {
          return {
            notifications: [
              { type: 'email-error', message: 'nodemailer not installed. Run: npm install nodemailer', level: 'error' },
            ],
          };
        }

        if (!nodemailerMod) return {};
        const nm = nodemailerMod as {
          createTransport: (opts: Record<string, unknown>) => {
            sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
          };
        };

        const transporter = nm.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          ...(username ? { auth: { user: username, pass: password } } : {}),
        });

        const subject = `Pentem Scan ${hook === 'on-error' ? 'Error' : 'Complete'} - ${ctx.targetUrl}`;
        const text = buildEmailBody(ctx, hook);

        await transporter.sendMail({ from, to, subject, text });

        return { notifications: [{ type: 'email', message: `Email sent to ${to}`, level: 'info' }] };
      } catch (err) {
        return { notifications: [{ type: 'email-error', message: `Email failed: ${err}`, level: 'error' }] };
      }
    },
  };
}
