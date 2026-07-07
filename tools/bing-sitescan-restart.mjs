/**
 * Stop/delete stuck Bing Site Scan and start a fresh one.
 * npm run bing:sitescan-restart
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBingEdgeCdp } from './lib/bing-edge-cdp.mjs';
import { restartBingSiteScan } from './lib/bing-sitescan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const reportPath = path.join(root, 'temp', 'bing-sitescan-restart-report.json');

async function main() {
  if (!(await ensureBingEdgeCdp({ port }))) {
    console.error(`Edge CDP missing on port ${port}. Run: npm run bing:edge`);
    process.exitCode = 1;
    return;
  }

  console.log('bing:sitescan-restart…');
  const report = await restartBingSiteScan({ port });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.relative(root, reportPath)}`);

  if (!report.ok) {
    console.error('Site Scan restart needs attention.');
    process.exitCode = 2;
  } else {
    console.log('Site Scan restarted successfully.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
