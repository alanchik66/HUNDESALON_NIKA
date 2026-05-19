/**
 * Ensure .dev.vars has CLOUDFLARE_API_TOKEN with Cache Purge.
 * Uses Global API Key (CLOUDFLARE_API_EMAIL + CLOUDFLARE_API_KEY) when set; otherwise opens dashboard guide.
 */
import {
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadDevVars,
  loadWranglerOAuth,
  refreshWranglerOAuth,
  resolveZoneId,
  upsertDevVar,
} from './lib/cloudflare-auth.mjs';

const PERMISSION_GROUPS = {
  zoneRead: 'c8fed203ed3043cba015a93ad1616f1f',
  cachePurge: 'e22dca3480a4436b9c8a7100414e84b5',
};

async function findPermissionGroupId(auth, name) {
  const groups = await cloudflareApi(
    auth,
    `/user/tokens/permission_groups?name=${encodeURIComponent(name)}&per_page=50`
  );
  const match = groups.find(group => group.name === name);
  if (!match?.id) throw new Error(`Permission group not found: ${name}`);
  return match.id;
}

async function createZonePurgeToken(auth, zoneId) {
  let zoneReadId = PERMISSION_GROUPS.zoneRead;
  let cachePurgeId = PERMISSION_GROUPS.cachePurge;

  try {
    zoneReadId = await findPermissionGroupId(auth, 'Zone Read');
    cachePurgeId = await findPermissionGroupId(auth, 'Cache Purge');
  } catch {
    // Fallback to documented group IDs when list endpoint is restricted.
  }

  return cloudflareApi(auth, '/user/tokens', {
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
}

async function main() {
  loadDevVars();
  const existing = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (existing) {
    try {
      await resolveZoneId({ Authorization: `Bearer ${existing}` });
      console.log('CLOUDFLARE_API_TOKEN in .dev.vars is present and valid for zone lookup.');
      return;
    } catch {
      console.warn('Existing CLOUDFLARE_API_TOKEN invalid; replacing...');
    }
  }

  const authHeaders = getCloudflareAuthHeaders();
  if (authHeaders?.['X-Auth-Key']) {
    const oauth = await refreshWranglerOAuth(loadWranglerOAuth());
    const zoneId = await resolveZoneId(oauth);
    const token = await createZonePurgeToken(authHeaders, zoneId);
    if (!token?.value) throw new Error('Token creation returned no value');
    upsertDevVar('CLOUDFLARE_API_TOKEN', token.value);
    console.log('CLOUDFLARE_API_TOKEN saved to .dev.vars (created via Global API Key).');
    return;
  }

  if (authHeaders?.Authorization) {
    const zoneId = await resolveZoneId(authHeaders);
    const token = await createZonePurgeToken(authHeaders, zoneId);
    if (!token?.value) throw new Error('Token creation returned no value');
    upsertDevVar('CLOUDFLARE_API_TOKEN', token.value);
    console.log('CLOUDFLARE_API_TOKEN saved to .dev.vars.');
    return;
  }

  console.error('Wrangler OAuth cannot create API tokens or purge cache.');
  console.error('');
  console.error('Add to .dev.vars (one option):');
  console.error('  A) CLOUDFLARE_API_TOKEN=<zone token with Cache Purge>');
  console.error('  B) CLOUDFLARE_API_EMAIL=... and CLOUDFLARE_API_KEY=... (Global API Key from My Profile)');
  console.error('');
  console.error('Create token: npm run cf:open-purge-token');
  process.exit(2);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
