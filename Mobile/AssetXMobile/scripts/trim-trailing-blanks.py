from pathlib import Path

root = Path(__file__).resolve().parents[1]
extensions = {".ts", ".tsx", ".md"}

for path in root.rglob("*"):
    if not path.is_file() or path.suffix not in extensions:
        continue
    text = path.read_text(encoding="utf-8")
    normalized = text.rstrip("\n") + "\n"
    if normalized != text:
        path.write_text(normalized, encoding="utf-8")
