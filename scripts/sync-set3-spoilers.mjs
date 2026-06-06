import fs from 'node:fs/promises';
import path from 'node:path';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1LVYRCIdFS85w6seDyraO57GtbaCOQdskN8TnS-wtfdM/export?format=csv';
const DRIVE_FOLDER_ID = '1uC74-cgd8fkaCTZPeYHd4HJ6wtsuOrKh';
const DRIVE_EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#grid`;
const DRIVE_DOWNLOAD_URL = (fileId) =>
  `https://drive.google.com/uc?export=download&id=${fileId}`;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.webp']);

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public', 'set3-spoilers');
const dataDir = path.join(rootDir, 'src', 'data');
const dataFile = path.join(dataDir, 'set3Spoilers.json');

function normalizeWhitespace(value) {
  return value.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/['’_]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getFileExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

function getBaseImageName(fileName) {
  return fileName.slice(0, fileName.length - getFileExtension(fileName).length);
}

function parseMaybeNumber(value) {
  const trimmed = normalizeWhitespace(value ?? '');
  if (!trimmed || trimmed.toUpperCase() === 'R') {
    return null;
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function parseCollectorNumber(value) {
  const trimmed = normalizeWhitespace(value ?? '');
  const match = trimmed.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      cell = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = headerRow.map((header) => normalizeWhitespace(header));

  return bodyRows
    .map((values) =>
      Object.fromEntries(
        headers.map((header, columnIndex) => [header, values[columnIndex] ?? ''])
      )
    )
    .filter((rowObject) => normalizeWhitespace(rowObject.Name ?? '') !== '');
}

function parseDriveFiles(html) {
  const matches = html.matchAll(
    /https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view\?usp=drive_web[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g
  );

  const files = [];
  for (const match of matches) {
    const [, fileId, fileName] = match;
    files.push({
      fileId,
      fileName,
      extension: getFileExtension(fileName),
      normalizedName: normalizeKey(fileName),
      normalizedBaseName: normalizeKey(getBaseImageName(fileName))
    });
  }

  return files.filter(
    (file) =>
      SUPPORTED_IMAGE_EXTENSIONS.has(file.extension) &&
      !/_1x1\.(png|webp)$/i.test(file.fileName) &&
      !/_4x5\.(png|webp)$/i.test(file.fileName) &&
      !/_16x9\.(png|webp)$/i.test(file.fileName)
  );
}

function preferDriveFile(currentFile, nextFile) {
  if (!currentFile) {
    return nextFile;
  }

  if (currentFile.extension !== '.webp' && nextFile.extension === '.webp') {
    return nextFile;
  }

  return currentFile;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function downloadImage(fileId, destination) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(DRIVE_DOWNLOAD_URL(fileId));
      if (!response.ok) {
        throw new Error(`Failed to download image ${fileId}: ${response.status} ${response.statusText}`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(destination, bytes);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function removeStaleImages(keepFileNames) {
  const existingEntries = await fs.readdir(publicDir, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    existingEntries
      .filter((entry) => entry.isFile() && !keepFileNames.has(entry.name))
      .map((entry) => fs.unlink(path.join(publicDir, entry.name)))
  );
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  const [csvText, driveHtml] = await Promise.all([
    fetchText(SHEET_CSV_URL),
    fetchText(DRIVE_EMBED_URL)
  ]);

  const rows = parseCsv(csvText);
  const driveFiles = parseDriveFiles(driveHtml);
  const driveFilesByBaseName = new Map();

  for (const file of driveFiles) {
    const existing = driveFilesByBaseName.get(file.normalizedBaseName);
    driveFilesByBaseName.set(
      file.normalizedBaseName,
      preferDriveFile(existing, file)
    );
  }

  const missingImages = [];

  const cards = rows.flatMap((row) => {
    const name = normalizeWhitespace(row.Name ?? '');
    // Try direct match first, then a leading-"the " fallback for cases
    // where the spoiler sheet writes "The X" but the Drive file is "X".
    let matchedFile = driveFilesByBaseName.get(normalizeKey(name));
    if (!matchedFile) {
      const stripped = name.replace(/^the\s+/i, '');
      if (stripped !== name) {
        matchedFile = driveFilesByBaseName.get(normalizeKey(stripped));
      }
    }
    if (!matchedFile) {
      missingImages.push(name);
      return [];
    }

    const outputFileName = `${slugify(name)}${matchedFile.extension}`;

    return [{
      name,
      color: normalizeWhitespace(row.Color ?? ''),
      type: row.Attribute
        ? `${normalizeWhitespace(row.Type ?? '')} - ${normalizeWhitespace(row.Attribute)}`
        : normalizeWhitespace(row.Type ?? ''),
      cost: parseMaybeNumber(row.Cost),
      vibe: parseMaybeNumber(row.Vibe),
      rarity: normalizeWhitespace(row.Rarity ?? ''),
      featuringPudgy: normalizeWhitespace(row.FeaturingPudgy ?? ''),
      collectorNumber: normalizeWhitespace(row.CardID ?? ''),
      illustrator: normalizeWhitespace(row.IllusName ?? ''),
      effect: normalizeWhitespace(row.Ability ?? ''),
      image: `/set3-spoilers/${outputFileName}`,
      imageFileName: matchedFile.fileName,
      imageFileId: matchedFile.fileId,
      outputFileName
    }];
  });

  const keepFileNames = new Set(cards.map((card) => card.outputFileName));

  for (const card of cards) {
    await downloadImage(card.imageFileId, path.join(publicDir, card.outputFileName));
  }
  await removeStaleImages(keepFileNames);

  const colorCount = new Set(cards.map((card) => card.color).filter(Boolean)).size;
  const output = {
    generatedAt: new Date().toISOString(),
    colorCount,
    skippedCards: missingImages,
    cards: cards
      .map(({ outputFileName, ...card }) => card)
      .sort((left, right) => {
        const numberDelta =
          parseCollectorNumber(left.collectorNumber) - parseCollectorNumber(right.collectorNumber);
        return numberDelta || left.name.localeCompare(right.name);
      })
  };

  await fs.writeFile(dataFile, `${JSON.stringify(output, null, 2)}\n`);
  if (missingImages.length > 0) {
    console.warn(`Skipped ${missingImages.length} card(s) with no base image in Drive: ${missingImages.join(', ')}`);
  }
  console.log(`Synced ${output.cards.length} Set 3 spoiler cards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
