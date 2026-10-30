"""Decode source photographs, record their true dimensions, and build QA contact sheets."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import hashlib
import json

root = Path(__file__).resolve().parent.parent
manifest_path = root / 'server/wildlife-photos.json'
photos = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
review = root / 'tmp/wildlife-photo-review'
review.mkdir(parents=True, exist_ok=True)
for offset in range(0, len(photos), 16):
    sheet = Image.new('RGB', (1200, 1000), '#f5f2eb')
    draw = ImageDraw.Draw(sheet)
    for i, photo in enumerate(photos[offset:offset+16]):
        path = root / 'public' / photo['path'].lstrip('/')
        with Image.open(path) as image:
            assert image.format == 'JPEG', path
            image.load()
            width, height = image.size
            assert min(width, height) >= 200, path
            photo['width'], photo['height'] = width, height
            photo['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
            preview = ImageOps.contain(image.convert('RGB'), (280, 190))
            x, y = (i % 4) * 300, (i // 4) * 250
            sheet.paste(preview, (x + (300 - preview.width) // 2, y + (190 - preview.height) // 2))
            draw.text((x + 10, y + 196), f"{photo['recordId']}  {photo['name']}", font=font, fill='#26232c')
            draw.text((x + 10, y + 224), photo['scientificName'][:37], font=small, fill='#555555')
    sheet.save(review / f'contact-{offset//16+1}.jpg', quality=92)
manifest_path.write_text(json.dumps(photos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Validated {len(photos)} JPEG photographs; total {sum((root / "public" / p["path"].lstrip("/")).stat().st_size for p in photos):,} bytes.')
