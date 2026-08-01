const changeEmailForm = document.getElementById('change-email-form');
const authStatus = document.getElementById('auth-status');
const authTitle = document.getElementById('auth-title');
const authTitleText = document.getElementById('auth-title-text');
const passwordToggleButtons = document.querySelectorAll(
  '[data-password-toggle]'
);
const changeEmailToken = new URLSearchParams(window.location.search).get(
  'token'
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

function fitAuthTitleToWidth() {
  if (!authTitle || !authTitleText) return;

  authTitle.style.fontSize = '';
  const availableWidth = authTitle.clientWidth;
  const measuredWidth = authTitleText.scrollWidth;
  if (!availableWidth || !measuredWidth || measuredWidth <= availableWidth) {
    return;
  }

  const measuringFontSize = Number.parseFloat(
    window.getComputedStyle(authTitle).fontSize
  );
  const fittedFontSize = (availableWidth / measuredWidth) * measuringFontSize;
  const maxFontSize = window.matchMedia('(max-width: 760px)').matches
    ? 28
    : 40;
  authTitle.style.fontSize = `${Math.min(fittedFontSize, maxFontSize)}px`;
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
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
    throw new Error(payload?.error?.message || 'Request failed');
  }

  return payload;
}

function hasFilledRequiredTextInputs(form) {
  return [...form.querySelectorAll('input[required]')].every((input) =>
    input.value.trim()
  );
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

async function handleChangeEmailSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = getFormData(form);

  if (!changeEmailToken) {
    setAuthStatus('Email change link is invalid or expired.', 'error');
    playAuthSound('notificationFailure');
    return;
  }

  if (!data.email || !data.confirmEmail || !data.password) {
    setAuthStatus('Enter your new email twice and current password.', 'error');
    playAuthSound('uiError');
    return;
  }

  if (
    data.email.trim().toLowerCase() !==
    data.confirmEmail.trim().toLowerCase()
  ) {
    setAuthStatus('Email addresses do not match.', 'error');
    playAuthSound('uiError');
    return;
  }

  playAuthSound('uiSelect');
  setSubmitting(form, true);
  setAuthStatus('Updating email...');

  try {
    const payload = await postJson('/api/accounts/email-change/complete', {
      token: changeEmailToken,
      email: data.email,
      confirmEmail: data.confirmEmail,
      password: data.password
    });
    if (payload.account) {
      localStorage.setItem('oe-account', JSON.stringify(payload.account));
    }
    setAuthStatus(payload.message || 'Email updated.', 'success');
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

if (!changeEmailToken) {
  setAuthStatus('Email change link is invalid or expired.', 'error');
}

changeEmailForm?.addEventListener('submit', handleChangeEmailSubmit);
changeEmailForm?.querySelectorAll('input[required]').forEach((input) => {
  input.addEventListener('input', () =>
    updateSubmitButtonState(changeEmailForm)
  );
});
passwordToggleButtons.forEach(initialisePasswordToggle);
if (changeEmailForm) updateSubmitButtonState(changeEmailForm);

window.addEventListener('resize', fitAuthTitleToWidth);
fitAuthTitleToWidth();

SetScriptLoaded('/scripts/auth/change-email/change-email.js');
