import fs from 'node:fs/promises';
import path from 'node:path';
import { loadAnimalPhotoCatalog, normalizeAnimalPhotoKey } from './lib/animal-photo-catalog.mjs';

const USER_AGENT = 'HUNDESALON_NIKA animal photo registry/1.0 (+https://hundesalon-nika.com)';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const OPENVERSE_API = 'https://api.openverse.org/v1/images/';
const BATCH_SIZE = 35;
const { projectRoot, uniqueRecords } = loadAnimalPhotoCatalog();
const outputPath = path.join(projectRoot, 'temp', 'animal-breed-photo-candidates.json');

const titleAliases = new Map([
  ['guinea pigs', 'Guinea pig'],
  ['rabbits', 'Rabbit'],
  ['chinese crested powder puff variety', 'Chinese Crested Dog'],
  ['zwetna bolonka russian colored bolonka', 'Russian Tsvetnaya Bolonka'],
  ['small poodle', 'Poodle'],
  ['medium poodle', 'Poodle'],
  ['small and medium schnoodle', 'Schnoodle'],
  ['wire haired jack russell terrier', 'Jack Russell Terrier'],
  ['wire haired parson russell terrier', 'Parson Russell Terrier'],
  ['wire haired dachshund', 'Dachshund'],
  ['wire haired miniature dachshund', 'Dachshund'],
  ['short haired weimaraner', 'Weimaraner'],
  ['short haired ibizan hound', 'Ibizan Hound'],
  ['smooth haired russian toy', 'Russian Toy'],
  ['short haired dachshund', 'Dachshund'],
  ['short haired miniature dachshund', 'Dachshund'],
  ['short haired chihuahua', 'Chihuahua dog'],
  ['large australian labradoodle', 'Australian Labradoodle'],
  ['large bernedoodle', 'Bernedoodle'],
  ['large goldendoodle', 'Goldendoodle'],
  ['large labradoodle', 'Labradoodle'],
  ['havanese', 'Havanese dog'],
  ['eurasian', 'Eurasier'],
  ['hokkaido', 'Hokkaido dog'],
  ['shikoku', 'Shikoku dog'],
  ['newfoundland', 'Newfoundland dog'],
  ['havapoo', 'Havanese Poodle mix'],
  ['russian colored bolonka', 'Russian Tsvetnaya Bolonka'],
  ['appennine hound smooth haired', "Segugio dell'Appennino"],
  ['appennine hound rough haired', "Segugio dell'Appennino"],
  ['colombian fino hound standard smooth haired', 'Sabueso Fino Colombiano'],
  ['colombian fino hound standard rough haired', 'Sabueso Fino Colombiano'],
  ['colombian fino hound large smooth haired', 'Sabueso Fino Colombiano'],
  ['colombian fino hound large rough haired', 'Sabueso Fino Colombiano'],
  ['small blue gascony', 'Petit Bleu de Gascogne'],
  ['fawn brittany griffon', 'Griffon Fauve de Bretagne'],
  ['brazilian tracker', 'Rastreador Brasileiro'],
  ['great gascony blue', 'Grand Bleu de Gascogne'],
  ['xoloitzcuintli medium hairless', 'Xoloitzcuintle'],
  ['xoloitzcuintli standard hairless', 'Xoloitzcuintle'],
  ['saluki fringed', 'Saluki'],
  ['atlas mountain dog aidi', 'Aidi'],
  ['yugoslavian shepherd dog sharplanina', 'Sarplaninac'],
  ['canarian hound', 'Podenco Canario'],
  ['house cat longhair', 'Domestic long-haired cat'],
  ['bengal', 'Bengal cat'],
  ['bombay', 'Bombay cat'],
  ['cherubim', 'Ragdoll cat'],
  ['havana', 'Havana Brown'],
  ['khaomanee', 'Khao Manee cat'],
  ['minuet longhair', 'Minuet cat'],
  ['minuet talls', 'Minuet cat'],
  ['minuet talls longhair', 'Minuet cat'],
  ['pixiebob longhair', 'Pixie-bob'],
  ['munchkin', 'Munchkin cat'],
  ['savannah', 'Savannah cat'],
  ['singapura', 'Singapura cat'],
  ['snowshoe', 'Snowshoe cat'],
  ['scottish straight longhair', 'Scottish Straight cat'],
  ['selkirk rex', 'Selkirk Rex cat'],
  ['selkirk rex longhair', 'Selkirk Rex cat'],
  ['selkirk rex shorthair', 'Selkirk Rex cat'],
  ['tennessee rex', 'Tennessee Rex cat'],
]);

