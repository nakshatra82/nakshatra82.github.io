import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const [heroSource, dieSource] = process.argv.slice(2);
if (!heroSource || !dieSource) throw new Error('Usage: node scripts/prepare-assets.mjs <hero.png> <die.png>');
await mkdir(new URL('../public/assets/', import.meta.url), { recursive: true });
const jobs = [
  [heroSource, 'silicon-hero.webp', 1536, 92],
  [heroSource, 'silicon-hero-mobile.webp', 768, 88],
  [dieSource, 'silicon-die.webp', 1024, 94],
];
for (const [source, name, width, quality] of jobs) {
  const out = new URL(`../public/assets/${name}`, import.meta.url);
  const info = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality, effort: 6 }).toFile(out.pathname);
  console.log(`${name}: ${info.width} × ${info.height}, ${Math.round(info.size / 1024)} KB`);
}
