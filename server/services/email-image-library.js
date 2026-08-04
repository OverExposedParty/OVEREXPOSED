const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_IMAGE_ROOT = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'images',
  'emails'
);
const IMAGE_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp'
]);
const TYPE_LABELS = {
  branding: 'Branding',
  content: 'Content',
  events: 'Events',
  heroes: 'Heroes',
  products: 'Products'
};

function titleFromFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replaceAll(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayNameFromPath(relativePath) {
  const segments = relativePath.split('/');
  const filename = segments.pop() || '';
  const folder = segments.pop() || '';
  return [folder, filename].filter(Boolean).map(titleFromFilename).join(' ');
}

function toPublicPath(relativePath) {
  return `/images/emails/${relativePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function readMetadata(rootPath) {
  try {
    const contents = await fs.readFile(
      path.join(rootPath, 'email-image-library.json'),
      'utf8'
    );
    const parsed = JSON.parse(contents);
    return parsed?.images && typeof parsed.images === 'object'
      ? parsed.images
      : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function findImageFiles(rootPath, directoryPath = rootPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findImageFiles(rootPath, entryPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(path.relative(rootPath, entryPath).replaceAll('\\', '/'));
  }

  return files;
}

async function listEmailImages({ rootPath = DEFAULT_IMAGE_ROOT } = {}) {
  const [files, metadata] = await Promise.all([
    findImageFiles(rootPath),
    readMetadata(rootPath)
  ]);

  return files
    .map((relativePath) => {
      const details = metadata[relativePath] || {};
      const inferredType = relativePath.split('/')[0] || 'other';
      const type = String(details.type || inferredType).toLowerCase();
      const extension = path.extname(relativePath).slice(1).toUpperCase();
      const name = displayNameFromPath(relativePath);
      return {
        path: toPublicPath(relativePath),
        relativePath,
        name,
        type,
        typeLabel: TYPE_LABELS[type] || titleFromFilename(type),
        format: extension === 'JPG' ? 'JPEG' : extension,
        categories: Array.isArray(details.categories)
          ? details.categories.map(String)
          : [],
        defaultAlt: String(details.defaultAlt || name)
      };
    })
    .sort(
      (first, second) =>
        first.type.localeCompare(second.type) ||
        first.name.localeCompare(second.name)
    );
}

module.exports = { listEmailImages };
