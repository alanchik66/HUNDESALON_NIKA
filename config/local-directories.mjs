/** German local directories for HUNDESALON NIKA citations (Leipzig). */
import { NAP } from './brand-profiles.mjs';

const q = encodeURIComponent('HUNDESALON NIKA Leipzig');
const q2 = encodeURIComponent('Hundesalon Nika Walter-Markov-Ring');

export const LOCAL_DIRECTORIES = [
  {
    id: 'gelbeseiten',
    name: 'Gelbe Seiten',
    searchUrl: `https://www.gelbeseiten.de/suche/${q}/leipzig`,
    registerUrl: 'https://www.gelbeseiten.de/starteintrag',
    match: /hundesalon|nika|hundepflege|grooming/i,
  },
  {
    id: 'golocal',
    name: 'GoLocal',
    searchUrl: `https://www.golocal.de/leipzig/suche/?q=${q}`,
    registerUrl: 'https://www.golocal.de/unternehmen/',
    match: /hundesalon|nika|grooming/i,
  },
  {
    id: 'meinestadt',
    name: 'meinestadt.de',
    searchUrl: `https://branchenbuch.meinestadt.de/leipzig`,
    registerUrl: 'https://www.meinestadt.de/unternehmen/b2b',
    match: /hundesalon|nika|grooming/i,
  },
];

export const CITATION_NAP = NAP;
