/** Read-only four-locale HTML and local-asset smoke for production and optional Pages preview. */
import { verifyLocaleSmoke, PRODUCTION_ORIGIN } from './lib/production-release-verification.mjs';

const origins = [PRODUCTION_ORIGIN];
if (process.env.PAGES_DEV_HOST) origins.push(`https://${process.env.PAGES_DEV_HOST}`);
try {
  for (const baseUrl of origins) console.log(JSON.stringify(await verifyLocaleSmoke({ baseUrl })));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
