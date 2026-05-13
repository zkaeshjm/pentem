import * as fs from 'node:fs';
import * as path from 'node:path';

const PROMPTS_BASE = process.env.SHANNON_PROMPTS_DIR ?? '/prompts';

export function loadPrompt(agentType: string, category: 'vuln' | 'exploit' | 'pre-recon' | 'recon'): string {
  let relativePath: string;
  if (category === 'pre-recon') {
    relativePath = `pre-recon/${agentType}.md`;
  } else if (category === 'recon') {
    relativePath = `recon/${agentType}.md`;
  } else if (category === 'vuln') {
    relativePath = `vuln/${agentType}.md`;
  } else {
    relativePath = `exploit/${agentType}.md`;
  }
  const fullPath = path.join(PROMPTS_BASE, relativePath);
  if (!fs.existsSync(fullPath)) {
    return getDefaultPrompt(agentType, category);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

export function loadPartial(name: string): string {
  const partialPath = path.join(PROMPTS_BASE, 'partials', `${name}.md`);
  if (!fs.existsSync(partialPath)) {
    return '';
  }
  return fs.readFileSync(partialPath, 'utf-8');
}

export function substituteVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function renderLoginPartials(authConfig: Record<string, unknown> | undefined): string {
  if (!authConfig || !authConfig.type) return '';
  const type = authConfig.type as string;
  let partial: string;
  switch (type) {
    case 'form':
      partial = loadPartial('login-form');
      break;
    case 'sso':
      partial = loadPartial('login-sso');
      break;
    case 'apikey':
      partial = loadPartial('login-apikey');
      break;
    case 'basic':
      partial = loadPartial('login-basic');
      break;
    default:
      return '';
  }
  return substituteVars(partial, {
    username: (authConfig.username as string) ?? '',
    password: (authConfig.password as string) ?? '',
    login_url: (authConfig.loginUrl as string) ?? '',
    api_key_header: (authConfig.apiKeyHeader as string) ?? '',
    api_key_value: (authConfig.apiKeyValue as string) ?? '',
  });
}

function getDefaultPrompt(agentType: string, category: string): string {
  const key = `${category}-${agentType}`;
  const prompts: Record<string, string> = {
    // Vulnerability prompts
    'vuln-sqli': `# SQL Injection Vulnerability Analysis
Target: {{target_url}}

Analyze the target application for SQL injection vulnerabilities. SQL injection occurs when user input is improperly sanitized before being used in SQL queries, allowing an attacker to manipulate database queries.

## Instructions
1. Navigate to the target application using the browser
2. Identify all input vectors: form fields, URL query parameters, API endpoints, HTTP headers, and cookies
3. For each input vector, test with SQL injection payloads:
   - Single quote: ' or 1=1 --
   - Boolean-based: ' OR '1'='1
   - Time-based: ' WAITFOR DELAY '0:0:5'--
   - UNION-based: ' UNION SELECT NULL,NULL--
4. Observe response behavior: error messages, timing differences, content changes
5. Document all vulnerable endpoints with proof-of-concept evidence

{{login_instructions}}

{{config_context}}

## Output Requirements
- Provide a detailed analysis file (analysis.md) with:
  - All tested input vectors and their SQL injection status
  - Vulnerable endpoints with step-by-step reproduction
  - Database fingerprinting results
  - Recommended exploitation strategy
- Provide an exploitation queue (queue.json) listing all confirmed vulnerabilities with priority ratings`,

    'vuln-xss': `# Cross-Site Scripting (XSS) Vulnerability Analysis
Target: {{target_url}}

Analyze the target application for Cross-Site Scripting (XSS) vulnerabilities. XSS occurs when user input is reflected or stored without proper sanitization, allowing injection of malicious scripts.

## Instructions
1. Navigate to the target application using the browser
2. Identify all input vectors: form fields, URL parameters, search bars, comment sections, file uploads
3. Test each vector with XSS payloads:
   - Reflected: <script>alert(1)</script>, <img src=x onerror=alert(1)>
   - Stored: Submit payloads that persist across sessions
   - DOM-based: Test client-side rendering sinks
4. Verify execution context (HTML context, attribute context, JavaScript context)
5. Document all vulnerable endpoints with proof-of-concept evidence

{{login_instructions}}

{{config_context}}

## Output Requirements
- Provide a detailed analysis file (analysis.md) with:
  - All tested input vectors and their XSS status
  - Vulnerable endpoints with step-by-step reproduction
  - XSS type classification (reflected/stored/DOM)
  - Context and bypass techniques used
  - Recommended exploitation strategy
- Provide an exploitation queue (queue.json) listing all confirmed vulnerabilities with priority ratings`,

    'vuln-auth-bypass': `# Authentication Bypass Analysis
Target: {{target_url}}

Analyze the target application for authentication bypass vulnerabilities. Test for weaknesses in authentication mechanisms that could allow unauthorized access.

## Instructions
1. Navigate to the target application and identify authentication mechanisms
2. Test for common bypass techniques:
   - Direct page access (forced browsing)
   - Parameter tampering (role=admin, isAdmin=true)
   - Cookie manipulation
   - JWT attacks (none algorithm, weak secret, token forgery)
   - Session fixation
   - Race conditions in login
3. Test password reset flows, multi-factor authentication, and OAuth implementations
4. Document all bypass techniques with proof-of-concept evidence

{{login_instructions}}

{{config_context}}

## Output Requirements
- Provide a detailed analysis file (analysis.md) with:
  - Authentication mechanisms identified
  - All tested bypass techniques and results
  - Confirmed vulnerabilities with reproduction steps
  - Risk assessment of each finding
  - Recommended exploitation strategy
- Provide an exploitation queue (queue.json) listing all confirmed vulnerabilities with priority ratings`,

    'vuln-authz-bypass': `# Authorization Bypass Analysis
Target: {{target_url}}

Analyze the target application for authorization bypass vulnerabilities. Test for weaknesses in access control that allow privilege escalation or accessing unauthorized resources.

## Instructions
1. Map the application's access control boundaries
2. Test for privilege escalation:
   - Horizontal: Access other users' data by modifying identifiers
   - Vertical: Access admin functionality as a regular user
3. Test IDOR (Insecure Direct Object Reference) vulnerabilities
4. Test for missing function-level access controls
5. Test HTTP method tampering (GET vs POST vs PUT vs DELETE)
6. Test mass assignment vulnerabilities
7. Document all authorization issues with proof-of-concept evidence

{{login_instructions}}

{{config_context}}

## Output Requirements
- Provide a detailed analysis file (analysis.md) with:
  - Access control boundaries mapped
  - All tested privilege escalation vectors and results
  - Confirmed vulnerabilities with reproduction steps
  - Risk assessment of each finding
  - Recommended exploitation strategy
- Provide an exploitation queue (queue.json) listing all confirmed vulnerabilities with priority ratings`,

    'vuln-ssrf': `# Server-Side Request Forgery (SSRF) Analysis
Target: {{target_url}}

Analyze the target application for Server-Side Request Forgery (SSRF) vulnerabilities. SSRF occurs when an application fetches remote resources based on user input without proper validation.

## Instructions
1. Identify features that fetch remote resources:
   - Webhook integrations
   - URL/file import features
   - Image/profile picture fetching
   - Document/PDF generation
   - API proxy functionality
2. Test with internal addresses:
   - 127.0.0.1, localhost, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
   - Cloud metadata endpoints: 169.254.169.254
   - Internal service discovery
3. Test protocol smuggling (file://, gopher://, dict://)
4. Test blind SSRF detection using external callback services
5. Document all SSRF vectors with proof-of-concept evidence

{{login_instructions}}

{{config_context}}

## Output Requirements
- Provide a detailed analysis file (analysis.md) with:
  - All remote resource fetching functionality identified
  - Tested SSRF vectors and results
  - Confirmed vulnerabilities with reproduction steps
  - Blind SSRF detection results
  - Recommended exploitation strategy
- Provide an exploitation queue (queue.json) listing all confirmed vulnerabilities with priority ratings`,

    // Exploit prompts
    'exploit-sqli': `# SQL Injection Exploitation
Target: {{target_url}}

Using the vulnerability analysis below, develop and execute proof-of-concept exploits for confirmed SQL injection vulnerabilities.

## Instructions
1. Review the vulnerability analysis results for confirmed SQLi endpoints
2. For each vulnerable endpoint:
   - Determine the database type (MySQL, PostgreSQL, MSSQL, Oracle, SQLite)
   - Extract database schema (tables, columns)
   - Extract sensitive data (credentials, PII, business data)
   - Attempt to write webshells or gain OS access (if applicable)
3. Document each exploit with:
   - Exact payloads used
   - Data extracted
   - Screenshots/captures of successful exploitation
   - Impact assessment

{{login_instructions}}

{{config_context}}

{{vuln_analysis}}

## Output Requirements
- Provide an exploitation report (analysis.md) with:
  - Exploited vulnerabilities and techniques used
  - Full extracted data
  - Exploit payloads and automation scripts
  - Impact assessment
  - Remediation recommendations
- Provide updated exploitation queue (queue.json) with exploitation status`,

    'exploit-xss': `# Cross-Site Scripting (XSS) Exploitation
Target: {{target_url}}

Using the vulnerability analysis below, develop and execute proof-of-concept exploits for confirmed XSS vulnerabilities.

## Instructions
1. Review the vulnerability analysis results for confirmed XSS endpoints
2. For each vulnerable endpoint:
   - Determine the XSS type and execution context
   - Craft advanced payloads that bypass filters
   - Demonstrate impact: cookie theft, session hijacking, keylogging, CSRF token theft, page defacement
   - For stored XSS: create persistent proof-of-concept
3. Document each exploit with:
   - Exact payloads used
   - Impact demonstrated
   - Screenshots of successful exploitation
   - Risk assessment

{{login_instructions}}

{{config_context}}

{{vuln_analysis}}

## Output Requirements
- Provide an exploitation report (analysis.md) with:
  - Exploited vulnerabilities and techniques used
  - Advanced payloads and bypass techniques
  - Impact demonstrations
  - Remediation recommendations
- Provide updated exploitation queue (queue.json) with exploitation status`,

    'exploit-auth-bypass': `# Authentication Bypass Exploitation
Target: {{target_url}}

Using the vulnerability analysis below, develop and execute proof-of-concept exploits for confirmed authentication bypass vulnerabilities.

## Instructions
1. Review the vulnerability analysis results for confirmed auth bypass vectors
2. For each bypass technique:
   - Develop working exploit scripts
   - Demonstrate unauthorized access to protected resources
   - If possible, escalate to account takeover
   - Document the full attack chain
3. Document each exploit with:
   - Exact requests/scripts used
   - Screenshots of successful bypass
   - Impact assessment

{{login_instructions}}

{{config_context}}

{{vuln_analysis}}

## Output Requirements
- Provide an exploitation report (analysis.md) with:
  - Exploited vulnerabilities and attack chain
  - Working exploit scripts
  - Impact demonstration
  - Remediation recommendations
- Provide updated exploitation queue (queue.json) with exploitation status`,

    'exploit-authz-bypass': `# Authorization Bypass Exploitation
Target: {{target_url}}

Using the vulnerability analysis below, develop and execute proof-of-concept exploits for confirmed authorization bypass vulnerabilities.

## Instructions
1. Review the vulnerability analysis results for confirmed authz bypass vectors
2. For each bypass technique:
   - Develop working exploit scripts demonstrating privilege escalation
   - Access unauthorized resources or data
   - If possible, chain multiple vulnerabilities for greater impact
   - Document the full attack chain
3. Document each exploit with:
   - Exact requests/scripts used
   - Screenshots of unauthorized access
   - Impact assessment

{{login_instructions}}

{{config_context}}

{{vuln_analysis}}

## Output Requirements
- Provide an exploitation report (analysis.md) with:
  - Exploited vulnerabilities and techniques used
  - Working exploit scripts
  - Impact demonstration
  - Remediation recommendations
- Provide updated exploitation queue (queue.json) with exploitation status`,

    'exploit-ssrf': `# Server-Side Request Forgery (SSRF) Exploitation
Target: {{target_url}}

Using the vulnerability analysis below, develop and execute proof-of-concept exploits for confirmed SSRF vulnerabilities.

## Instructions
1. Review the vulnerability analysis results for confirmed SSRF vectors
2. For each SSRF vector:
   - Access internal services and metadata endpoints
   - Attempt to read internal files using file:// protocol
   - Test for blind SSRF callbacks
   - Attempt RCE via internal service interaction
   - Chain SSRF with other vulnerabilities for greater impact
3. Document each exploit with:
   - Exact payloads used
   - Internal resources accessed
   - Screenshots/captures of successful exploitation
   - Impact assessment

{{login_instructions}}

{{config_context}}

{{vuln_analysis}}

## Output Requirements
- Provide an exploitation report (analysis.md) with:
  - Exploited vulnerabilities and techniques used
  - Internal resources accessed
  - Data extracted from internal services
  - Impact assessment
  - Remediation recommendations
- Provide updated exploitation queue (queue.json) with exploitation status`,
  };
  return (
    prompts[key] ??
    `# ${category} Analysis for ${agentType}\nTarget: {{target_url}}\n\n{{login_instructions}}\n\n{{config_context}}\n`
  );
}
