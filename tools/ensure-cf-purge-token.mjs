/**
 * Create a zone API token with Cache Purge and store in .dev.vars.
 */
import {
  cloudflareApi,
  loadDevVars,
  loadWranglerOAuth,
  refreshWranglerOAuth,
  resolveZoneId,
  upsertDevVar,
} from './lib/cloudflare-auth.mjs';

async function findPermissionGroupId(oauthToken, name) {
  const groups = await cloudflareApi(
    oauthToken,
    `/user/tokens/permission_groups?name=${encodeURIComponent(name)}&per_page=50`
  );
  const match = groups.find(group => group.name === name);
  if (!match?.id) {
    throw new Error(`Permission group not found: ${name}`);
  }
  return match.id;
}

async function main() {
  loadDevVars();
  const existing = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (existing) {
    try {
      await resolveZoneId(existing);
      console.log('CLOUDFLARE_API_TOKEN in .dev.vars is valid for zone lookup.');
      return;
    } catch {
      console.warn('Existing CLOUDFLARE_API_TOKEN failed; creating a new zone token...');
    }
  }

  const oauthToken = await refreshWranglerOAuth(loadWranglerOAuth());
  const zoneId = await resolveZoneId(oauthToken);

  const cachePurgeId = await findPermissionGroupId(oauthToken, 'Cache Purge');
  const zoneReadId = await findPermissionGroupId(oauthToken, 'Zone Read');

  const token = await cloudflareApi(oauthToken, '/user/tokens', {
    method: 'POST',
    body: JSON.stringify({
      name: `hundesalon-purge-${new Date().toISOString().slice(0, 10)}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: [{ id: zoneReadId }, { id: cachePurgeId }],
          resources: {
            [`com.cloudflare.api.account.zone.${zoneId}`]: '*',
          },
        },
      ],
    }),
  });

  if (!token?.value) {
    throw new Error('Token creation returned no value');
  }

  upsertDevVar('CLOUDFLARE_API_TOKEN', token.value);
  console.log('CLOUDFLARE_API_TOKEN saved to .dev.vars (Cache Purge for hundesalon-nika.com).');
}

main().catch(error => {
  console.error(error.message);
  console.error('Create manually: API Tokens → Custom token → Zone Cache Purge + Zone Read → hundesalon-nika.com');
  process.exit(1);
});