const manualFileTitles = new Map([
  ['colombian fino hound standard smooth haired', 'Sabueso fino colombiano.jpg'],
  ['colombian fino hound standard rough haired', 'Kolumbianajo4.jpg'],
  ['colombian fino hound large smooth haired', 'Kolumbianajo1.jpg'],
  ['colombian fino hound large rough haired', 'Kolumbianajo3.jpg'],
  ['german wire haired pointing dog', 'German Wirehaired Pointer.JPG'],
  ['cane corso', 'Italian Corso Dog black brindle male.jpg'],
  ['tatra hound', 'Tatranajokoira1.jpg'],
  ['italian rough haired segugio', 'Italian Rough-haired Hound aka Segugio Italiano a Pelo Forte.jpg'],
  ['petit brabancon', 'Smallbrabanconpetit-red1.jpg'],
  ['belgian griffon', 'Belgiangriffonbelge.jpg'],
  ['brussels griffon', 'Brusselsgriffonbruxellois1.jpg'],
  ['large australian labradoodle', 'Australian Labradoodle.jpg'],
  ['large labradoodle', 'Happy labradoodle.jpg'],
  ['akita inu', 'Akita Inu dog.jpg'],
  ['american akita', 'American Akita.jpg'],
  ['bengal longhair', 'Cashmere.png'],
  ['saluki fringed', 'Saluki Fringed.jpg'],
  ['british longhair', 'British Longhair - Blue Bicolor.jpg'],
  ['scottish straight', 'Scottish Straight Cat.jpg'],
  ['scottish straight longhair', 'SFL Vik of Fashion Kitty (15458160698) (2014 photo; cropped 2022).jpg'],
  ['laperm shorthair', 'Laperm SH blackwhite.jpg'],
  ['house cat shorthair', 'A shorthair domestic cat.jpg'],
  ['portuguese podengo small smooth haired', 'Portuguese Podengo Pequeno Smooth Coat .jpg'],
  ['portuguese podengo small wire haired', 'Portuguese Podengo Pequeno Wire-haired fawn 3.jpg'],
  ['portuguese podengo medium smooth haired', 'Portuguese Podengo Smooth-haired Medio 2.jpg'],
  ['portuguese podengo medium wire haired', 'Wirepodengomedium4.jpg'],
  ['portuguese podengo large smooth haired', 'Largepodengo1.jpg'],
  ['portuguese podengo large wire haired', 'Podengo Português Grande Cerdoso.jpg'],
  ['short haired dachshund', 'Dachshund standard.JPG'],
  ['long haired dachshund', 'Dachshundstandard-longhair.jpg'],
  ['wire haired dachshund', 'Dachshundstandard-wirehair2.jpg'],
  ['short haired miniature dachshund', 'Chocolate Smooth-Haired Mini Dachshund.jpg'],
  ['long haired miniature dachshund', 'Minaturelonghaired1.jpg'],
  ['wire haired miniature dachshund', 'Dachshund mini.JPG'],
  ['smooth haired rabbit dachshund', 'Dachshund rabbit.JPG'],
  ['long haired rabbit dachshund', 'BIR Grupp 4- TAX, LÅNGHÅRIG KANIN, Dash’n Doxies Black Hills Gold (24146521282).jpg'],
  ['wire haired rabbit dachshund', 'Jamnik króliczy 193 copy.jpg'],
  ['toy poodle', 'Toy poodle.JPG'],
  ['miniature poodle', 'Miniature poodle.jpg'],
  ['medium poodle', 'Caniche moyen gris .jpg'],
  ['standard poodle', 'Standard poodle apricot.jpg'],
  ['peruvian hairless dog small coated', 'Chien du prou a fourrure cuivre.jpg'],
  ['peruvian hairless dog small hairless', 'Small Peruvian Hairless brown 1.jpg'],
  ['peruvian hairless dog medium coated', 'Peruvian Hairless Dog Medio Coated.jpg'],
  ['peruvian hairless dog medium hairless', 'Peruvian Hairless Dog Medio.jpg'],
  ['peruvian hairless dog large coated', 'Duży nagi peruwiańczyk 456.jpg'],
  ['peruvian hairless dog large hairless', 'Peruvian hairless large.JPG'],
  ['german spitz dwarf', 'Scrappypom.jpg'],
  ['german spitz small', 'BIR Grupp 5- TYSK SPETS- KLEINSPITZ, Rettx Just Like Heartbreak Hotel (24208117806).jpg'],
  ['german spitz medium', 'German spitz (Mittel).jpg'],
  ['german spitz large', 'Germanspitzgreatgross-white1.jpg'],
  ['belgian shepherd dog groenendael', 'Belgian Groenendael 1.jpg'],
  ['belgian shepherd dog laekenois', 'Laekenois Shepherd.JPG'],
  ['belgian shepherd dog malinois', 'Grupp 1, BELGISK VALLHUND, MALINOIS, Krokasmedens Epic (24014622180).jpg'],
  ['belgian shepherd dog tervueren', 'Belgian Shepherd Tervuren in Riga 1.JPG'],
  ['dutch shepherd dog long haired', 'DutchShepherdLongCoat.jpg'],
  ['dutch shepherd dog rough haired', 'Hollandse herder ruwhaar.jpg'],
  ['dutch shepherd dog short haired', 'Hollandse herder korthaar.jpg'],
  ['russian toy long haired', 'A long-haired Russkiy Toy.jpg'],
  ['russian toy smooth coat', 'Russian Toy, short hair.jpg'],
  ['chinese crested dog hairless variety', 'Chinese Crested hairless agility.jpg'],
  ['chinese crested powder puff variety', 'Powderpuff Chinese Crested 1.jpg'],
  ['xoloitzcuintli miniature hairless', 'Xolopequeno1.jpg'],
  ['xoloitzcuintli medium hairless', 'MexicanHairlessMedio-black.jpg'],
  ['xoloitzcuintli standard hairless', 'XoloLarge1.jpg'],
  ['xoloitzcuintli standard coated', 'Isoxolokarvallinen3.jpg'],
  ['xoloitzcuintli miniature coated', 'Isoxolokarvallinen1.jpg'],
  ['xoloitzcuintli medium coated', 'Isoxolokarvallinen2.jpg'],
  ['short haired weimaraner', 'Weimaraner3.jpg'],
  ['long haired weimaraner', 'Langhaarweimaraner Borne.jpg'],
  ['japanese bobtail longhair', 'Japanese Bobtail Longhair.jpg'],
  ['japanese bobtail shorthair', 'Japanese Bobtail Shorthair.jpg'],
  ['kurilian bobtail longhair', 'Kurilia Bobtail Longhair.jpg'],
  ['kurilian bobtail shorthair', 'Kurilian Bobtail Shorthair.jpg'],
  ['american curl longhair', 'Jokihelmi Ceri ACL n 24 male EX1 CAP NOM.JPG'],
  ['american curl shorthair', 'GIC Minnikatin Zelta ACS n 22 female EX1 CAGCIB GIC.JPG'],
  ['scottish fold', 'Scottish Fold - CFF cat show Heinola 2008-05-03 IMG 7882.JPG'],
  ['scottish fold longhair', 'Scottish Fold Longhair - CFF cat show Heinola 2008-05-03 IMG 7868.JPG'],
  ['minuet', 'Minuet Cat.png'],
  ['minuet longhair', 'White gray long hair minuet.jpg'],
  ['selkirk rex longhair', 'Selkirk rex longhair FINTICAt cat show Helsinki 2013-11-24.JPG'],
  ['selkirk rex shorthair', 'Selkirk Shorthair.jpg'],
  ['laperm longhair', 'Laperm LH blacktabby white.jpg'],
  ['pixiebob longhair', 'Young pixie-bob longhair.jpg'],
  ['pixiebob', 'Pixie Bob.jpg'],
  ['house cat longhair', 'A domestic longhair cat.jpg'],
  ['manx', 'A Rumpy Manx Cat.jpg'],
  ['manx tailed', 'Manx cat with a tail - geograph.org.uk - 7667085.jpg'],
  ['cymric', 'Cymric Fond Blanc.jpg'],
  ['highlander', 'Highlander-7.jpg'],
  ['highlander shorthair', 'Grand Champion Darkside Mirror Image of Midwestern.jpg'],
  ['kromfohrlander smooth haired', 'Kromfohrländer Glatthaar.jpg'],
  ['kromfohrlander rough haired', 'Kromfohr rauhaar.JPG'],
  ['appennine hound smooth haired', 'Apenniinienajolk1.jpg'],
  ['appennine hound rough haired', 'Apenniinienajokk1.jpg'],
  ['segugio maremmano rough haired', 'Maremmanajokkfawn.jpg'],
  ['segugio maremmano smooth haired', 'Maremmanakbrindle1.jpg'],
  ['ibizan hound rough haired', 'Ibizan Wire 1.jpg'],
  ['ibizan hound smooth haired', 'Ibizan Smooth 3.jpg'],
  ['jack russell terrier wire haired', 'Rough coat Jack Russell terrier.JPG'],
  ['jack russell terrier smooth haired', 'Smooth Jack Russell Terrier.jpg'],
  ['italian short haired segugio', 'Segugioitalianopelorasofulvo.JPG'],
  ['saluki smooth', 'Red Smooth Saluki.jpg'],
  ['maine coon polydactyl', 'Polydaktyle Maine Coon Katze.jpg'],
  ['munchkin', 'Munchkin cat.jpg'],
  ['munchkin longhair', 'Longhairedmunchkin.jpg'],
  ['parson russell terrier wire haired', '05052881 PRT braun rau.jpg'],
  ['majorca shepherd dog short haired', 'Majorcanshepherdshort.jpg'],
  ['majorca shepherd dog long haired', 'Ca de Bestiar.JPG'],
  ['american bobtail longhair', 'American bobtail.jpg'],
  ['pomeranian', 'Pomeranian.JPG'],
  ['weimaraner long haired', 'Langhaarweimaraner Borne.jpg'],
  ['weimaraner short haired', 'Weimaraner3.jpg'],
  ['saluki smooth haired', 'Red Smooth Saluki.jpg'],
  ['ragdoll', 'Ragdoll, seal mitted.JPG'],
  ['yorkipoo', 'Yorkipoo.jpg'],
  ['maltipoo', 'Maltipoo Dog - Poodle Maltese Mix Breed.jpg'],
  ['poochon', 'Poochon puppy at 8 weeks of age.jpg'],
  ['shih poo', 'Shih Poo Dog2.png'],
  ['small and medium schnoodle', 'What is a Schnoodle Dog Dominoschnoodles.png'],
  ['large bernedoodle', 'Bernedoodle Dog.jpg'],
  ['selkirk rex', 'Selkirk rex longhair FINTICAt cat show Helsinki 2013-11-25.JPG'],
  ['sokoke', 'Sokoke cat.png'],
  ['birman', 'Birman-Cat.jpg'],
  ['dobermann', 'Dobermann.jpg'],
  ['airedale terrier', 'Airedale terrier.jpg'],
  ['rafeiro of alentejo', '20-month-old female Rafeiro do Alentejo.jpg'],
  ['french tricolour hound', 'Frenchhound-tricolore.jpg'],
  ['neapolitan mastiff', 'Neapolitan Mastiff (mastino napoletano).jpg'],
  ['biewer yorkshire terrier', 'BiewerHündin.jpg'],
  ['bolognese', 'Male_adult_bolognese_dog_(cropped).jpg'],
  ['maltese', 'Maltese_600.jpg'],
  ['andalusian terrier sherry terrier', 'Bodeguero_young.jpg'],
  ['english toy terrier black tan', 'ENGLISH_TOY_TERRIER,_NO_JV-14_NO_UCH_X-Pected_Dine_Mites_X-Factor_(23995274170).jpg'],
  ['irish soft coated wheaten terrier', 'Soft-Coated_Wheaten_Terrier.jpg'],
  ['russian hunting spaniel', 'Rosyjski_spaniel_myśliwski_MB_01.jpg'],
  ['norman artesien basset', 'Grupp_6_BASSET_ARTÉSIEN_NORMAND,_Skogvaktarens_Queen_Sally_(24180074612).jpg'],
  ['bohemian shepherd dog', 'OREADY_KROSANDRA_(14).JPG'],
  ['coarse haired styrian hound', 'Steirische_Rauhhaarbracke.jpg'],
  ['finnish lapponian dog', 'Finnish_Lapphund_Glenchess_Revontuli.jpg'],
  ['kintamani bali dog', 'Kintamani.jpg'],
  ['puli', 'PuliBlack_wb.jpg'],
  ['pumi', 'Pumi_2.jpg'],
  ['shiba', 'Taka_Shiba.jpg'],
  ['billy', 'Tivoli_au_Rallye_Gaillardet_en_2023_(cropped).jpg'],
  ['boxer', 'Boxer_female_brown.jpg'],
  ['brazilian campeiro bulldog', 'Buldogue_Campeiro.jpg'],
  ['dalmatian', 'Sun_Dog_Dalmatian.jpg'],
  ['poitevin', 'Poitevin_Hound.jpg'],
  ['beauce sheepdog', 'BeauceronStand.jpg'],
  ['macedonian shepherd dog karaman', 'Karaman_dog_(4).jpg'],
  ['russian european laika', 'Russo_European_Laika_2.jpg'],
  ['saint bernard', 'Hummel_Vedor_vd_Robandahoeve.jpg'],
  ['samoyed', 'Samojed00.jpg'],
  ['balinese', 'Old-Style_Balinese_Cat.png'],
  ['burmese', 'British_burmese_-_Andel_Alois_at_Cat_show.JPG'],
  ['donskoy', "DSX_World_Premior_RU*Don_Xuk's_Login_WOW_(14037189016).jpg"],
  ['himalayan', 'Sonny_Bunny.jpg'],
  ['khaomanee', 'Khaomanee_cat.jpg'],
  ['persian', 'Persialainen.jpg'],
  ['siamese', 'Siamese_cat_Vaillante.JPG'],
  ['somali', 'Сомалийская_кошка.jpg'],
  ['thai', 'Тайский_кот_Луламей_Тайская_Легенда,_Чемпион_мира_по_системе_WCF,_окрас_блю_поинт_01_(cropped).jpg'],
  ['tonkinese', 'Tonkinese_Cat_-_Leo.jpg'],
  ['turkish van', 'Turkish_Van_cat_transparent_(cropped).png'],
]);

