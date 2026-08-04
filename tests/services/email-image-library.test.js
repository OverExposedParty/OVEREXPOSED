const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  listEmailImages
} = require('../../server/services/email-image-library');

const imageRoot = path.join(__dirname, '../../public/images/emails');

test('email image library discovers nested assets and applies metadata', async () => {
  const images = await listEmailImages({ rootPath: imageRoot });
  const confirmation = images.find(
    (image) => image.relativePath === 'heroes/mascot/default.png'
  );
  const resetPassword = images.find(
    (image) => image.relativePath === 'heroes/mascot/shocked.png'
  );
  const logo = images.find(
    (image) => image.relativePath === 'branding/overexposed-logo.svg'
  );

  assert.equal(confirmation.name, 'Mascot Default');
  assert.equal(confirmation.typeLabel, 'Heroes');
  assert.deepEqual(confirmation.categories, ['account-security', 'onboarding']);
  assert.equal(resetPassword.name, 'Mascot Shocked');
  assert.equal(resetPassword.format, 'PNG');
  assert.equal(logo.name, 'Branding Overexposed Logo');
  assert.equal(logo.path, '/images/emails/branding/overexposed-logo.svg');
});
