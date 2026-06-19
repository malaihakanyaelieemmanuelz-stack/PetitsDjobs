const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = path.join(__dirname, '..', 'public', 'uploads');
const OUT_DIR = path.join(INPUT_DIR, 'optimized');

if (!fs.existsSync(INPUT_DIR)) {
  console.error('Input directory does not exist:', INPUT_DIR);
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function processFile(file) {
  const inputPath = path.join(INPUT_DIR, file);
  const base = path.parse(file).name;
  const outWebp = path.join(OUT_DIR, base + '.webp');
  const outThumb = path.join(OUT_DIR, base + '-thumb.webp');

  try {
    const stat = fs.statSync(inputPath);
    if (!stat.isFile()) return;
  } catch (e) { return; }

  try {
    const img = sharp(inputPath);
    const meta = await img.metadata();
    if (!meta || !meta.format) {
      console.log('Skipping (not an image):', file);
      return;
    }

    // Full-size webp (max width 1600)
    await img
      .resize({ width: Math.min(1600, meta.width || 1600), withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outWebp);

    // Thumbnail
    await img
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(outThumb);

    console.log('Optimized:', file, '->', path.relative(process.cwd(), outWebp));
  } catch (err) {
    console.error('Failed to process', file, err.message);
  }
}

async function main() {
  const files = fs.readdirSync(INPUT_DIR);
  for (const f of files) {
    if (f === 'optimized') continue;
    await processFile(f);
  }
}

main().then(() => console.log('Done')).catch(e => console.error(e));
