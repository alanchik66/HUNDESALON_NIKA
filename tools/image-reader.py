import sys
import os
import json
import base64
import subprocess
import shutil
from pathlib import Path
from collections import Counter

try:
    from PIL import Image
    import numpy as np
except Exception as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)

TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "tesseract",
]

DEFAULT_SCREENSHOTS_DIR = r"C:\Users\snaip\Pictures\Screenshots"


def find_tesseract():
    for p in TESSERACT_PATHS:
        if os.path.isfile(p) or shutil.which(p):
            return p
    return None


def image_to_base64(path, mime):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def dominant_colors(image, n=5):
    small = image.resize((150, 150)).convert("RGB")
    arr = np.array(small).reshape(-1, 3)
    counts = Counter(map(tuple, arr.tolist()))
    return [{"rgb": list(color), "count": count} for color, count in counts.most_common(n)]


def resolve_path(path: str) -> Path:
    p = Path(path)
    if p.exists():
        return p
    candidate = Path(DEFAULT_SCREENSHOTS_DIR) / path
    if candidate.exists():
        return candidate
    return p


def analyze(path: Path):
    if not path.exists():
        print(json.dumps({"error": f"File not found: {path}"}, ensure_ascii=False))
        return

    img = Image.open(path)
    info = {
        "file": str(path),
        "format": img.format,
        "mode": img.mode,
        "size": {
            "width": img.width,
            "height": img.height,
            "megapixels": round(img.width * img.height / 1_000_000, 2),
        },
        "exif": {},
        "dominantColors": [],
        "ocr": "",
        "base64": None,
    }

    try:
        exif = img._getexif()
        if exif:
            decoded = {}
            for tag, value in exif.items():
                try:
                    decoded[str(tag)] = str(value)
                except Exception:
                    pass
            info["exif"] = decoded
    except Exception:
        pass

    try:
        info["dominantColors"] = dominant_colors(img)
    except Exception as e:
        info["dominantColorsError"] = str(e)

    tesseract = find_tesseract()
    if tesseract:
        tmp_tif = path.with_suffix(".tmp_ocr.tif")
        try:
            if img.mode != "RGB":
                img.convert("RGB").save(tmp_tif)
            else:
                img.save(tmp_tif)
            result = subprocess.run(
                [tesseract, str(tmp_tif), "stdout", "--psm", "6"],
                capture_output=True,
                text=True,
                check=False,
            )
            info["ocr"] = (result.stdout or "").strip()
        except Exception as e:
            info["ocrError"] = str(e)
        finally:
            if tmp_tif.exists():
                tmp_tif.unlink()
    else:
        info["ocr"] = ""
        info["ocrError"] = "tesseract not found"

    if "--no-base64" not in sys.argv:
        try:
            mime = Image.MIME.get(img.format, "image/octet-stream")
            info["base64"] = image_to_base64(path, mime)
        except Exception as e:
            info["base64Error"] = str(e)

    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tools/image-reader.py <image-path>")
        sys.exit(1)
    path = resolve_path(sys.argv[1])
    analyze(path)
