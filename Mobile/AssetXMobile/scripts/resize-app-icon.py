from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "assets/images/icon.png"
targets = [
    source,
    root / "assets/images/splash-icon.png",
    root / "assets/images/favicon.png",
    root / "assets/images/android-icon-foreground.png",
]

with Image.open(source) as image:
    image = image.convert("RGBA")
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    optimized = image.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    for target in targets:
        optimized.save(target, format="PNG", optimize=True)
