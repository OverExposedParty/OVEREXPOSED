const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getPublicSiteUrl,
  renderVerifyEmail,
  sendVerificationEmail
} = require('../../server/services/email');

test('renderVerifyEmail replaces verification placeholders', () => {
  const html = renderVerifyEmail({
    verifyUrl: 'https://example.com/api/accounts/verify-email?token=abc',
    confirmImageUrl:
      'https://example.com/images/emails/email-confirmation/email-confirmation.png',
    privacyUrl: 'https://example.com/terms-and-privacy',
    overExposedFontUrl:
      'https://example.com/fonts/overexposed/OverExposed-Regular.otf',
    lemonMilkFontUrl:
      'https://example.com/fonts/LemonMilk/LEMONMILK-Regular.otf'
  });

  assert.match(html, /https:\/\/example\.com\/api\/accounts\/verify-email/);
  assert.match(html, /email-confirmation\.png/);
  assert.match(html, /https:\/\/example\.com\/terms-and-privacy/);
  assert.match(html, /OverExposed-Regular\.otf/);
  assert.match(html, /LEMONMILK-Regular\.otf/);
  assert.match(html, /font-family: 'OverExposed', Arial/);
  assert.match(html, /font-family: 'LemonMilk', Arial/);
  assert.doesNotMatch(html, /\{\{VERIFY_URL\}\}/);
  assert.doesNotMatch(html, /\{\{CONFIRM_IMAGE_URL\}\}/);
  assert.doesNotMatch(html, /\{\{PRIVACY_URL\}\}/);
  assert.doesNotMatch(html, /\{\{OVEREXPOSED_FONT_URL\}\}/);
  assert.doesNotMatch(html, /\{\{LEMONMILK_FONT_URL\}\}/);
});

test('getPublicSiteUrl falls back to the current request origin', () => {
  const siteUrl = getPublicSiteUrl({
    protocol: 'https',
    get(header) {
      return header === 'host' ? 'overexposed.example' : '';
    }
  });

  assert.equal(siteUrl, 'https://overexposed.example');
});

test('sendVerificationEmail uses the published MongoDB template snapshot', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  let templateQuery;
  let providerRequest;

  process.env.RESEND_API_KEY = 'test-api-key';
  global.fetch = async (url, options) => {
    providerRequest = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: 'email-1' };
      }
    };
  };

  try {
    const EmailTemplate = {
      findOne(query) {
        templateQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return {
              publishedSnapshot: {
                version: 3,
                subject: 'Confirm with {{VERIFY_URL}}',
                html: '<a href="{{VERIFY_URL}}">Confirm</a>',
                text: 'Confirm: {{VERIFY_URL}}'
              }
            };
          }
        };
      }
    };

    await sendVerificationEmail({
      req: {
        protocol: 'https',
        get: () => 'overexposed.example'
      },
      to: 'member@example.com',
      verifyToken: 'token with spaces',
      EmailTemplate
    });

    const providerBody = JSON.parse(providerRequest.options.body);
    assert.equal(templateQuery.key, 'verify-email');
    assert.deepEqual(templateQuery['publishedSnapshot.version'], { $gte: 1 });
    assert.equal(providerRequest.url, 'https://api.resend.com/emails');
    assert.match(providerBody.subject, /token%20with%20spaces/);
    assert.match(providerBody.html, /token%20with%20spaces/);
    assert.doesNotMatch(providerBody.html, /\{\{VERIFY_URL\}\}/);
  } finally {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    global.fetch = previousFetch;
  }
});
