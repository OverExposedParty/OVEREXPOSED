(function () {
  function createPopupFeedAccountPrompt({
    dismissPopup,
    getStoredAccountSafely,
    isSignedInAccount,
    showPopup
  }) {
    const accountPromptDelayMs = 30000;
    const accountPromptDismissCooldownMs = 7 * 24 * 60 * 60 * 1000;
    const accountPromptDismissedStorageKey = 'oe-account-prompt-dismissed-at';
    const accountPromptMascotParts = [
      ['colour', '/images/user-customisation/colour/base/overexposed-blue.svg'],
      [
        'head-slot',
        '/images/user-customisation/head-slot/base/cardboard-box.svg'
      ],
      ['eyes-slot', '/images/user-customisation/eyes-slot/base/wide-eyes.svg'],
      ['mouth-slot', '/images/user-customisation/mouth-slot/base/two-teeth.svg']
    ];
    let accountPromptTimer = null;
    let activeAccountPromptRow = null;
    let activeAccountBenefitsDialog = null;

    function getCurrentReturnPath() {
      return `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    function isAccountPromptPage() {
      return [
        '/sign-in',
        '/login',
        '/reset-password',
        '/change-email'
      ].includes(window.location.pathname);
    }

    function getAccountPromptDismissedAt() {
      try {
        return (
          Number(localStorage.getItem(accountPromptDismissedStorageKey)) || 0
        );
      } catch {
        return 0;
      }
    }

    function rememberAccountPromptDismissed() {
      try {
        localStorage.setItem(
          accountPromptDismissedStorageKey,
          String(Date.now())
        );
      } catch {
        // Storage can be unavailable in private browsing; dismiss for this page.
      }
    }

    function shouldShowAccountPrompt() {
      if (activeAccountPromptRow || isAccountPromptPage()) return false;
      if (isSignedInAccount(getStoredAccountSafely())) return false;

      const dismissedAt = getAccountPromptDismissedAt();
      return (
        !dismissedAt ||
        Date.now() - dismissedAt >= accountPromptDismissCooldownMs
      );
    }

    function getSignupPromptPath() {
      const params = new URLSearchParams({
        mode: 'signup',
        returnTo: getCurrentReturnPath()
      });
      return `/sign-in?${params.toString()}`;
    }

    function getSignInPromptPath() {
      const params = new URLSearchParams({
        returnTo: getCurrentReturnPath()
      });
      return `/sign-in?${params.toString()}`;
    }

    function renderAccountPromptMascot(container) {
      if (!container) return false;

      container.replaceChildren();

      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.setAttribute('data-user-id', 'account-prompt-mascot');

      const stack = document.createElement('div');
      stack.className = 'image-stack';

      accountPromptMascotParts.forEach(([id, src], index) => {
        const image = document.createElement('img');
        image.id = id;
        image.src = src;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.style.zIndex = String(index + 1);
        stack.appendChild(image);
      });

      icon.appendChild(stack);
      container.appendChild(icon);
      return true;
    }

    function dismissAccountPrompt(row = activeAccountPromptRow) {
      if (!row) return;
      activeAccountPromptRow = null;
      rememberAccountPromptDismissed();
      dismissPopup(row);
    }

    function closeAccountBenefitsDialog() {
      if (!activeAccountBenefitsDialog) return;

      const dialogHost = activeAccountBenefitsDialog;
      activeAccountBenefitsDialog = null;
      if (typeof window.closeOeDialog === 'function') {
        window.closeOeDialog(dialogHost);
        return;
      }
      dialogHost.close();
    }

    function navigateFromAccountBenefits(path) {
      rememberAccountPromptDismissed();
      if (typeof window.navigateFromPopupFeed === 'function') {
        window.navigateFromPopupFeed(path);
        return;
      }
      window.location.href = path;
    }

    function openAccountBenefitsDialog() {
      closeAccountBenefitsDialog();

      const dialogHost = document.createElement('dialog');
      dialogHost.className = 'account-benefits-dialog-host oe-dialog';
      dialogHost.setAttribute(
        'aria-labelledby',
        'account-benefits-dialog-title'
      );

      const dialog = document.createElement('section');
      dialog.className = 'account-benefits-dialog';
      dialog.tabIndex = -1;

      const header = document.createElement('header');
      header.className = 'account-benefits-dialog-header';

      const title = document.createElement('h2');
      title.className = 'account-benefits-dialog-title';
      title.id = 'account-benefits-dialog-title';
      title.textContent = 'Create account';

      const mascot = document.createElement('div');
      mascot.className = 'account-benefits-dialog-mascot';
      mascot.textContent = 'OE';
      mascot.setAttribute('aria-hidden', 'true');
      renderAccountPromptMascot(mascot);

      const media = document.createElement('div');
      media.className = 'account-benefits-dialog-media';

      const intro = document.createElement('p');
      intro.className = 'account-benefits-dialog-intro';
      intro.textContent =
        'Keep your Overexposed progress, profile, and rewards attached to you.';

      const benefits = document.createElement('ul');
      benefits.className = 'account-benefits-dialog-list';
      [
        'Save your OE customisation',
        'Keep achievements and Opal rewards',
        'Track party game stats',
        'Use friends and online invites'
      ].forEach((benefitText) => {
        const item = document.createElement('li');
        item.textContent = benefitText;
        benefits.appendChild(item);
      });

      const actions = document.createElement('div');
      actions.className = 'account-benefits-dialog-actions';

      const signInButton = document.createElement('button');
      signInButton.className = 'account-benefits-dialog-action is-secondary';
      signInButton.type = 'button';
      signInButton.textContent = 'Sign in';

      const createButton = document.createElement('button');
      createButton.className = 'account-benefits-dialog-action is-primary';
      createButton.type = 'button';
      createButton.textContent = 'Create account';

      signInButton.addEventListener('click', () => {
        navigateFromAccountBenefits(getSignInPromptPath());
      });
      createButton.addEventListener('click', () => {
        navigateFromAccountBenefits(getSignupPromptPath());
      });

      header.appendChild(title);
      media.append(mascot, intro);
      actions.append(createButton, signInButton);
      dialog.append(header, media, benefits, actions);
      dialogHost.appendChild(dialog);
      document.body.appendChild(dialogHost);
      activeAccountBenefitsDialog = dialogHost;
      window.OeDialog?.register(dialogHost, {
        onClose: () => dialogHost.remove()
      });
      if (typeof window.openOeDialog === 'function') {
        window.openOeDialog(dialogHost, {
          initialFocus: '.account-benefits-dialog-action.is-primary'
        });
      } else {
        dialogHost.showModal();
        createButton.focus({ preventScroll: true });
      }
    }

    function createAccountPromptPopupRow() {
      const row = document.createElement('div');
      row.className = 'account-prompt-popup-row';
      row.dataset.popupType = 'account-prompt';
      row.setAttribute(
        'aria-label',
        'Create an account to save progress, achievements, stats, and customisation.'
      );

      const badge = document.createElement('span');
      badge.className = 'account-prompt-popup-badge';
      badge.textContent = 'OE';
      badge.setAttribute('aria-hidden', 'true');

      const content = document.createElement('span');
      content.className = 'account-prompt-popup-content';

      const label = document.createElement('span');
      label.className = 'account-prompt-popup-label';
      label.textContent = 'Account benefits';

      const title = document.createElement('span');
      title.className = 'account-prompt-popup-title';
      title.textContent = 'Create an account';

      const message = document.createElement('span');
      message.className = 'account-prompt-popup-message';
      message.textContent =
        'Save progress, achievements, stats, and customisation.';

      const actions = document.createElement('span');
      actions.className = 'account-prompt-popup-actions';

      const dismissButton = document.createElement('button');
      dismissButton.className =
        'account-prompt-popup-dismiss oe-popup-text-action oe-popup-dismiss-action';
      dismissButton.type = 'button';
      dismissButton.setAttribute('aria-label', 'Dismiss create account prompt');
      dismissButton.textContent = 'Dismiss';

      const createButton = document.createElement('button');
      createButton.className =
        'account-prompt-popup-create oe-popup-text-action oe-popup-view-action';
      createButton.type = 'button';
      createButton.textContent = 'Create';

      dismissButton.addEventListener('click', () => dismissAccountPrompt(row));
      createButton.addEventListener('click', () => {
        openAccountBenefitsDialog();
      });

      content.append(label, title, message);
      actions.append(dismissButton, createButton);
      row.append(badge, content, actions);

      renderAccountPromptMascot(badge);

      return row;
    }

    function showAccountPromptPopup(options = {}) {
      if (!options.force && !shouldShowAccountPrompt()) return null;

      if (activeAccountPromptRow) {
        dismissPopup(activeAccountPromptRow);
        activeAccountPromptRow = null;
      }

      activeAccountPromptRow = createAccountPromptPopupRow();
      return showPopup(activeAccountPromptRow, { persist: true, sound: false });
    }

    function scheduleAccountPrompt() {
      if (accountPromptTimer || !shouldShowAccountPrompt()) return;

      accountPromptTimer = window.setTimeout(() => {
        accountPromptTimer = null;
        showAccountPromptPopup();
      }, accountPromptDelayMs);
    }

    function clearAccountPrompt() {
      if (accountPromptTimer) {
        window.clearTimeout(accountPromptTimer);
        accountPromptTimer = null;
      }

      if (activeAccountPromptRow) {
        const row = activeAccountPromptRow;
        activeAccountPromptRow = null;
        dismissPopup(row);
      }
    }

    return {
      showAccountPromptPopup,
      openAccountBenefitsDialog,
      scheduleAccountPrompt,
      clearAccountPrompt,
      resetAccountPrompt() {
        activeAccountPromptRow = null;
      }
    };
  }

  window.createPopupFeedAccountPrompt = createPopupFeedAccountPrompt;
})();
