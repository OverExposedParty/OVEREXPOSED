const verifyEmailForm = document.getElementById('verify-email-form');
const authStatus = document.getElementById('auth-status');
const confirmationToken = new URLSearchParams(window.location.search).get(
  'token'
);
const emailTrackingId = new URLSearchParams(window.location.search).get(
  'emailTrackingId'
);

function playAuthSound(soundKey) {
  if (!soundKey || typeof window.playSoundEffect !== 'function') return;
  Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
}

function setAuthStatus(message, type = '') {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.classList.toggle('error', type === 'error');
  authStatus.classList.toggle('success', type === 'success');
}

function setSubmitting(submitting) {
  const submitButton = verifyEmailForm?.querySelector('[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = submitting || !confirmationToken;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(
      payload?.error?.message || 'Email confirmation failed. Try again later.'
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

function storeConfirmationSuccess(account) {
  if (account) {
    localStorage.setItem('oe-account', JSON.stringify(account));
  }
  try {
    sessionStorage.setItem('oe-auth-completion', 'email-verified');
  } catch {}
}

async function handleVerifyEmailSubmit(event) {
  event.preventDefault();
  if (!confirmationToken) {
    setAuthStatus(
      'This email confirmation link is invalid or has expired.',
      'error'
    );
    playAuthSound('notificationFailure');
    return;
  }

  setSubmitting(true);
  setAuthStatus('Confirming your email...');
  playAuthSound('uiSelect');

  try {
    const payload = await postJson('/api/accounts/verify-email/complete', {
      token: confirmationToken,
      emailTrackingId
    });
    if (payload.signedIn === false) {
      localStorage.removeItem('oe-account');
      setAuthStatus(payload.message, 'success');
      playAuthSound('notificationSuccess');
      return;
    }

    storeConfirmationSuccess(payload.account);
    setAuthStatus('Email confirmed. Taking you to OVEREXPOSED...', 'success');
    playAuthSound('notificationSuccess');
    window.location.assign('/');
  } catch (error) {
    setAuthStatus(error.message, 'error');
    playAuthSound('notificationFailure');
  } finally {
    setSubmitting(false);
  }
}

if (!confirmationToken) {
  setAuthStatus(
    'This email confirmation link is invalid or has expired.',
    'error'
  );
}

verifyEmailForm?.addEventListener('submit', handleVerifyEmailSubmit);
setSubmitting(false);

SetScriptLoaded('/scripts/auth/verify-email/verify-email.js');
