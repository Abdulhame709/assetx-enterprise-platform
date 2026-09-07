from pathlib import Path
from PIL import Image, ImageChops, ImageStat

production = Path('/tmp/energy-cost-auth-verification/energycosts-wtqhrhyv.manus.space/energy-authenticated.png')
preview = Path('/tmp/energy-cost-auth-verification/3000-i4cu1cqfdz1dczovcyj54-97b71c0f.us3.manus.computer/energy-authenticated.png')
output = Path('/tmp/energy-cost-auth-verification/comparison.json')

for path in (production, preview):
    if not path.exists():
        raise FileNotFoundError(f'Missing screenshot: {path}')

# يستبعد القص 68px السفلية لأن شريط المعاينة الخارجي لا ينتمي إلى واجهة المنتج.
crop_height = 700
prod_image = Image.open(production).convert('RGB').crop((0, 0, 1366, crop_height))
preview_image = Image.open(preview).convert('RGB').crop((0, 0, 1366, crop_height))

if prod_image.size != preview_image.size:
    raise ValueError(f'Unexpected dimensions: {prod_image.size} vs {preview_image.size}')

diff = ImageChops.difference(prod_image, preview_image)
stat = ImageStat.Stat(diff)
mean_channel_difference = sum(stat.mean) / len(stat.mean)
different_pixels = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0))
pixel_count = prod_image.width * prod_image.height
difference_ratio = different_pixels / pixel_count

result = {
    'crop': {'width': prod_image.width, 'height': crop_height},
    'meanChannelDifference': round(mean_channel_difference, 4),
    'differentPixelRatio': round(difference_ratio, 6),
    'verdict': 'pass' if mean_channel_difference < 1.5 and difference_ratio < 0.03 else 'review',
}
output.write_text(__import__('json').dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(__import__('json').dumps(result, ensure_ascii=False))

if result['verdict'] != 'pass':
    raise SystemExit('Authenticated preview and production screenshots diverged beyond the visual threshold')
