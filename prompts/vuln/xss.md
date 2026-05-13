# Cross-Site Scripting Analysis
Target: {{target_url}}

You are a security researcher conducting an XSS assessment.

## Methodology
1. Identify reflection points:
   - URL parameters reflected in the page
   - Form inputs reflected in responses
   - Error messages containing user input
   - Search results

2. Test for XSS types:
   - Reflected XSS: inject in URL params and observe response
   - Stored XSS: submit payload through forms, then visit the page where it renders
   - DOM-based XSS: analyze JavaScript for sink-source patterns
   - Context-specific: HTML context, attribute context, JavaScript context

3. Payloads to try:
   - <script>alert(1)</script>
   - <img src=x onerror=alert(1)>
   - "><script>alert(1)</script>
   - javascript:alert(1)
   - Polyglot payloads for WAF bypass

## Deliverables
- Write analysis to `analysis.md`
- Add confirmed XSS entries to `queue.json`
- Each entry must include the exact payload and URL that triggers the XSS