const verifiedManualSearchMatches = new Set([
  'biewer yorkshire terrier', 'bolognese', 'maltese', 'andalusian terrier sherry terrier',
  'english toy terrier black tan', 'irish soft coated wheaten terrier', 'russian hunting spaniel',
  'norman artesien basset', 'bohemian shepherd dog', 'coarse haired styrian hound',
  'finnish lapponian dog', 'kintamani bali dog', 'puli', 'pumi', 'shiba', 'billy', 'boxer',
  'brazilian campeiro bulldog', 'dalmatian', 'poitevin', 'beauce sheepdog',
  'macedonian shepherd dog karaman', 'russian european laika', 'saint bernard', 'samoyed',
  'balinese', 'burmese', 'donskoy', 'himalayan', 'khaomanee', 'persian', 'siamese',
  'somali', 'thai', 'tonkinese', 'turkish van',
]);

const manualExactness = new Map([
  ['peruvian hairless dog small coated', 'coat-exact-size-unverified'],
  ['xoloitzcuintli miniature coated', 'coat-exact-size-unverified'],
  ['xoloitzcuintli medium coated', 'coat-exact-size-unverified'],
  ['highlander', 'breed-exact-coat-unverified'],
  ['majorca shepherd dog long haired', 'breed-exact-coat-unverified'],
]);

