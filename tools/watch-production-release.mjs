/** Complete the release only after canonical-domain verification of the exact CI artifact. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchProductionRelease } from './lib/production-release-watch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [commit, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Pass only the full reviewed commit SHA; canonical verification has no host override.');
console.log(JSON.stringify(await watchProductionRelease({ commit, root })));
