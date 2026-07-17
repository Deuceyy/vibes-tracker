/**
 * One-time mirror: download every Set 1/2 card image from the OCG S3
 * bucket, resize to 600px-wide WebP (same treatment as Set 3), save to
 * public/cards/<id>.webp and rewrite cardData.json imageUrl fields to
 * the local path.
 *
 * Why: the S3 bucket sends no CORS headers, which breaks the deck
 * share-image renderer (html-to-image can't read cross-origin pixels).
 * Local images are also faster and immune to bucket changes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const cardDataFile = path.join(rootDir, 'src', 'cardData.json');
const outDir = path.join(rootDir, 'public', 'cards');

const THUMB_MAX_WIDTH = 600;
const WEBP_QUALITY = 82;
const DELAY_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cards = JSON.parse(await fs.readFile(cardDataFile, 'utf8'));
  await fs.mkdir(outDir, { recursive: true });

  let done = 0;
  let skipped = 0;
  const failed = [];

  for (const card of cards) {
    const url = card.imageUrl;
    if (!url || !url.startsWith('http')) { skipped += 1; continue; }

    const dest = path.join(outDir, `${card.id}.webp`);
    try {
      await fs.access(dest);
      card.imageUrl = `/cards/${card.id}.webp`;
      skipped += 1;
      continue;
    } catch { /* not mirrored yet */ }

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const webp = await sharp(buf)
        .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      await fs.writeFile(dest, webp);
      card.imageUrl = `/cards/${card.id}.webp`;
      done += 1;
      if (done % 50 === 0) console.log(`  ${done} mirrored...`);
      await sleep(DELAY_MS);
    } catch (err) {
      failed.push(`${card.id}: ${err.message}`);
    }
  }

  await fs.writeFile(cardDataFile, JSON.stringify(cards) + '\n');
  console.log(`mirrored: ${done}, already-local/skipped: ${skipped}, failed: ${failed.length}`);
  if (failed.length) console.log(failed.join('\n'));
}

main().catch((err) => { console.error(err); process.exit(1); });
