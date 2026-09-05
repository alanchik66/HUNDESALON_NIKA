import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogSources = [
  'assets/js/price-page-data.js',
  'assets/js/price-page-ru-data.js',
  'assets/js/price-page-locales.js',
  'assets/js/fci-dog-breeds-data.js',
  'assets/js/price-page-fci-breeds.js',
  'assets/js/price-page-coat-groups.js',
  'assets/js/cat-breeds-data.js',
  'assets/js/price-page-cat-breeds.js',
];

export const normalizeAnimalPhotoKey = value => String(value || '')
  .normalize('NFKD')
  .toLocaleLowerCase('en')
  .replace(/\p{M}+/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

export function loadAnimalPhotoCatalog() {
  const context = vm.createContext({ Intl, window: {} });
  for (const relativePath of catalogSources) {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'), context, {
      filename: relativePath,
    });
  }

  const records = [];
  const categories = context.window.PricePageCatalog.categoriesByLocale.en;
  for (const category of categories) {
    const names = category.breeds?.en || [];
    names.forEach((name, index) => {
      const metadata = category.breedMetadata?.en?.[index] || null;
      const fciNumber = category.breedFciNumbers?.[index] || null;
      let kind = null;
      if (category.id === 'ru-cats-grooming') kind = 'cat';
      else if (category.id === 'ru-small-animals') kind = 'small-animal';
      else if (/^ru-(?:long|short|double)-coat(?:-|$)/.test(category.id)) kind = 'dog';
      if (!kind) return;
      records.push({
        categoryId: category.id,
        sourceIndex: index,
        kind,
        name,
        normalizedName: normalizeAnimalPhotoKey(name),
        breedKey: category.breedKeys?.[index] || null,
        fciNumber,
        photoTitle: metadata?.photoTitle || category.breedPhotoTitles?.en?.[index] || name,
        metadataId: metadata?.id || null,
      });
    });
  }

  const uniqueRecords = new Map();
  for (const record of records) {
    const key = `${record.kind}:${record.normalizedName}:${record.fciNumber || ''}`;
    if (!uniqueRecords.has(key)) uniqueRecords.set(key, { ...record, key });
  }

  return {
    projectRoot,
    records,
    uniqueRecords: [...uniqueRecords.values()],
  };
}
