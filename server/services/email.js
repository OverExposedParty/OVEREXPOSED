const {
  buildResendTags,
  createEmailDelivery,
  createTrackingId,
  updateEmailDelivery
} = require('./email-tracking');
const { createMarketingUnsubscribeUrl } = require('./marketing-consent');

function getPublicSiteUrl(req = null) {
  const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }

  return 'http://localhost:3000';
}

function getDefaultConfirmImageUrl(siteUrl) {
  return `${siteUrl}/images/emails/heroes/mascot/default.png`;
}

function getDefaultPasswordResetImageUrl(siteUrl) {
  return `${siteUrl}/images/emails/heroes/mascot/shocked.png`;
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

async function sendEmail({
  to,
  subject,
  html,
  text,
  unsubscribeUrl = '',
  EmailDelivery,
  tracking = {}
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'OVEREXPOSED <onboarding@resend.dev>';
  const trackingId = tracking.trackingId || createTrackingId();
  const trackingData = { ...tracking, trackingId };

  await createEmailDelivery(EmailDelivery, {
    ...trackingData,
    recipient: to,
    subject,
    status: resendApiKey ? 'pending' : 'skipped'
  });

  if (!resendApiKey) {
    console.warn(
      `[EMAIL] Skipping email to ${to}; RESEND_API_KEY is not configured.`
    );
    return { skipped: true, trackingId };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': trackingId
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        tags: buildResendTags(trackingData),
        ...(unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
              }
            }
          : {})
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error('Email could not be sent');
      error.status = response.status;
      error.details = payload;
      throw error;
    }

    const sentAt = new Date();
    await updateEmailDelivery(EmailDelivery, trackingId, {
      $set: {
        providerMessageId: payload.id || null,
        status: 'sent',
        sentAt,
        lastEventAt: sentAt
      }
    });
    return { ...payload, trackingId };
  } catch (error) {
    const failedAt = new Date();
    await updateEmailDelivery(EmailDelivery, trackingId, {
      $set: {
        status: 'failed',
        failedAt,
        lastEventAt: failedAt,
        failureReason:
          error?.details?.message || error?.message || 'Provider request failed'
      }
    });
    throw error;
  }
}

async function loadPublishedAutomationTemplate({
  EmailAutomation,
  EmailTemplate,
  trigger
}) {
  let templateKey = '';
  if (EmailAutomation?.findOne) {
    try {
      const automation = await EmailAutomation.findOne({
        trigger,
        status: 'active',
        'system.archivedAt': null
      })
        .select('templateKey')
        .lean();
      if (automation?.templateKey) templateKey = automation.templateKey;
    } catch (error) {
      console.error(
        `[EMAIL] Failed to resolve the ${trigger} automation:`,
        error
      );
    }
  }
  if (!templateKey || !EmailTemplate?.findOne) return null;

  try {
    return await EmailTemplate.findOne({
      key: templateKey,
      status: 'published',
      'publishedSnapshot.html': { $type: 'string', $ne: '' },
      'system.archivedAt': null
    })
      .select('key publishedSnapshot')
      .lean();
  } catch (error) {
    console.error(
      `[EMAIL] Failed to load the published ${trigger} template:`,
      error
    );
    return null;
  }
}

async function sendVerificationEmail({
  req,
  to,
  verifyToken,
  EmailAutomation,
  EmailTemplate,
  EmailDelivery
}) {
  const siteUrl = getPublicSiteUrl(req);
  const trackingId = createTrackingId();
  const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(
    verifyToken
  )}&emailTrackingId=${encodeURIComponent(trackingId)}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;
  const confirmImageUrl =
    process.env.EMAIL_CONFIRM_IMAGE_URL || getDefaultConfirmImageUrl(siteUrl);
  const overExposedFontUrl =
    process.env.EMAIL_OVEREXPOSED_FONT_URL ||
    getDefaultOverExposedFontUrl(siteUrl);
  const lemonMilkFontUrl =
    process.env.EMAIL_LEMONMILK_FONT_URL || getDefaultLemonMilkFontUrl(siteUrl);
  const publishedTemplate = await loadPublishedAutomationTemplate({
    EmailAutomation,
    EmailTemplate,
    trigger: 'email-verification'
  });
  if (!publishedTemplate) {
    throw new Error(
      'Email verification requires an active automation with a published template'
    );
  }
  const replacements = {
    VERIFY_URL: verifyUrl,
    ACTION_URL: verifyUrl,
    PRIVACY_URL: privacyUrl,
    UNSUBSCRIBE_URL: privacyUrl,
    CONFIRM_IMAGE_URL: confirmImageUrl,
    OVEREXPOSED_FONT_URL: overExposedFontUrl,
    LEMONMILK_FONT_URL: lemonMilkFontUrl
  };
  return sendEmail({
    to,
    subject: renderTemplate(
      publishedTemplate.publishedSnapshot.subject,
      replacements
    ),
    html: renderTemplate(
      publishedTemplate.publishedSnapshot.html,
      replacements
    ),
    text: renderTemplate(
      publishedTemplate.publishedSnapshot.text,
      replacements
    ),
    EmailDelivery,
    tracking: {
      trackingId,
      type: 'automation',
      templateKey: publishedTemplate.key,
      automationTrigger: 'email-verification'
    }
  });
}

