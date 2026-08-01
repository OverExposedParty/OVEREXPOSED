const fs = require('fs');
const path = require('path');

const VERIFY_EMAIL_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'email-templates',
  'verify-email.html'
);

function getPublicSiteUrl(req = null) {
  const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }

  return 'http://localhost:3000';
}

function getDefaultConfirmImageUrl(siteUrl) {
  return `${siteUrl}/images/emails/email-confirmation/email-confirmation.png`;
}

function getDefaultPasswordResetImageUrl(siteUrl) {
  return `${siteUrl}/images/emails/reset-password/reset-password.jpg`;
}

function getDefaultOverExposedFontUrl(siteUrl) {
  return `${siteUrl}/fonts/overexposed/OverExposed-Regular.otf`;
}

function getDefaultLemonMilkFontUrl(siteUrl) {
  return `${siteUrl}/fonts/LemonMilk/LEMONMILK-Regular.otf`;
}

function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template
  );
}

function renderVerifyEmail({
  verifyUrl,
  confirmImageUrl,
  privacyUrl,
  overExposedFontUrl,
  lemonMilkFontUrl
}) {
  const template = fs.readFileSync(VERIFY_EMAIL_TEMPLATE_PATH, 'utf8');

  return renderTemplate(template, {
    VERIFY_URL: verifyUrl,
    CONFIRM_IMAGE_URL: confirmImageUrl,
    PRIVACY_URL: privacyUrl,
    OVEREXPOSED_FONT_URL: overExposedFontUrl,
    LEMONMILK_FONT_URL: lemonMilkFontUrl
  });
}

function renderVerifyEmailText({ verifyUrl, privacyUrl }) {
  return [
    'EMAIL CONFIRMATION',
    '',
    'Welcome to OVEREXPOSED. Confirm your email to finish setting up your account.',
    '',
    `Confirm email: ${verifyUrl}`,
    '',
    'If you did not create an OVEREXPOSED account, you can ignore this email.',
    'You can manage or delete your account from your account settings after logging in.',
    '',
    `Privacy Policy: ${privacyUrl}`
  ].join('\n');
}

