"""Create the production WebP derivative for the above-the-fold hero image."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "brand" / "hero-dog.jpg"
TARGET = ROOT / "assets" / "images" / "brand" / "hero-dog.webp"


def main() -> None:
    with Image.open(SOURCE) as image:
        if image.width > 960:
            image = image.resize((960, round(image.height * 960 / image.width)), Image.Resampling.LANCZOS)
        image.save(TARGET, "WEBP", quality=82, method=6)
    print(f"Created {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
