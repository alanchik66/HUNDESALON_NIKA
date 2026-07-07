/**
 * Quick Bing Site Scan status (no polling).
 * npm run bing:sitescan-status
 */
import { readBingSiteScanStatus } from './lib/bing-sitescan.mjs';

async function main() {
  console.log('bing:sitescan-status…');
  const data = await readBingSiteScanStatus();
  console.log(JSON.stringify(data, null, 2));
  if (!data?.found) process.exitCode = 2;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
