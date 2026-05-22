#!/usr/bin/env node
/**
 * Copy proxy PNGs for revealed Set 3 cards from a private renders
 * checkout into this repo's public/proxies/ folder.
 *
 * Env:
 *   PROXY_RENDERS_DIR   path to the private renders checkout's
 *                       proxies/ subfolder (defaults to
 *                       .proxy-renders/proxies relative to repo root).
 *
 * Safety:
 *   - Only copies PNGs whose slug matches a card currently in
 *     src/data/set3Spoilers.json. Unrevealed cards are never copied.
 *   - Slugify here MUST match render_all.py's slugify() exactly.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const SPOILER_JSON = path.join(REPO_ROOT, 'src', 'data', 'set3Spoilers.json');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public', 'proxies');
const RENDERS_DIR =
  process.env.PROXY_RENDERS_DIR ||
  path.join(REPO_ROOT, '.proxy-renders', 'proxies');

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function main() {
  if (!fs.existsSync(SPOILER_JSON)) {
    console.error(`Missing ${SPOILER_JSON}`);
    process.exit(1);
  }
  if (!fs.existsSync(RENDERS_DIR)) {
    console.error(`Missing renders dir ${RENDERS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const spoilerData = JSON.parse(fs.readFileSync(SPOILER_JSON, 'utf8'));
  const revealed = spoilerData.cards || [];

  let added = 0;
  let already = 0;
  let missingRender = 0;

  for (const card of revealed) {
    const slug = slugify(card.name);
    if (!slug) continue;
    const src = path.join(RENDERS_DIR, `${slug}.png`);
    const dest = path.join(PUBLIC_DIR, `${slug}.png`);

    if (fs.existsSync(dest)) {
      already++;
      continue;
    }
    if (!fs.existsSync(src)) {
      console.warn(`No render found for "${card.name}" (slug=${slug})`);
      missingRender++;
      continue;
    }
    fs.copyFileSync(src, dest);
    added++;
  }

  console.log(
    `Proxy promotion: ${added} new, ${already} already present, ${missingRender} without a render.`
  );
}

main();
