const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createOeCustomisationHelpers
} = require('../../server/routes/shared/api-oe-customisation-helpers');

function createHelpers() {
  const PUBLIC_DIRECTORY = path.join(os.tmpdir(), 'oe-customisation-test');
  return createOeCustomisationHelpers({
    fs,
    path,
    PUBLIC_DIRECTORY,
    OE_CUSTOMISATION_SVG_WIDTH: 512,
    OE_CUSTOMISATION_SVG_HEIGHT: 512
  });
}

test('OE customisation helper facade preserves its public helper contract', () => {
  const helpers = createHelpers();

  assert.deepEqual(Object.keys(helpers).sort(), [
    'createOeCustomisationImageCreatePayload',
    'createOeCustomisationImageUpdatePayload',
    'createOeCustomisationPackCreatePayload',
    'createOeCustomisationPackUpdatePayload',
    'getOeCustomisationFileExists',
    'getOeCustomisationIssues',
    'normalizeOeCustomisationImageFolder',
    'normalizeOeCustomisationStatus',
    'saveOeCustomisationSvgUpload',
    'serializeOeCustomisationImageForPanel',
    'serializeOeCustomisationPackForPanel',
    'slugifyOeCustomisationFileName',
    'validateOeCustomisationSvgDimensions'
  ]);
});

test('OE customisation payload helpers keep validation semantics', () => {
  const helpers = createHelpers();

  assert.deepEqual(helpers.normalizeOeCustomisationStatus('Published'), 'published');
  assert.deepEqual(helpers.normalizeOeCustomisationStatus('bad'), null);
  assert.deepEqual(
    helpers.createOeCustomisationPackCreatePayload({
      slug: 'Base Pack',
      title: 'Base Pack',
      prefix: 'base',
      active: 'yes'
    }).pack.slug,
    'base-pack'
  );
  assert.deepEqual(
    helpers.createOeCustomisationImageUpdatePayload({
      findTheOeRgb: '1, 2, nope, 3'
    }).update['findTheOe.rgb'],
    [1, 2, 3]
  );
});

test('OE customisation SVG dimensions validate expected 512 artboards', () => {
  const helpers = createHelpers();

  assert.deepEqual(
    helpers.validateOeCustomisationSvgDimensions(
      '<svg viewBox="0 0 512 512"></svg>'
    ),
    {}
  );
  assert.match(
    helpers.validateOeCustomisationSvgDimensions(
      '<svg width="128" height="512"></svg>'
    ).error,
    /512/
  );
});
