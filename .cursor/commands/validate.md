Run the full local validation gate for HUNDESALON NIKA and fix only blockers you introduced if any.

1. Follow routing kernel; do not deploy or push.
2. Run: `npm run validate` (lint + links + project health + agents-routing).
3. If UI was touched and Playwright MCP is up, also smoke `de/index.html` + one other locale (or launch `ui-smoke` subagent).
4. Return short Passed / Failed / Verdict.
