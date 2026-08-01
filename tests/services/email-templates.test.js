const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput
} = require('../../server/services/email-templates');

function createInput() {
  return {
    key: 'verify-email',
    name: 'Verification Email',
    category: 'transactional',
    subject: 'Confirm {{ACCOUNT_NAME}}',
    preheader: 'Confirm your account',
    theme: {
      emailBackground: '#171717',
      contentBackground: '#292929',
      accentColour: '#66ccff',
      contentWidth: 640,
      borderRadius: 0
    },
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: {
          text: '<script>alert(1)</script>',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 36,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading: 'Welcome',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif'
        }
      },
      {
        id: 'primaryAction',
        type: 'primaryAction',
        settings: {
          label: 'Confirm email',
          href: '{{VERIFY_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#171717',
          borderRadius: 0,
          alignment: 'center'
        }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'OVEREXPOSED',
          privacyLabel: 'Privacy Policy',
          privacyHref: '/terms-and-privacy',
          unsubscribeLabel: 'Unsubscribe',
          unsubscribeHref: '{{UNSUBSCRIBE_URL}}',
          fontSize: 12,
          colour: '#a8a8a8'
        }
      }
    ]
  };
}

test('email template compiler generates safe email HTML and plain text', () => {
  const compiled = compileEmailTemplate(createInput(), {
    siteUrl: 'https://overexposed.test',
    variables: {
      ACCOUNT_NAME: 'Alex',
      VERIFY_URL: 'https://overexposed.test/verify',
      UNSUBSCRIBE_URL: 'https://overexposed.test/unsubscribe'
    }
  });

  assert.equal(compiled.subject, 'Confirm Alex');
  assert.match(compiled.html, /role="presentation"/);
  assert.match(compiled.html, /https:\/\/overexposed\.test\/verify/);
  assert.match(compiled.html, /https:\/\/overexposed\.test\/terms-and-privacy/);
  assert.match(compiled.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(compiled.html, /<script>alert/);
  assert.match(compiled.text, /Confirm email/);
});

test('email template normalization rejects unsafe links', () => {
  const input = createInput();
  input.sections[1].settings.href = 'javascript:alert(1)';

  assert.throws(
    () => normalizeEmailTemplateInput(input),
    EmailTemplateValidationError
  );
});

test('email template normalization requires one final footer', () => {
  const input = createInput();
  input.sections.reverse();

  assert.throws(
    () => normalizeEmailTemplateInput(input),
    /footer as their final section/
  );
});
