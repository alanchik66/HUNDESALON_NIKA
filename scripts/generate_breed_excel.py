import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
CATALOG_PATH = os.path.join(PROJECT_DIR, 'assets', 'js', 'price-catalog.js')
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'породы.xlsx')

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

groups = {}
for group in ['dogs', 'cats', 'others']:
    escaped = re.escape(group)
    start = catalog_raw.find(f"{group}: [")
    if start < 0:
        continue
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
    groups[group] = [bid for bid in breed_ids if bid in breed_names]

dog_ru = [breed_names[bid] for bid in groups['dogs']]
cat_ru = [breed_names[bid] for bid in groups['cats']]
other_ru = [breed_names[bid] for bid in groups['others']]

try:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Породы'
    ws.append(['Собаки', 'Кошки', 'Мелкие животные'])
    max_len = max(len(dog_ru), len(cat_ru), len(other_ru))
    for i in range(max_len):
        row = []
        row.append(dog_ru[i] if i < len(dog_ru) else None)
        row.append(cat_ru[i] if i < len(cat_ru) else None)
        row.append(other_ru[i] if i < len(other_ru) else None)
        ws.append(row)
    for col in ws.columns:
        max_width = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_width = max(max_width, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = max_width + 2
    wb.save(OUTPUT_PATH)
    print(f"Saved: {OUTPUT_PATH}")
    print(f"Dogs: {len(dog_ru)}, Cats: {len(cat_ru)}, Small Animals: {len(other_ru)}")
except ImportError:
    print("openpyxl not available, installing...")
    os.system('pip install openpyxl')
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Породы'
    ws.append(['Собаки', 'Кошки', 'Мелкие животные'])
    max_len = max(len(dog_ru), len(cat_ru), len(other_ru))
    for i in range(max_len):
        row = []
        row.append(dog_ru[i] if i < len(dog_ru) else None)
        row.append(cat_ru[i] if i < len(cat_ru) else None)
        row.append(other_ru[i] if i < len(other_ru) else None)
        ws.append(row)
    for col in ws.columns:
        max_width = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_width = max(max_width, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = max_width + 2
    wb.save(OUTPUT_PATH)
    print(f"Saved: {OUTPUT_PATH}")
    print(f"Dogs: {len(dog_ru)}, Cats: {len(cat_ru)}, Small Animals: {len(other_ru)}")