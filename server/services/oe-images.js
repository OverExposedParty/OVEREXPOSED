const fs = require('fs/promises');
const path = require('path');

const CUSTOMISATION_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'customisation'
);
const PACKS_FILE = path.join(CUSTOMISATION_ROOT, 'customisation-packs.json');
const PACK_ITEMS_ROOT = path.join(CUSTOMISATION_ROOT, 'packs');

function titleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function normalizeOeImagePack(rawPack = {}) {
  const slug = String(rawPack['pack-name'] || rawPack.slug || '').trim();
  const status =
    rawPack['pack-status'] === 'inactive' || rawPack.status === 'draft'
      ? 'draft'
      : rawPack.status === 'archived'
        ? 'archived'
        : 'published';

  return {
    recordType: 'pack',
    slug,
    title: rawPack.title || titleFromSlug(slug),
    description: rawPack['pack-description'] || rawPack.description || '',
    prefix: String(rawPack['pack-prefix'] || rawPack.prefix || '').trim(),
    enabled: status === 'published',
    status,
    assets: {
      colour: rawPack['pack-colour'] || rawPack.assets?.colour || '',
      secondaryColour:
        rawPack['pack-secondary-colour'] ||
        rawPack.assets?.secondaryColour ||
        ''
    }
  };
}

function normalizeOeImage(rawItem = {}, packSlug) {
  return {
    recordType: 'image',
    oeId: String(rawItem.id || rawItem.oeId || '').trim(),
    packSlug,
    name: String(rawItem.name || '').trim(),
    slot: rawItem.slot,
    filePath: rawItem['file-path'] || rawItem.filePath || '',
    enabled: rawItem.enabled !== false && rawItem.status !== 'draft',
    status: rawItem.status === 'archived' ? 'archived' : 'published',
    blacklist: rawItem.blacklist === true,
    findTheOe: {
      rgb: Array.isArray(rawItem['find-the-oe']?.rgb)
        ? rawItem['find-the-oe'].rgb
        : Array.isArray(rawItem.findTheOe?.rgb)
          ? rawItem.findTheOe.rgb
          : [],
      category:
        rawItem['find-the-oe']?.category || rawItem.findTheOe?.category || '',
      tone: rawItem['find-the-oe']?.tone || rawItem.findTheOe?.tone || ''
    }
  };
}

function serializeOeImagePackForJson(pack = {}) {
  const active = Boolean(pack.enabled && pack.status === 'published');

  return {
    'pack-name': pack.slug,
    'pack-status': active ? 'active' : 'inactive',
    'pack-description': pack.description || '',
    'pack-path': `/json-files/customisation/packs/${pack.slug}.json`,
    'pack-colour': pack.assets?.colour || '',
    'pack-secondary-colour': pack.assets?.secondaryColour || '',
    'pack-prefix': pack.prefix || ''
  };
}

function serializeOeImagePackForApi(pack = {}) {
  return {
    ...serializeOeImagePackForJson(pack),
    'pack-path': `/api/oe-image-packs/${pack.slug}/images`
  };
}

function serializeOeImageForJson(image = {}) {
  const output = {
    id: image.oeId,
    name: image.name,
    'file-path': image.filePath,
    slot: image.slot,
    blacklist: image.blacklist === true
  };

  const findTheOe = image.findTheOe || {};
  if (Array.isArray(findTheOe.rgb) || findTheOe.category || findTheOe.tone) {
    output['find-the-oe'] = {
      rgb: Array.isArray(findTheOe.rgb) ? findTheOe.rgb : [],
      category: findTheOe.category || '',
      tone: findTheOe.tone || ''
    };
  }

  return output;
}

function serializeOeImagesForPackJson(packSlug, images = []) {
  return {
    [`customisation-${packSlug}`]: images.map(serializeOeImageForJson)
  };
}

async function importOeImagesFromJson(OeCustomisation) {
  const packData = await readJsonFile(PACKS_FILE);
  const importedPacks = [];
  const importedImages = [];

  for (const rawPack of packData) {
    const packPayload = normalizeOeImagePack(rawPack);
    if (!packPayload.slug) continue;

    const pack = await OeCustomisation.findOneAndUpdate(
      { recordType: 'pack', slug: packPayload.slug },
      { $set: packPayload },
      { new: true, upsert: true, runValidators: true }
    );
    importedPacks.push(pack);

    const packPath = path.join(PACK_ITEMS_ROOT, `${packPayload.slug}.json`);
    const imageData = await readJsonFile(packPath);
    const packItems = imageData[`customisation-${packPayload.slug}`] || [];

    for (const rawItem of packItems) {
      const imagePayload = normalizeOeImage(rawItem, packPayload.slug);
      if (!imagePayload.oeId || !imagePayload.name || !imagePayload.slot) {
        continue;
      }

      const image = await OeCustomisation.findOneAndUpdate(
        { recordType: 'image', oeId: imagePayload.oeId },
        { $set: imagePayload },
        { new: true, upsert: true, runValidators: true }
      );
      importedImages.push(image);
    }
  }

  return { packs: importedPacks, images: importedImages };
}

async function exportOeImagesToJson(OeCustomisation) {
  const packs = await OeCustomisation.find({ recordType: 'pack' })
    .sort({ slug: 1 })
    .lean();
  const images = await OeCustomisation.find({ recordType: 'image' })
    .sort({ packSlug: 1, oeId: 1 })
    .lean();
  const imagesByPack = new Map();

  for (const image of images) {
    if (!imagesByPack.has(image.packSlug)) {
      imagesByPack.set(image.packSlug, []);
    }
    imagesByPack.get(image.packSlug).push(image);
  }

  await fs.mkdir(PACK_ITEMS_ROOT, { recursive: true });
  await fs.writeFile(
    PACKS_FILE,
    `${JSON.stringify(packs.map(serializeOeImagePackForJson), null, 2)}\n`
  );

  for (const pack of packs) {
    await fs.writeFile(
      path.join(PACK_ITEMS_ROOT, `${pack.slug}.json`),
      `${JSON.stringify(
        serializeOeImagesForPackJson(
          pack.slug,
          imagesByPack.get(pack.slug) || []
        ),
        null,
        2
      )}\n`
    );
  }

  return { packs, images };
}

function getPublishedOeImagePacks(OeCustomisation) {
  return OeCustomisation.find({
    recordType: 'pack',
    enabled: true,
    status: 'published'
  })
    .sort({ slug: 1 })
    .lean();
}

function getPublishedOeImages(OeCustomisation, query = {}) {
  return OeCustomisation.find({
    recordType: 'image',
    ...query,
    enabled: true,
    status: 'published'
  })
    .sort({ packSlug: 1, oeId: 1 })
    .lean();
}

module.exports = {
  exportOeImagesToJson,
  getPublishedOeImagePacks,
  getPublishedOeImages,
  importOeImagesFromJson,
  serializeOeImagePackForApi,
  serializeOeImagesForPackJson
};
