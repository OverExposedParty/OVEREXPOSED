const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getPublicSiteUrl,
  sendPasswordResetEmail,
  sendVerificationEmail
} = require('../../server/services/email');

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
  let createdDelivery;
  const deliveryUpdates = [];

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
    let automationQuery;
    const EmailAutomation = {
      findOne(query) {
        automationQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return { templateKey: 'custom-verification' };
          }
        };
      }
    };
    const EmailTemplate = {
      findOne(query) {
        templateQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return {
              key: 'custom-verification',
              publishedSnapshot: {
                subject: 'Confirm with {{VERIFY_URL}}',
                html: '<a href="{{VERIFY_URL}}">Confirm</a>',
                text: 'Confirm: {{VERIFY_URL}}'
              }
            };
          }
        };
      }
    };
    const EmailDelivery = {
      async create(input) {
        createdDelivery = input;
        return input;
      },
      async updateOne(query, update) {
        deliveryUpdates.push({ query, update });
        return { matchedCount: 1, modifiedCount: 1 };
      }
    };

    await sendVerificationEmail({
      req: {
        protocol: 'https',
        get: () => 'overexposed.example'
      },
      to: 'member@example.com',
      verifyToken: 'token with spaces',
      EmailAutomation,
      EmailTemplate,
      EmailDelivery
    });

    const providerBody = JSON.parse(providerRequest.options.body);
    assert.equal(automationQuery.trigger, 'email-verification');
    assert.equal(automationQuery.status, 'active');
    assert.equal(templateQuery.key, 'custom-verification');
    assert.equal(templateQuery.status, 'published');
    assert.deepEqual(templateQuery['publishedSnapshot.html'], {
      $type: 'string',
      $ne: ''
    });
    assert.equal(providerRequest.url, 'https://api.resend.com/emails');
    assert.match(providerBody.subject, /token%20with%20spaces/);
    assert.match(providerBody.html, /token%20with%20spaces/);
    assert.match(providerBody.html, /\/verify-email\?token=/);
    assert.match(providerBody.html, /emailTrackingId=/);
    assert.doesNotMatch(providerBody.html, /\{\{VERIFY_URL\}\}/);
    assert.equal(createdDelivery.automationTrigger, 'email-verification');
    assert.equal(createdDelivery.recipient, 'member@example.com');
    assert.equal(
      providerBody.tags.find((tag) => tag.name === 'tracking_id').value,
      createdDelivery.trackingId
    );
    assert.equal(
      providerRequest.options.headers['Idempotency-Key'],
      createdDelivery.trackingId
    );
    assert.equal(deliveryUpdates.at(-1).update.$set.status, 'sent');
  } finally {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    global.fetch = previousFetch;
  }
});

test('sendVerificationEmail rejects a missing automation instead of using a fallback', async () => {
  const EmailAutomation = {
    findOne() {
      return {
        select() {
          return this;
        },
        async lean() {
          return null;
        }
      };
    }
  };

  await assert.rejects(
    sendVerificationEmail({
      req: {
        protocol: 'https',
        get: () => 'overexposed.example'
      },
      to: 'member@example.com',
      verifyToken: 'token',
      EmailAutomation,
      EmailTemplate: {},
      EmailDelivery: {}
    }),
    /requires an active automation with a published template/
  );
});

test('sendPasswordResetEmail uses the active automation template', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  let automationQuery;
  let templateQuery;
  let providerRequest;
  let createdDelivery;

  process.env.RESEND_API_KEY = 'test-api-key';
  global.fetch = async (url, options) => {
    providerRequest = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: 'email-2' };
      }
    };
  };

  try {
    const EmailAutomation = {
      findOne(query) {
        automationQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return { templateKey: 'password-reset' };
          }
        };
      }
    };
    const EmailTemplate = {
      findOne(query) {
        templateQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return {
              key: 'password-reset',
              publishedSnapshot: {
                subject: 'Reset your password',
                html: '<a href="{{RESET_URL}}"><img src="{{RESET_IMAGE_URL}}" alt="Reset password"></a>',
                text: 'Reset: {{RESET_URL}}'
              }
            };
          }
        };
      }
    };
    const EmailDelivery = {
      async create(input) {
        createdDelivery = input;
        return input;
      },
      async updateOne() {
        return { matchedCount: 1, modifiedCount: 1 };
      }
    };

    await sendPasswordResetEmail({
      req: {
        protocol: 'https',
        get: () => 'overexposed.example'
      },
      to: 'member@example.com',
      resetToken: 'reset token',
      EmailAutomation,
      EmailTemplate,
      EmailDelivery
    });

    const providerBody = JSON.parse(providerRequest.options.body);
    assert.equal(automationQuery.trigger, 'password-reset-request');
    assert.equal(automationQuery.status, 'active');
    assert.equal(templateQuery.key, 'password-reset');
    assert.match(providerBody.html, /reset%20token/);
    assert.match(providerBody.html, /emailTrackingId=/);
    assert.match(
      providerBody.html,
      /images\/emails\/heroes\/mascot\/shocked\.png/
    );
    assert.doesNotMatch(providerBody.html, /\{\{RESET_URL\}\}/);
    assert.doesNotMatch(providerBody.html, /\{\{RESET_IMAGE_URL\}\}/);
    assert.equal(createdDelivery.templateKey, 'password-reset');
    assert.equal(createdDelivery.automationTrigger, 'password-reset-request');
  } finally {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    global.fetch = previousFetch;
  }
});
