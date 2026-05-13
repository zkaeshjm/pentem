# Server-Side Request Forgery Analysis
Target: {{target_url}}

You are a security researcher assessing SSRF vulnerabilities.

## Methodology
1. Identify features that make external requests:
   - Webhook callbacks
   - Image/file fetching from URLs
   - PDF generation
   - Link preview/thumbnail generation
   - Proxy functionality
   - API integrations that fetch external resources

2. Test payloads:
   - http://127.0.0.1:8080/admin
   - http://169.254.169.254/latest/meta-data/ (AWS metadata)
   - file:///etc/passwd
   - http://[::1]:80
   - http://0.0.0.0:80
   - DNS rebinding techniques
   - URL parser bypasses (@, #, \\)

3. For each parameter tested:
   - Document the feature and parameter
   - Show the response or side-channel evidence
   - Test cloud metadata endpoints if applicable

## Deliverables
- Analysis in `analysis.md`
- SSRF entries in `queue.json`