async function sendPasswordResetEmail({
  req,
  to,
  resetToken,
  EmailAutomation,
  EmailTemplate,
  EmailDelivery
}) {
  const siteUrl = getPublicSiteUrl(req);
  const trackingId = createTrackingId();
  const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(
    resetToken
  )}&emailTrackingId=${encodeURIComponent(trackingId)}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;
  const resetImageUrl =
    process.env.EMAIL_RESET_IMAGE_URL ||
    getDefaultPasswordResetImageUrl(siteUrl);
  const emailData = {
    resetUrl,
    privacyUrl,
    resetImageUrl
  };
  const publishedTemplate = await loadPublishedAutomationTemplate({
    EmailAutomation,
    EmailTemplate,
    trigger: 'password-reset-request'
  });
  const replacements = {
    RESET_URL: resetUrl,
    ACTION_URL: resetUrl,
    PRIVACY_URL: privacyUrl,
    UNSUBSCRIBE_URL: privacyUrl,
    RESET_IMAGE_URL: resetImageUrl
  };

  return sendEmail({
    to,
    subject: publishedTemplate?.publishedSnapshot?.subject
      ? renderTemplate(
          publishedTemplate.publishedSnapshot.subject,
          replacements
        )
      : 'Reset your OVEREXPOSED password',
    html: publishedTemplate?.publishedSnapshot?.html
      ? renderTemplate(publishedTemplate.publishedSnapshot.html, replacements)
      : renderPasswordResetEmail(emailData),
    text: publishedTemplate?.publishedSnapshot?.text
      ? renderTemplate(publishedTemplate.publishedSnapshot.text, replacements)
      : renderPasswordResetEmailText(emailData),
    EmailDelivery,
    tracking: {
      trackingId,
      type: 'automation',
      templateKey: publishedTemplate?.key || '',
      automationTrigger: 'password-reset-request'
    }
  });
}

async function sendEmailChangeEmail({
  req,
  to,
  changeToken,
  EmailAutomation,
  EmailTemplate,
  EmailDelivery
}) {
  const siteUrl = getPublicSiteUrl(req);
  const trackingId = createTrackingId();
  const changeUrl = `${siteUrl}/change-email?token=${encodeURIComponent(
    changeToken
  )}&emailTrackingId=${encodeURIComponent(trackingId)}`;
  const privacyUrl = `${siteUrl}/terms-and-privacy`;
  const publishedTemplate = await loadPublishedAutomationTemplate({
    EmailAutomation,
    EmailTemplate,
    trigger: 'email-address-change'
  });
  const replacements = {
    CHANGE_EMAIL_URL: changeUrl,
    ACTION_URL: changeUrl,
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
      : 'Change your OVEREXPOSED email address',
    html: publishedTemplate?.publishedSnapshot?.html
      ? renderTemplate(publishedTemplate.publishedSnapshot.html, replacements)
      : renderEmailChangeEmail({ changeUrl, privacyUrl }),
    text: publishedTemplate?.publishedSnapshot?.text
      ? renderTemplate(publishedTemplate.publishedSnapshot.text, replacements)
      : [
          'You requested to change the email address on your OVEREXPOSED account.',
          `Change email address: ${changeUrl}`,
          'If you did not request this, you can ignore this email.',
          `Terms and Privacy: ${privacyUrl}`
        ].join('\n'),
    EmailDelivery,
    tracking: {
      trackingId,
      type: 'automation',
      templateKey: publishedTemplate?.key || '',
      automationTrigger: 'email-address-change'
    }
  });
}

module.exports = {
  createMarketingUnsubscribeUrl,
  getPublicSiteUrl,
  renderPasswordResetEmail,
  sendEmail,
  sendEmailChangeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
