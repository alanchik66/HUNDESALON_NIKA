/**
 * Dashboard cleanup: create/keep one Automation token, delete junk duplicates.
 * npm run cf:cleanup-dashboard-tokens
 */
import { spawnSync } from 'node:child_process';

const child = spawnSync('node', ['tools/_cf-finalize.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
});

process.exit(child.status ?? 1);