const verifiedOpenverseMatches = new Set([
  'havapoo',
]);

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const chunks = (items, size = BATCH_SIZE) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

async function fetchJson(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': USER_AGENT,
          ...options.headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after')) || attempt;
        if (response.status === 429 && attempt < 3) {
          await wait(retryAfter * 1000);
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 500);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${url}: ${lastError?.message || lastError}`);
}

function queryPost(endpoint, params) {
  return fetchJson(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }),
  });
}

function resolveAlias(title) {
  return titleAliases.get(normalizeAnimalPhotoKey(title)) || title;
}

function followTitle(title, redirects) {
  let value = title;
  const visited = new Set();
  while (redirects.has(value.toLocaleLowerCase('en')) && !visited.has(value.toLocaleLowerCase('en'))) {
    visited.add(value.toLocaleLowerCase('en'));
    value = redirects.get(value.toLocaleLowerCase('en'));
  }
  return value;
}

async function requestWikipediaPages(titles) {
  const result = new Map();
  for (const batch of chunks([...new Set(titles)])) {
    const payload = await queryPost(WIKIPEDIA_API, {
      action: 'query',
      redirects: '1',
      converttitles: '1',
      prop: 'pageimages|description|pageprops',
      piprop: 'thumbnail|name',
      pithumbsize: '1200',
      titles: batch.join('|'),
    });
    const redirects = new Map();
    for (const item of payload.query?.normalized || []) redirects.set(item.from.toLocaleLowerCase('en'), item.to);
    for (const item of payload.query?.redirects || []) redirects.set(item.from.toLocaleLowerCase('en'), item.to);
    const pages = new Map((payload.query?.pages || []).map(page => [page.title.toLocaleLowerCase('en'), page]));
    for (const title of batch) {
      const finalTitle = followTitle(title, redirects);
      const page = pages.get(finalTitle.toLocaleLowerCase('en'));
      if (page && !page.missing && page.pageimage) result.set(title, page);
    }
    await wait(120);
  }
  return result;
}

const genericBreedTokens = new Set([
  'breed', 'cat', 'dog', 'hair', 'haired', 'coat', 'coated', 'large', 'long', 'medium',
  'miniature', 'rough', 'short', 'small', 'smooth', 'standard', 'variety', 'wire',
]);

const meaningfulTokens = value => normalizeAnimalPhotoKey(value)
  .split(' ')
  .filter(token => token.length > 2 && !genericBreedTokens.has(token));

function isBreedPage(page, kind) {
  const description = String(page?.description || '');
  if (kind === 'small-animal') return Boolean(page?.pageimage);
  if (kind === 'cat') return /(cat breed|breed of [^.]{0,40}cat|domestic cat|feline)/i.test(description);
  return /(dog breed|breed of [^.]{0,40}(?:dog|hound)|canine|crossbreed.*dog|dog.*crossbreed)/i.test(description);
}

function scoreBreedPage(page, record) {
  if (!isBreedPage(page, record.kind)) return 0;
  const pageName = normalizeAnimalPhotoKey(page.title);
  const subjectName = normalizeAnimalPhotoKey(record.resolvedTitle);
  if (pageName === subjectName) return 100;
  const tokens = meaningfulTokens(record.resolvedTitle);
  if (!tokens.length) return 1;
  const matches = tokens.filter(token => pageName.includes(token)).length;
  if (!matches) return 0;
  return Math.round((matches / tokens.length) * 80) + (pageName.includes(subjectName) ? 10 : 0);
}

async function requestWikipediaSearchPages(records) {
  const candidateTitles = new Map();
  for (const batch of chunks(records, 4)) {
    const responses = await Promise.all(batch.map(async record => {
      const species = record.kind === 'cat' ? 'cat breed' : record.kind === 'dog' ? 'dog breed' : '';
      const payload = await queryPost(WIKIPEDIA_API, {
        action: 'query',
        list: 'search',
        srnamespace: '0',
        srlimit: '6',
        srprop: '',
        srsearch: (record.resolvedTitle + ' ' + species).trim(),
      });
      return [record.key, (payload.query?.search || []).map(item => item.title)];
    }));
    responses.forEach(([key, titles]) => candidateTitles.set(key, titles));
    await wait(180);
  }

  const pages = await requestWikipediaPages([...candidateTitles.values()].flat());
  const result = new Map();
  for (const record of records) {
    const candidates = (candidateTitles.get(record.key) || [])
      .map(title => pages.get(title))
      .filter(Boolean)
      .map(page => ({ page, score: scoreBreedPage(page, record) }))
      .filter(candidate => candidate.score >= 40)
      .sort((left, right) => right.score - left.score);
    if (candidates[0]) result.set(record.key, candidates[0].page);
  }
  return result;
}

function fileTitleFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = '/Special:FilePath/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

async function requestFciImages(fciNumbers) {
  const result = new Map();
  for (const batch of chunks([...new Set(fciNumbers.filter(Number.isInteger))], 30)) {
    const values = batch.map(number => `"${number}"`).join(' ');
    const query = `SELECT ?fci ?image WHERE {
      VALUES ?fci { ${values} }
      ?breed wdt:P31 wd:Q39367; p:P528 ?statement; wdt:P18 ?image.
      ?statement ps:P528 ?fci; pq:P972 wd:Q38603.
    }`;
    const endpoint = new URL(WIKIDATA_SPARQL);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('query', query);
    const payload = await fetchJson(endpoint, { headers: { Accept: 'application/sparql-results+json' } });
    for (const binding of payload.results?.bindings || []) {
      const number = Number(binding.fci?.value);
      const fileTitle = fileTitleFromUrl(binding.image?.value);
      if (Number.isInteger(number) && fileTitle && !result.has(number)) result.set(number, fileTitle);
    }
    await wait(180);
  }
  return result;
}

const decodeHtml = value => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, ' ')
  .trim();

const isSupportedFreeLicense = license => (
  /(?:cc0|public domain|pdm|no restrictions|cc\s*by(?:-sa)?|by-sa|gfdl|gnu free documentation|\bgpl\b|gnu general public|free art|\bfal\b)/i
    .test(license || '')
);

async function requestCommonsMetadata(fileTitles) {
  const result = new Map();
  for (const batch of chunks([...new Set(fileTitles.filter(Boolean))], 25)) {
    const payload = await queryPost(COMMONS_API, {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|user',
      iiurlwidth: '1200',
      titles: batch.map(title => `File:${title.replace(/^File:/i, '')}`).join('|'),
    });
    for (const page of payload.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info?.url || page.missing) continue;
      const fileTitle = page.title.replace(/^File:/i, '');
      const metadata = info.extmetadata || {};
      const license = decodeHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value);
      if (!isSupportedFreeLicense(license)) continue;
      const author = decodeHtml(metadata.Artist?.value || metadata.Credit?.value || metadata.Attribution?.value || info.user);
      const publicDomain = /(?:CC0|public domain|PDM)/i.test(license);
      if (!author && !publicDomain) continue;
      result.set(normalizeAnimalPhotoKey(fileTitle), {
        fileTitle,
        src: info.thumburl || info.url,
        originalSrc: info.url,
        sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        author: author || 'Unknown author',
        license,
        licenseUrl: metadata.LicenseUrl?.value || '',
        provider: 'Wikimedia Commons',
      });
    }
    await wait(150);
  }
  return result;
}

function scoreCommonsPhoto(photo, record) {
  const searchable = normalizeAnimalPhotoKey(photo.fileTitle);
  if (/(?:diagram|drawing|flag|logo|map|poster|sculpture|statue|book|pdf|skull|skeleton)/u.test(searchable)) return 0;
  const subjectTokens = meaningfulTokens(record.name);
  const resolvedTokens = meaningfulTokens(record.resolvedTitle);
  const tokenSets = [subjectTokens, resolvedTokens].filter(tokens => tokens.length);
  const subjectScore = Math.max(0, ...tokenSets.map(tokens => {
    const matches = tokens.filter(token => searchable.includes(token)).length;
    return matches && (tokens.length === 1 || matches / tokens.length >= 0.5)
      ? Math.round((matches / tokens.length) * 100)
      : 0;
  }));
  if (!subjectScore) return 0;
  const variantTokens = normalizeAnimalPhotoKey(record.name)
    .split(' ')
    .filter(token => [
      'hairless', 'longhair', 'longhaired', 'miniature', 'powder', 'rough', 'short',
      'shorthair', 'smooth', 'standard', 'wire',
    ].includes(token));
  return subjectScore + variantTokens.filter(token => searchable.includes(token)).length * 18;
}

async function requestCommonsSearchCandidates(record) {
  const queries = [...new Set([record.name, record.photoTitle, record.resolvedTitle].filter(Boolean))];
  const titles = [];
  for (const query of queries.slice(0, 2)) {
    const payload = await queryPost(COMMONS_API, {
      action: 'query',
      list: 'search',
      srnamespace: '6',
      srlimit: '50',
      srprop: '',
      srsearch: query,
    });
    titles.push(...(payload.query?.search || []).map(item => item.title.replace(/^File:/i, '')));
  }
  const metadata = await requestCommonsMetadata(titles);
  return [...metadata.values()]
    .map(photo => ({ photo, score: scoreCommonsPhoto(photo, record) }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
}

function scoreOpenversePhoto(photo, record) {
  const searchable = normalizeAnimalPhotoKey([
    photo.title,
    ...(photo.tags || []).map(tag => tag.name),
  ].filter(Boolean).join(' '));
  const speciesTokens = record.kind === 'dog'
    ? ['dog', 'dogs', 'puppy', 'canine', 'hound', 'terrier']
    : record.kind === 'cat'
      ? ['cat', 'cats', 'kitten', 'feline']
      : record.name.toLocaleLowerCase('en').includes('rabbit')
        ? ['rabbit', 'rabbits', 'bunny']
        : ['guinea pig', 'guineapig', 'cavy'];
  if (!speciesTokens.some(token => searchable.includes(normalizeAnimalPhotoKey(token)))) return 0;
  const subjects = [...new Set([record.name, record.photoTitle, record.resolvedTitle].filter(Boolean))];
  const normalizedTitle = normalizeAnimalPhotoKey(photo.title);
  const subjectScores = subjects.map(subject => {
    const tokens = meaningfulTokens(subject);
    if (!tokens.length) return 0;
    const matches = tokens.filter(token => searchable.includes(token)).length;
    const ratio = matches / tokens.length;
    if (matches === 0 || (tokens.length > 1 && ratio < 0.5)) return 0;
    return Math.round(ratio * 80)
      + (normalizedTitle.includes(normalizeAnimalPhotoKey(subject)) ? 35 : 0);
  });
  const subjectScore = Math.max(...subjectScores);
  if (!subjectScore) return 0;
  const variantTokens = normalizeAnimalPhotoKey(record.name)
    .split(' ')
    .filter(token => [
      'hairless', 'longhair', 'longhaired', 'miniature', 'powder', 'rough', 'short',
      'shorthair', 'shorthair', 'smooth', 'standard', 'wire', 'wired',
    ].includes(token));
  const variantMatches = variantTokens.filter(token => searchable.includes(token)).length;
  return subjectScore
    + variantMatches * 14
    + (photo.provider === 'wikimedia' ? 8 : 0)
    + ((photo.fields_matched || []).some(field => field === 'title' || field === 'tags.name') ? 5 : 0);
}

async function requestOpenversePhotoCandidates(record, pageSize = 30) {
  const allowedLicenses = new Set(['by', 'by-sa', 'cc0', 'pdm']);
  const species = record.kind === 'cat' ? 'cat' : record.kind === 'dog' ? 'dog' : '';
  const queries = [...new Set([
    (record.name + ' ' + species).trim(),
    (record.resolvedTitle + ' ' + species).trim(),
    record.photoTitle,
    record.resolvedTitle,
  ].filter(Boolean))];
  const payloads = [];
  for (const query of queries) {
    const endpoint = new URL(OPENVERSE_API);
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('license', 'cc0,pdm,by,by-sa');
    endpoint.searchParams.set('page_size', String(pageSize));
    try {
      payloads.push(await fetchJson(endpoint));
    } catch (error) {
      if (/HTTP (?:401|403)/u.test(String(error?.message || error))) break;
      throw error;
    }
  }
  const seenSources = new Set();
  return payloads.flatMap(payload => payload.results || [])
    .filter(photo => (
      allowedLicenses.has(photo.license)
      && /^https:\/\//i.test(photo.url || '')
      && /^https:\/\//i.test(photo.foreign_landing_url || '')
      && !photo.mature
      && !photo.watermarked
      && (!photo.unstable__sensitivity || photo.unstable__sensitivity.length === 0)
      && (photo.creator || photo.license === 'cc0' || photo.license === 'pdm')
    ))
    .map(photo => ({ photo, score: scoreOpenversePhoto(photo, record) }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .filter(({ photo }) => {
      if (seenSources.has(photo.foreign_landing_url)) return false;
      seenSources.add(photo.foreign_landing_url);
      return true;
    });
}

const openversePhotoMetadata = (photo, key) => {
  const license = String(photo.license || '').toUpperCase()
    + (photo.license_version ? ' ' + photo.license_version : '');
  return {
    fileTitle: photo.title || key,
    src: photo.url,
    originalSrc: photo.url,
    sourceUrl: photo.foreign_landing_url,
    author: photo.creator || '',
    license,
    licenseUrl: photo.license_url || '',
    attribution: photo.attribution || '',
    provider: photo.provider || photo.source || 'Openverse',
  };
};

async function requestOpenversePhotos(records) {
  const result = new Map();
  for (const batch of chunks(records, 3)) {
    const responses = await Promise.all(batch.map(async record => [
      record.key,
      (await requestOpenversePhotoCandidates(record, 20))[0]?.photo || null,
    ]));
    for (const [key, photo] of responses) {
      if (photo) result.set(key, openversePhotoMetadata(photo, key));
    }
    await wait(220);
  }
  return result;
}

const sourceIdentity = photo => photo?.sourceUrl || photo?.originalSrc || photo?.src || '';

async function replaceDuplicatePhotos(entries) {
  const groups = Object.values(Object.groupBy(entries.filter(record => record.photo), record => sourceIdentity(record.photo)));
  const duplicateGroups = groups.filter(group => group.length > 1);
  if (!duplicateGroups.length) return entries;

  const usedSources = new Set(entries
    .filter(record => record.photo)
    .map(record => sourceIdentity(record.photo)));
  const replacements = new Map();
  const priority = record => record.sourceMethod === 'manual-commons' ? 0
    : record.sourceMethod === 'wikipedia-page' ? 1
      : record.sourceMethod === 'openverse-search' ? 2 : 3;

  for (const group of duplicateGroups) {
    const ordered = [...group].sort((left, right) => priority(left) - priority(right) || left.key.localeCompare(right.key));
    const keeper = ordered.shift();
    usedSources.add(sourceIdentity(keeper.photo));
    for (const record of ordered) {
      let commonsCandidates = [];
      try {
        commonsCandidates = await requestCommonsSearchCandidates(record);
      } catch (error) {
        console.warn(`Commons search failed for ${record.name}: ${error.message}`);
      }
      let alternative = commonsCandidates.find(({ photo }) => !usedSources.has(sourceIdentity(photo)));
      let method = 'commons-unique-variant-search';
      if (!alternative) {
        const openverseCandidates = await requestOpenversePhotoCandidates(record, 50);
        alternative = openverseCandidates.find(({ photo }) => !usedSources.has(photo.foreign_landing_url));
        method = 'openverse-unique-variant-search';
      }
      if (!alternative) continue;
      const photo = method === 'openverse-unique-variant-search'
        ? openversePhotoMetadata(alternative.photo, record.key)
        : alternative.photo;
      usedSources.add(sourceIdentity(photo));
      replacements.set(record.key, {
        ...record,
        fileTitle: photo.fileTitle,
        sourceMethod: method,
        selectionExactness: 'search-match-unverified',
        photo,
      });
    }
  }
  return entries.map(record => replacements.get(record.key) || record);
}

const preparedRecords = uniqueRecords.map(record => ({
  ...record,
  resolvedTitle: resolveAlias(record.photoTitle || record.name),
}));
const wikipediaPages = await requestWikipediaPages(preparedRecords.map(record => record.resolvedTitle));
const fciImages = await requestFciImages(preparedRecords.map(record => record.fciNumber));

let candidates = preparedRecords.map(record => {
  const page = wikipediaPages.get(record.resolvedTitle);
  const breedPage = page && isBreedPage(page, record.kind) ? page : null;
  const normalizedName = normalizeAnimalPhotoKey(record.name);
  const manualFileTitle = manualFileTitles.get(normalizedName) || null;
  const fileTitle = manualFileTitle || breedPage?.pageimage || fciImages.get(record.fciNumber) || null;
  return {
    ...record,
    articleTitle: breedPage?.title || null,
    fileTitle,
    selectionExactness: manualFileTitle
      ? manualExactness.get(normalizedName)
        || (verifiedManualSearchMatches.has(normalizedName) ? 'exact-search-match' : 'exact')
      : null,
    sourceMethod: manualFileTitle ? 'manual-commons' : breedPage?.pageimage ? 'wikipedia-page' : fileTitle ? 'wikidata-fci' : null,
  };
});
let commonsMetadata = await requestCommonsMetadata(candidates.map(record => record.fileTitle));
const unresolvedCandidates = candidates.filter(record => (
  !record.fileTitle || !commonsMetadata.has(normalizeAnimalPhotoKey(record.fileTitle))
));
if (unresolvedCandidates.length) {
  const searchedPages = await requestWikipediaSearchPages(unresolvedCandidates);
  candidates = candidates.map(record => {
    if (record.fileTitle && commonsMetadata.has(normalizeAnimalPhotoKey(record.fileTitle))) return record;
    const page = searchedPages.get(record.key);
    return page?.pageimage
      ? {
        ...record,
        articleTitle: page.title,
        fileTitle: page.pageimage,
        sourceMethod: 'wikipedia-search',
        selectionExactness: 'search-match-unverified',
      }
      : record;
  });
  const searchedMetadata = await requestCommonsMetadata(candidates
    .filter(record => !commonsMetadata.has(normalizeAnimalPhotoKey(record.fileTitle)))
    .map(record => record.fileTitle));
  commonsMetadata = new Map([...commonsMetadata, ...searchedMetadata]);
}
let entries = candidates.map(record => ({
  ...record,
  photo: record.fileTitle ? commonsMetadata.get(normalizeAnimalPhotoKey(record.fileTitle)) || null : null,
}));
const openversePhotos = await requestOpenversePhotos(entries.filter(record => !record.photo));
entries = entries.map(record => {
  if (record.photo) return record;
  const photo = openversePhotos.get(record.key) || null;
  return photo
    ? {
        ...record,
        fileTitle: photo.fileTitle,
        sourceMethod: 'openverse-search',
        selectionExactness: verifiedOpenverseMatches.has(normalizeAnimalPhotoKey(record.name))
          ? 'exact-search-match'
          : 'search-match-unverified',
        photo,
      }
    : record;
});
entries = await replaceDuplicatePhotos(entries);
const missing = entries.filter(record => !record.photo);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sources: [
    'https://www.fci.be/en/Nomenclature/Default.aspx',
    'https://fifeweb.org/cats/breeds/',
    'https://tica.org/ticas-breeds/browse-all-breeds/',
    WIKIPEDIA_API,
    WIKIDATA_SPARQL,
    COMMONS_API,
    OPENVERSE_API,
  ],
  total: entries.length,
  resolved: entries.length - missing.length,
  missing: missing.length,
  entries,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Animal photo candidates: ${report.resolved}/${report.total}; missing ${report.missing}`);
console.log(`Report: ${outputPath}`);
if (missing.length) console.log(missing.map(record => `${record.kind}\t${record.name}\t${record.fciNumber || ''}`).join('\n'));