function renderPasswordResetEmail({ resetUrl, privacyUrl, resetImageUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your OVEREXPOSED password</title>
  </head>
  <body style="margin:0;background:#050505;color:#ffffff;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border-radius:10px;padding:32px;">
            <tr>
              <td align="center">
                <h1 style="margin:0 0 18px;color:#66CCFF;font-size:32px;line-height:1;text-align:center;">RESET PASSWORD</h1>
                <img src="${resetImageUrl}" width="496" alt="Reset your OVEREXPOSED password" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:10px;margin:0 auto 24px;" />
                <p style="margin:0 0 18px;color:#ffffff;font-size:16px;line-height:1.5;">Use the button below to choose a new password for your OVEREXPOSED account.</p>
                <p style="margin:0 0 24px;color:#ffffff;font-size:16px;line-height:1.5;">This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${resetUrl}" style="display:inline-block;background:#66CCFF;color:#050505;text-decoration:none;border-radius:20px;padding:14px 22px;font-weight:bold;">RESET PASSWORD</a>
                </p>
                <p style="margin:0 0 18px;color:#bbbbbb;font-size:13px;line-height:1.5;">If the button does not work, paste this link into your browser:<br><a href="${resetUrl}" style="color:#66CCFF;">${resetUrl}</a></p>
                <p style="margin:0;color:#bbbbbb;font-size:13px;line-height:1.5;"><a href="${privacyUrl}" style="color:#66CCFF;">Terms and Privacy</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderPasswordResetEmailText({ resetUrl, privacyUrl }) {
  return [
    'RESET PASSWORD',
    '',
    'Use this link to choose a new password for your OVEREXPOSED account:',
    resetUrl,
    '',
    'This link expires in 1 hour. If you did not request a password reset, you can ignore this email.',
    '',
    `Terms and Privacy: ${privacyUrl}`
  ].join('\n');
}

function renderEmailChangeEmail({ changeUrl, privacyUrl }) {
  return [
    '<p>You requested to change the email address on your OVEREXPOSED account.</p>',
    `<p><a href="${changeUrl}">Change email address</a></p>`,
    '<p>If you did not request this, you can ignore this email.</p>',
    `<p><a href="${privacyUrl}">Terms and Privacy</a></p>`
  ].join('');
}

async function sendEmail({ to, subject, html, text }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'OVEREXPOSED <onboarding@resend.dev>';

  if (!resendApiKey) {
    console.warn(
      `[EMAIL] Skipping email to ${to}; RESEND_API_KEY is not configured.`
    );
    return { skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error('Email could not be sent');
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function sendVerificationEmail({ req, to, verifyToken, EmailTemplate }) {
  const siteUrl = getPublicSiteUrl(req);
  const verifyUrl = `${siteUrl}/api/accounts/verify-email?token=${encodeURIComponent(
    verifyToken
  )}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;
  const confirmImageUrl =
    process.env.EMAIL_CONFIRM_IMAGE_URL || getDefaultConfirmImageUrl(siteUrl);
  const overExposedFontUrl =
    process.env.EMAIL_OVEREXPOSED_FONT_URL ||
    getDefaultOverExposedFontUrl(siteUrl);
  const lemonMilkFontUrl =
    process.env.EMAIL_LEMONMILK_FONT_URL || getDefaultLemonMilkFontUrl(siteUrl);
  const emailData = {
    verifyUrl,
    privacyUrl,
    confirmImageUrl,
    overExposedFontUrl,
    lemonMilkFontUrl
  };

  let publishedTemplate = null;
  if (EmailTemplate?.findOne) {
    try {
      publishedTemplate = await EmailTemplate.findOne({
        key: 'verify-email',
        'publishedSnapshot.version': { $gte: 1 },
        'system.archivedAt': null
      })
        .select('publishedSnapshot')
        .lean();
    } catch (error) {
      console.error(
        '[EMAIL] Failed to load the published verification template; using the static fallback:',
        error
      );
    }
  }
  const replacements = {
    VERIFY_URL: verifyUrl,
    ACTION_URL: verifyUrl,
    PRIVACY_URL: privacyUrl,
    UNSUBSCRIBE_URL: privacyUrl
  };
  return sendEmail({
    to,
    subject: publishedTemplate?.publishedSnapshot?.subject
      ? renderTemplate(
          publishedTemplate.publishedSnapshot.subject,
          replacements
        )
      : 'Confirm your OVEREXPOSED email',
    html: publishedTemplate?.publishedSnapshot?.html
      ? renderTemplate(publishedTemplate.publishedSnapshot.html, replacements)
      : renderVerifyEmail(emailData),
    text: publishedTemplate?.publishedSnapshot?.text
      ? renderTemplate(publishedTemplate.publishedSnapshot.text, replacements)
      : renderVerifyEmailText(emailData)
  });
}

async function sendPasswordResetEmail({ req, to, resetToken }) {
  const siteUrl = getPublicSiteUrl(req);
  const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(
    resetToken
  )}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;
  const resetImageUrl =
    process.env.EMAIL_RESET_IMAGE_URL ||
    getDefaultPasswordResetImageUrl(siteUrl);
  const emailData = {
    resetUrl,
    privacyUrl,
    resetImageUrl
  };

  return sendEmail({
    to,
    subject: 'Reset your OVEREXPOSED password',
    html: renderPasswordResetEmail(emailData),
    text: renderPasswordResetEmailText(emailData)
  });
}

async function sendEmailChangeEmail({ req, to, changeToken }) {
  const siteUrl = getPublicSiteUrl(req);
  const changeUrl = `${siteUrl}/change-email?token=${encodeURIComponent(
    changeToken
  )}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;

  return sendEmail({
    to,
    subject: 'Change your OVEREXPOSED email address',
    html: renderEmailChangeEmail({ changeUrl, privacyUrl }),
    text: [
      'You requested to change the email address on your OVEREXPOSED account.',
      `Change email address: ${changeUrl}`,
      'If you did not request this, you can ignore this email.',
      `Terms and Privacy: ${privacyUrl}`
    ].join('\n')
  });
}

module.exports = {
  getPublicSiteUrl,
  renderPasswordResetEmail,
  renderVerifyEmail,
  sendEmail,
  sendEmailChangeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
