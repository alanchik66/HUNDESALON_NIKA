import { resolveTxt, resolveCname } from 'node:dns/promises';
for (const name of ['hundesalon-nika.com', '_dmarc.hundesalon-nika.com', 'sign._domainkey.hundesalon-nika.com']) {
  const txt = await resolveTxt(name).catch(() => []);
  const cnames = await resolveCname(name).catch(() => []);
  console.log(
    JSON.stringify({
      name,
      txt: txt.map(v => v.join('')).filter(t => /^(v=spf1|v=DMARC1|v=DKIM1|k=rsa)/.test(t)),
      cnames,
    })
  );
}
