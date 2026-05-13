# Browser Exploration
Target: {{target_url}}

Use Playwright (via Bash: `node -e "..."` or `npx playwright`) to explore the target application.

Explore:
1. All pages and routes accessible from the landing page
2. Forms, search bars, and user input fields
3. API endpoints called by the frontend (check network requests)
4. JavaScript files and their embedded endpoints
5. Authentication and session mechanisms (cookies, tokens)
6. File upload functionality
7. Any functionality that makes external requests

For each finding, document:
- The URL or endpoint
- The type of interaction possible
- Request/response patterns
- Any interesting headers or parameters
