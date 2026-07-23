import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TeamConfig {
  teamName?: string;
  members?: Array<{ name: string; email?: string; role?: string }>;
  sharedWorkspace?: string;
  defaultNotify?: string[];
}

async function parseYamlConfig(content: string): Promise<Record<string, unknown>> {
  try {
    const yaml = await import('yaml');
    return yaml.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function loadTeamConfig(configPath?: string): Promise<TeamConfig | null> {
  const paths = configPath
    ? [configPath]
    : [
        path.resolve(process.cwd(), 'pentem.yaml'),
        path.resolve(process.cwd(), '.pentem.yaml'),
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.pentem', 'config.yaml'),
      ];

  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    try {
      const content = fs.readFileSync(p, 'utf-8');
      let parsed: Record<string, unknown>;
      if (p.endsWith('.json')) {
        parsed = JSON.parse(content);
      } else {
        parsed = await parseYamlConfig(content);
        if (Object.keys(parsed).length === 0) continue;
      }
      const team = parsed.team as TeamConfig | undefined;
      if (team) return team;
    } catch {}
  }
  return null;
}

export async function loadNotificationConfig(config?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const _team = await loadTeamConfig();
  const notifConfig: Record<string, unknown> = {};

  if (process.env.SLACK_WEBHOOK_URL) notifConfig['slack-notification'] = { webhookUrl: process.env.SLACK_WEBHOOK_URL };
  if (process.env.DISCORD_WEBHOOK_URL)
    notifConfig['discord-notification'] = { webhookUrl: process.env.DISCORD_WEBHOOK_URL };
  if (process.env.WEBHOOK_URL) notifConfig['webhook-notification'] = { url: process.env.WEBHOOK_URL };
  if (process.env.SMTP_HOST) {
    notifConfig['email-notification'] = {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: Number(process.env.SMTP_PORT) || 587,
      smtpSecure: process.env.SMTP_SECURE === 'true',
      username: process.env.SMTP_USERNAME,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_TO,
    };
  }

  if (config?.notifications && typeof config.notifications === 'object') {
    const nconfig = config.notifications as Record<string, unknown>;
    for (const [key, val] of Object.entries(nconfig)) {
      if (!notifConfig[key]) {
        notifConfig[key] = val;
      } else {
        Object.assign(notifConfig[key] as Record<string, unknown>, val as Record<string, unknown>);
      }
    }
  }

  return notifConfig;
}
