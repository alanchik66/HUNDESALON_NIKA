/**
 * Bootstrap HUNDESALON_NIKA — Pages Deploy token via Edge CDP + save locally.
 * npm run cf:bootstrap-pages-token
 */
import { connectCfTab, ensureCfCdp } from './lib/cf-cdp.mjs';
import { sleep } from './lib/browser-cdp.mjs';
import {
  PAGES_TOKEN_NAME,
  loadPagesDeployCredentials,
  pagesTokenTemplateUrl,
  savePagesDeployToken,
  verifyPagesDeployToken,
} from './lib/cf-pages-token.mjs';
import { waitForCreatedToken } from './lib/cf-token-dashboard.mjs';

const TEMPLATE_URL = pagesTokenTemplateUrl();

async function bootstrapViaDashboard() {
  const existing = loadPagesDeployCredentials();
  if (existing) {
    try {
      const verified = await verifyPagesDeployToken(existing);
      console.log(`${PAGES_TOKEN_NAME} already configured (${verified.projectName}).`);
      return true;
    } catch {
      console.log('Existing Pages token invalid — creating a new one…');
    }
  }

  await ensureCfCdp(TEMPLATE_URL);
  const tab = await connectCfTab();

  try {
    await tab.navigate(TEMPLATE_URL, 12000);
    await sleep(3500);

    const token = await waitForCreatedToken(tab, {
      onWaiting: message => console.log(message),
    });

    if (token) {
      await verifyPagesDeployToken(token);
      savePagesDeployToken(token);
      console.log(`${PAGES_TOKEN_NAME} saved locally.`);
      return true;
    }

    console.log('Timed out waiting for token value in Dashboard.');
    console.log('Finish token creation in Edge, copy value, then run:');
    console.log('  npm run cf:set-pages-token -- <token>');
    return false;
  } finally {
    await tab.close();
  }
}

const ok = await bootstrapViaDashboard();
process.exit(ok ? 0 : 1);
