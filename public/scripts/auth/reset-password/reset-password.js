const resetPasswordForm = document.getElementById('reset-password-form');
const authStatus = document.getElementById('auth-status');
const authTitle = document.getElementById('auth-title');
const authTitleText = document.getElementById('auth-title-text');
const passwordToggleButtons = document.querySelectorAll(
  '[data-password-toggle]'
);
const resetToken = new URLSearchParams(window.location.search).get('token');

function playAuthSound(soundKey) {
  if (!soundKey || typeof window.playSoundEffect !== 'function') return;
  Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
}

function fitAuthTitleToWidth() {
  if (!authTitle || !authTitleText || !authTitle.parentElement) return;

  const measuringFontSize = 100;
  authTitle.style.fontSize = `${measuringFontSize}px`;

  const availableWidth = authTitle.getBoundingClientRect().width;
  const measuredWidth = authTitleText.getBoundingClientRect().width;
  if (!availableWidth || !measuredWidth) return;

  const fittedFontSize = (availableWidth / measuredWidth) * measuringFontSize;
  const maxFontSize = window.matchMedia('(max-width: 760px)').matches
    ? 28
    : 40;
  authTitle.style.fontSize = `${Math.min(fittedFontSize, maxFontSize)}px`;
}

function setAuthStatus(message, type = '') {
  if (!authStatus) return;

  authStatus.textContent = message;
  authStatus.classList.toggle('error', type === 'error');
  authStatus.classList.toggle('success', type === 'success');
}

function getApiErrorMessage(payload, fallback) {
  const details = payload?.error?.details;
  if (details && typeof details === 'object') {
    const firstDetail = Object.values(details).find(Boolean);
    if (firstDetail) return firstDetail;
  }

  return payload?.error?.message || fallback;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const message = getApiErrorMessage(payload, 'Request failed');
    const requestId = payload?.requestId
      ? ` Request ID: ${payload.requestId}`
      : '';
    const error = new Error(`${message} (${response.status}).${requestId}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function hasFilledRequiredTextInputs(form) {
  return [...form.querySelectorAll('input[required]')].every((input) =>
    input.value.trim()
  );
}

function initialisePasswordToggle(button) {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;

  button.addEventListener('click', () => {
    const isVisible = input.type === 'text';

    input.type = isVisible ? 'password' : 'text';
    button.classList.toggle('is-visible', !isVisible);
    button.setAttribute(
      'aria-label',
      isVisible ? 'Show password' : 'Hide password'
    );
    playAuthSound(isVisible ? 'uiToggleDisabled' : 'uiToggleEnabled');
  });
}

function updateSubmitButtonState(form) {
  const submitButton = form.querySelector('[type="submit"]');
  if (!submitButton) return;

  const isSubmitting = submitButton.dataset.submitting === 'true';
  submitButton.disabled = isSubmitting || !hasFilledRequiredTextInputs(form);
}

function setSubmitting(form, submitting) {
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) {
    submitButton.dataset.submitting = submitting ? 'true' : 'false';
    updateSubmitButtonState(form);
  }
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());

  if (!resetToken) {
    setAuthStatus('Password reset link is invalid or expired.', 'error');
    playAuthSound('notificationFailure');
    return;
  }

  if (!data.password || !data.confirmPassword) {
    setAuthStatus('Enter and confirm your new password.', 'error');
    playAuthSound('uiError');
    return;
  }

  if (data.password !== data.confirmPassword) {
    setAuthStatus('Passwords do not match.', 'error');
    playAuthSound('uiError');
    return;
  }

  playAuthSound('uiSelect');
  setSubmitting(form, true);
  setAuthStatus('Saving new password...');

  try {
    const payload = await postJson('/api/accounts/password-reset/complete', {
      token: resetToken,
      password: data.password,
      confirmPassword: data.confirmPassword
    });
    localStorage.removeItem('oe-account');
    setAuthStatus(payload.message || 'Password updated.', 'success');
    playAuthSound('uiSuccess');
    form.reset();
    updateSubmitButtonState(form);
  } catch (error) {
    setAuthStatus(error.message, 'error');
    playAuthSound(error.status === 429 ? 'uiWarning' : 'notificationFailure');
  } finally {
    setSubmitting(form, false);
  }
}

if (!resetToken) {
  setAuthStatus('Password reset link is invalid or expired.', 'error');
}

resetPasswordForm?.addEventListener('submit', handleResetPasswordSubmit);
resetPasswordForm?.querySelectorAll('input[required]').forEach((input) => {
  input.addEventListener('input', () =>
    updateSubmitButtonState(resetPasswordForm)
  );
});
passwordToggleButtons.forEach(initialisePasswordToggle);
if (resetPasswordForm) updateSubmitButtonState(resetPasswordForm);

const authTitleResizeObserver =
  typeof ResizeObserver === 'function'
    ? new ResizeObserver(fitAuthTitleToWidth)
    : null;

if (authTitle?.parentElement) {
  authTitleResizeObserver?.observe(authTitle.parentElement);
}

window.addEventListener('resize', fitAuthTitleToWidth);
fitAuthTitleToWidth();

SetScriptLoaded('/scripts/auth/reset-password/reset-password.js');
