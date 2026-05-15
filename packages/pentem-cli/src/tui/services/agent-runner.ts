import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProviderConfig } from '../../providers.ts';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: string;
}

export interface AgentProgress {
  phase: string;
  agent: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  percent?: number;
}

function readPromptFile(name: string): string {
  const promptsDir = process.env.PENTEM_PROMPTS_DIR || path.resolve(process.cwd(), 'prompts');
  const promptPath = path.join(promptsDir, name);
  if (fs.existsSync(promptPath)) {
    return fs.readFileSync(promptPath, 'utf-8');
  }
  return '';
}

export class AgentRunner extends EventEmitter {
  private provider: ProviderConfig;

  constructor(provider: ProviderConfig) {
    super();
    this.provider = provider;
  }

  onProgress(cb: (progress: AgentProgress) => void): void {
    this.on('progress', cb);
  }

  private emitProgress(
    phase: string,
    agent: string,
    status: AgentProgress['status'],
    message: string,
    percent?: number,
  ): void {
    this.emit('progress', { phase, agent, status, message, percent } as AgentProgress);
  }

  async runAgent(
    agentType: string,
    category: string,
    targetUrl: string,
    context: string,
    outputDir: string,
  ): Promise<{ analysis: string; queue: string }> {
    this.emitProgress(category, agentType, 'started', `Starting ${category} ${agentType} analysis...`, 0);

    const fsDir = path.join(outputDir, `${category}-${agentType}`, 'deliverables');
    fs.mkdirSync(fsDir, { recursive: true });

    const promptPath = `${category}/${agentType}.md`;
    let userContent = readPromptFile(promptPath);
    if (!userContent) {
      userContent = this.getDefaultPrompt(agentType, category);
    }
    userContent = userContent
      .replaceAll('{{target_url}}', targetUrl)
      .replaceAll('{{config_context}}', context)
      .replaceAll('{{login_instructions}}', '')
      .replaceAll('{{vuln_analysis}}', context.includes('vuln_analysis') ? context : '');

    const systemPrompt = `You are Pentem, an autonomous penetration testing AI.
Your task is to analyze the target URL ${targetUrl} for security vulnerabilities.
Use the fetch_url tool to probe endpoints, analyze responses, and identify vulnerabilities.
Always think step by step. First explore, then analyze, then report.`;

    if (this.provider.type === 'openai' || this.provider.type === 'openai-compatible') {
      return this.runOpenAIAgent(agentType, category, targetUrl, systemPrompt, userContent, fsDir);
    }
    return this.runAnthropicAgent(agentType, category, targetUrl, systemPrompt, userContent, fsDir);
  }

