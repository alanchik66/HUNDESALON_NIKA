import re, os, openpyxl

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(PROJECT_DIR, 'assets', 'js', 'price-catalog.js')
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'dog_breeds.xlsx')

with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

breed_names = {}
m = re.search(r'breedNames\s*=\s*(\{.*?\});', content, re.DOTALL)
if m:
    raw = m.group(1)
    for kv in re.finditer(r"'([^']+)'\s*:\s*\{[^}]*ru:\s*'([^']*)", raw):
        breed_names[kv.group(1)] = kv.group(2)

catalog_start = content.find('const breedCatalog = {')
catalog_end = content.find('};', catalog_start) + 2
catalog_raw = content[catalog_start:catalog_end]

dog_breeds = []
start = catalog_raw.find('dogs: [')
if start >= 0:
    depth = 0
    end = start
    found_open = False
    for i in range(start, len(catalog_raw)):
        ch = catalog_raw[i]
        if ch == '[':
            depth += 1
            found_open = True
        elif ch == ']':
            depth -= 1
            if found_open and depth == 0:
                end = i + 1
                break
    array_text = catalog_raw[start:end]
    ids = re.findall(r"['\"]([^'\"]+)['\"]", array_text)
    breed_ids = [ids[i] for i in range(0, len(ids), 2)]
    for bid in breed_ids:
        if bid in breed_names:
            dog_breeds.append(breed_names[bid])

dog_breeds.sort(key=str.lower)
print(f'{len(dog_breeds)} dog breeds')

wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'Dog Breeds'
ws.append(['Breed'])
for breed in dog_breeds:
    ws.append([breed])
ws.column_dimensions['A'].width = 45
wb.save(OUTPUT_PATH)
print(f'Saved to {OUTPUT_PATH}')