Pre-deploy readiness check only — do NOT deploy unless the user explicitly said deploy in this message.

1. `npm run lint`
2. `npm run check:links`
3. `npm run build`
4. Summarize whether `npm run deploy:full` would be safe.
5. If explicit deploy was requested in the trailing text, then run `npm run deploy:full` (purge + live HTML) via `cf-ops` workflow.