  private async runOpenAIAgent(
    agentType: string,
    category: string,
    targetUrl: string,
    systemPrompt: string,
    userContent: string,
    fsDir: string,
  ): Promise<{ analysis: string; queue: string }> {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: this.provider.apiKey,
      baseURL: this.provider.baseUrl,
    });

    const model = this.provider.model ?? 'gpt-4o';
    const maxTurns = 25;
    const tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }> = [
      {
        type: 'function',
        function: {
          name: 'fetch_url',
          description: 'Make an HTTP request to a URL',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to fetch' },
              method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
              headers: {
                type: 'object',
                description: 'Optional HTTP headers',
                additionalProperties: { type: 'string' },
              },
              body: { type: 'string', description: 'Request body for POST/PUT' },
            },
            required: ['url'],
          },
        },
      },
    ];

    const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> =
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

    let analysis = '';
    const findings: string[] = [];

    for (let turn = 0; turn < maxTurns; turn++) {
      this.emitProgress(
        category,
        agentType,
        'progress',
        `Analysis turn ${turn + 1}/${maxTurns}...`,
        Math.round(((turn + 1) / maxTurns) * 80),
      );

      const response = await openai.chat.completions.create({
        model,
        messages: messages as Array<{
          role: 'system' | 'user' | 'assistant' | 'tool';
          content: string;
          tool_call_id?: string;
        }>,
        tools,
        tool_choice: 'auto',
        max_tokens: 4000,
      });

      const choice = response.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content || '' });

        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'fetch_url') {
            const args = JSON.parse(tc.function.arguments);
            const result = await this.executeFetch(args);
            findings.push(`[${args.method ?? 'GET'}] ${args.url}: ${result.status}`);
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }
      } else {
        messages.push({ role: 'assistant', content: msg.content || '' });
        analysis = msg.content || '';
        break;
      }
    }

    const reportContent = this.formatReport(agentType, category, targetUrl, analysis, findings);
    const analysisPath = path.join(fsDir, 'analysis.md');
    fs.writeFileSync(analysisPath, reportContent, 'utf-8');

    const queuePath = path.join(fsDir, 'queue.json');
    const queue = {
      agent: agentType,
      category,
      targetUrl,
      findings,
      severity: findings.length > 0 ? 'medium' : 'none',
      completedAt: new Date().toISOString(),
    };
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf-8');

    this.emitProgress(category, agentType, 'completed', `${category} ${agentType} analysis complete`, 100);
    return { analysis: analysisPath, queue: queuePath };
  }

  private async runAnthropicAgent(
    agentType: string,
    category: string,
    targetUrl: string,
    systemPrompt: string,
    userContent: string,
    fsDir: string,
  ): Promise<{ analysis: string; queue: string }> {
    const anthropicKey = this.provider.apiKey || process.env.ANTHROPIC_API_KEY;
    const baseUrl = this.provider.baseUrl || 'https://api.anthropic.com/v1';
    const model = this.provider.model ?? 'claude-sonnet-4-20250514';

    const tools = [
      {
        name: 'fetch_url',
        description: 'Make an HTTP request to a URL',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to fetch' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            headers: { type: 'object', description: 'Optional HTTP headers' },
            body: { type: 'string', description: 'Request body for POST/PUT' },
          },
          required: ['url'],
        },
      },
    ];

    const messages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<{ type: string; [key: string]: unknown }>;
    }> = [{ role: 'user', content: userContent }];

    let analysis = '';
    const findings: string[] = [];

    for (let turn = 0; turn < 25; turn++) {
      this.emitProgress(
        category,
        agentType,
        'progress',
        `Analysis turn ${turn + 1}/25...`,
        Math.round(((turn + 1) / 25) * 80),
      );

      const body = {
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages,
        tools,
        tool_choice: { type: 'auto' } as const,
      };

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>;
        stop_reason: string;
      };

      const contentBlock = data.content;
      let hasToolUse = false;

      for (const block of contentBlock) {
        if (block.type === 'text' && block.text) {
          analysis += block.text;
          messages.push({ role: 'assistant', content: block.text });
        } else if (block.type === 'tool_use' && block.name === 'fetch_url') {
          hasToolUse = true;
          const result = await this.executeFetch(block.input as Record<string, unknown>);
          const inputMethod = block.input?.method as string | undefined;
          const inputUrl = block.input?.url as string | undefined;
          findings.push(`[${inputMethod ?? 'GET'}] ${inputUrl ?? '?'}: ${result.status}`);
          messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) }],
          });
        }
      }

      if (!hasToolUse) break;
    }

    const reportContent = this.formatReport(agentType, category, targetUrl, analysis, findings);
    const analysisPath = path.join(fsDir, 'analysis.md');
    fs.writeFileSync(analysisPath, reportContent, 'utf-8');

    const queuePath = path.join(fsDir, 'queue.json');
    const queue = {
      agent: agentType,
      category,
      targetUrl,
      findings,
      severity: findings.length > 0 ? 'medium' : 'none',
      completedAt: new Date().toISOString(),
    };
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf-8');

    this.emitProgress(category, agentType, 'completed', `${category} ${agentType} analysis complete`, 100);
    return { analysis: analysisPath, queue: queuePath };
  }

  private async executeFetch(
    args: Record<string, unknown>,
  ): Promise<{ status: number; headers: Record<string, string>; body: string; error?: string }> {
    const url = args.url as string;
    const method = (args.method as string) || 'GET';
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string | undefined;

    try {
      const fetchOpts: RequestInit = { method, headers: { 'User-Agent': 'Pentem-Scanner/1.0', ...headers } };
      if (body && method !== 'GET') fetchOpts.body = body;

      const resp = await fetch(url, fetchOpts);
      const respHeaders: Record<string, string> = {};
      resp.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });

      const text = await resp.text();
      const truncated = text.length > 10000 ? `${text.slice(0, 10000)}\n... [truncated]` : text;

      return { status: resp.status, headers: respHeaders, body: truncated };
    } catch (err) {
      return {
        status: 0,
        headers: {},
        body: '',
        error: `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private formatReport(
    agentType: string,
    category: string,
    targetUrl: string,
    analysis: string,
    findings: string[],
  ): string {
    const lines = [
      `# ${category.toUpperCase()} - ${agentType.toUpperCase()}`,
      `**Target:** ${targetUrl}`,
      `**Date:** ${new Date().toISOString()}`,
      '',
      '## Summary',
      `Analyzed ${findings.length} endpoints/methods`,
      '',
      '## Findings',
      ...(findings.length === 0 ? ['No specific findings detected.'] : findings.map((f) => `- ${f}`)),
      '',
      '## Analysis',
      analysis || 'Analysis was not completed.',
      '',
      '---',
      '*Generated by Pentem AI Agent*',
    ];
    return lines.join('\n');
  }

  private getDefaultPrompt(agentType: string, category: string): string {
    const prompts: Record<string, string> = {
      'vuln-sqli': `Analyze ${'{{target_url}}'} for SQL injection vulnerabilities.
Look for input fields, URL parameters, and API endpoints that might be vulnerable.
Test with common SQLi payloads and analyze responses for error messages or behavioral changes.`,
      'vuln-xss': `Analyze ${'{{target_url}}'} for Cross-Site Scripting (XSS) vulnerabilities.
Look for input fields, URL parameters, and reflection points.
Test with common XSS payloads and check for script execution.`,
      'vuln-auth-bypass': `Analyze ${'{{target_url}}'} for authentication bypass vulnerabilities.
Check login pages, session handling, password reset flows, and access controls.`,
      'vuln-authz-bypass': `Analyze ${'{{target_url}}'} for authorization bypass vulnerabilities.
Test for IDOR, privilege escalation, and missing access controls.`,
      'vuln-ssrf': `Analyze ${'{{target_url}}'} for Server-Side Request Forgery (SSRF) vulnerabilities.
Look for features that fetch remote resources, webhooks, or URL imports.`,
      'exploit-sqli': `Exploit confirmed SQL injection vulnerabilities at ${'{{target_url}}'}.
Extract data, enumerate the database, and document findings.`,
      'exploit-xss': `Exploit confirmed XSS vulnerabilities at ${'{{target_url}}'}.
Develop proof-of-concept payloads demonstrating impact.`,
      'exploit-auth-bypass': `Exploit confirmed authentication bypass vulnerabilities at ${'{{target_url}}'}.
Demonstrate unauthorized access to protected resources.`,
      'exploit-authz-bypass': `Exploit confirmed authorization bypass vulnerabilities at ${'{{target_url}}'}.
Demonstrate privilege escalation or unauthorized data access.`,
      'exploit-ssrf': `Exploit confirmed SSRF vulnerabilities at ${'{{target_url}}'}.
Access internal services and extract sensitive information.`,
    };
    return (
      prompts[`${category}-${agentType}`] ||
      `Analyze ${'{{target_url}}'} for security vulnerabilities in the ${agentType} category.`
    );
  }
}
