(function () {
  function createLoginAuthUi({
    authForms,
    authModeButtons,
    authStatus,
    authTitle,
    authTitleText
  }) {
    const authModeTitles = {
      login: 'SIGN IN',
      signup: 'SIGN UP',
      reset: 'RESET PASSWORD'
    };

    function fitAuthTitleToWidth() {
      if (!authTitle || !authTitleText || !authTitle.parentElement) return;

      const measuringFontSize = 100;
      authTitle.style.fontSize = `${measuringFontSize}px`;
      const availableWidth = authTitle.getBoundingClientRect().width;
      const measuredWidth = authTitleText.getBoundingClientRect().width;
      if (!availableWidth || !measuredWidth) return;

      const fittedFontSize = (availableWidth / measuredWidth) * measuringFontSize;
      const maxFontSize = window.matchMedia('(max-width: 760px)').matches ? 28 : 40;
      authTitle.style.fontSize = `${Math.min(fittedFontSize, maxFontSize)}px`;
    }

    function setAuthStatus(message, type = '') {
      if (!authStatus) return;

      authStatus.textContent = message;
      authStatus.classList.toggle('error', type === 'error');
      authStatus.classList.toggle('success', type === 'success');
    }

    function setAuthMode(mode) {
      authModeButtons.forEach((button) => {
        const active = button.dataset.authMode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      authForms.forEach((form) => {
        form.classList.toggle('active', form.dataset.authForm === mode);
      });
      if (authTitleText) {
        authTitleText.textContent = authModeTitles[mode] || 'SIGN IN';
        fitAuthTitleToWidth();
      }
      setAuthStatus('');
    }

    function initialisePasswordToggle(button) {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      if (!input) return;

      button.addEventListener('click', () => {
        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        button.classList.toggle('is-visible', !isVisible);
        button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
        if (typeof window.playSoundEffect === 'function') {
          Promise.resolve(
            window.playSoundEffect(isVisible ? 'uiToggleDisabled' : 'uiToggleEnabled')
          ).catch(() => {});
        }
      });
    }

    function setSubmitting(form, submitting) {
      const submitButton = form.querySelector('[type="submit"]');
      if (!submitButton) return;

      submitButton.dataset.submitting = submitting ? 'true' : 'false';
      updateSubmitButtonState(form);
    }

    function getRequiredTextInputs(form) {
      return [...form.querySelectorAll('input[required]')].filter(
        (input) => input.type !== 'checkbox' && input.type !== 'radio'
      );
    }

    function hasFilledRequiredTextInputs(form) {
      return getRequiredTextInputs(form).every((input) => input.value.trim());
    }

    function updateSubmitButtonState(form) {
      const submitButton = form.querySelector('[type="submit"]');
      if (!submitButton) return;

      const isSubmitting = submitButton.dataset.submitting === 'true';
      submitButton.disabled = isSubmitting || !hasFilledRequiredTextInputs(form);
    }

    function initialiseSubmitButtonState(form) {
      updateSubmitButtonState(form);
      getRequiredTextInputs(form).forEach((input) => {
        input.addEventListener('input', () => updateSubmitButtonState(form));
      });
    }

    return {
      fitAuthTitleToWidth,
      initialisePasswordToggle,
      initialiseSubmitButtonState,
      setAuthMode,
      setAuthStatus,
      setSubmitting,
      updateSubmitButtonState
    };
  }

  window.createLoginAuthUi = createLoginAuthUi;
})();
