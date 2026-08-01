(function () {
  function createLoginLegalDialog({ legalDialog, legalContent, legalVersion }) {
    const legalSectionsByTab = {
      terms: [
        'last-updated',
        'terms-of-service',
        'user-content',
        'virtual-items-and-shop',
        'age-nsfw-warning',
        'disclaimer',
        'contact'
      ],
      privacy: [
        'last-updated',
        'privacy-policy',
        'privacy-use-and-basis',
        'privacy-sharing',
        'privacy-retention-and-security',
        'privacy-rights',
        'cookies',
        'age-nsfw-warning',
        'contact'
      ]
    };
    let legalSections = [];
    let activeLegalTab = 'terms';
    let legalDialogTrigger = null;
    let hasAgreedToLegal = false;
    let suppressNextCloseSound = false;
    const completedLegalTabs = new Set();

    function playLegalSound(soundKey, options) {
      if (!soundKey || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(soundKey, options)).catch(() => {});
    }

    function setLegalSectionHtml(element, html) {
      if (typeof window.setSanitizedHtml === 'function') {
        window.setSanitizedHtml(element, html);
        return;
      }

      element.textContent = String(html || '').replace(/<[^>]*>/g, ' ');
    }

    function renderLegalTab(tabName) {
      if (!legalContent || !legalSectionsByTab[tabName]) return;

      activeLegalTab = tabName;
      document.querySelectorAll('[data-legal-tab]').forEach((tab) => {
        const isActive = tab.dataset.legalTab === tabName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      const activeTab = document.querySelector(`[data-legal-tab="${tabName}"]`);
      legalContent.setAttribute('aria-labelledby', activeTab?.id || '');
      legalContent.replaceChildren();

      legalSectionsByTab[tabName].forEach((sectionId) => {
        const section = legalSections.find((item) => item.sectionID === sectionId);
        if (!section) return;

        const article = document.createElement('article');
        article.className = 'auth-legal-section';
        const heading = document.createElement('h3');
        heading.textContent = section.subHeading;
        const copy = document.createElement('div');
        copy.className = 'auth-legal-section-copy';
        setLegalSectionHtml(copy, section.text);
        article.append(heading, copy);
        legalContent.appendChild(article);
      });

      legalContent.scrollTop = 0;
      window.requestAnimationFrame(updateLegalScrollProgress);
    }

    function getRequiredLegalTabs() {
      return [...document.querySelectorAll('[data-legal-tab]')]
        .map((tab) => tab.dataset.legalTab)
        .filter(Boolean);
    }

    function updateLegalAgreementState() {
      const agreeButton = document.getElementById('auth-legal-dialog-agree');
      if (!agreeButton) return;

      const requiredTabs = getRequiredLegalTabs();
      agreeButton.disabled = requiredTabs.length === 0
        || !requiredTabs.every((tabName) => completedLegalTabs.has(tabName));
    }

    function updateLegalScrollProgress() {
      if (
        !legalDialog?.open
        || !legalContent
        || legalContent.clientHeight <= 0
        || !activeLegalTab
        || legalSections.length === 0
      ) return;

      const remainingScroll = legalContent.scrollHeight
        - legalContent.clientHeight
        - legalContent.scrollTop;
      if (
        remainingScroll <= 2
        && !completedLegalTabs.has(activeLegalTab)
      ) {
        completedLegalTabs.add(activeLegalTab);
        playLegalSound('uiToggleEnabled');
      }

      document.querySelectorAll('[data-legal-tab]').forEach((tab) => {
        tab.classList.toggle('complete', completedLegalTabs.has(tab.dataset.legalTab));
      });
      updateLegalAgreementState();
    }

    async function loadLegalSections() {
      if (!legalContent) return;

      try {
        const response = await fetch('/json-files/other/terms-and-privacy.json');
        if (!response.ok) throw new Error('Legal documents could not be loaded');
        legalSections = await response.json();
        const updatedSection = legalSections.find(
          (section) => section.sectionID === 'last-updated'
        );
        const versionLabel = String(updatedSection?.text || '').split('.')[0].trim();
        if (legalVersion) {
          legalVersion.textContent = versionLabel
            ? `Current version: ${versionLabel}`
            : 'Current legal documents';
        }
        renderLegalTab(activeLegalTab);
      } catch (error) {
        legalContent.replaceChildren();
        const message = document.createElement('p');
        message.className = 'auth-legal-error';
        message.textContent = 'The legal documents could not be loaded. Please use the full-page link below.';
        legalContent.appendChild(message);
        if (legalVersion) legalVersion.textContent = 'Version unavailable';
      }
    }

    function openLegalDialog(tabName, trigger) {
      if (!legalDialog) return;
      legalDialogTrigger = trigger || document.activeElement;
      renderLegalTab(tabName);
      const initialFocus = `[data-legal-tab="${tabName}"]`;
      if (typeof window.openOeDialog === 'function') {
        window.OeDialog.register(legalDialog);
        window.openOeDialog(legalDialog, { initialFocus, opener: legalDialogTrigger });
      } else {
        if (!legalDialog.open) legalDialog.showModal();
        document.querySelector(initialFocus)?.focus();
      }
      playLegalSound('containerOpen');
    }

    function closeLegalDialog() {
      if (!legalDialog?.open) return;
      if (typeof window.closeOeDialog === 'function') {
        window.closeOeDialog(legalDialog);
        return;
      }
      legalDialog.close();
    }

    function initialiseLegalDialog() {
      if (!legalDialog) return;

      const termsCheckbox = document.getElementById('signup-terms');
      termsCheckbox?.addEventListener('click', (event) => {
        if (hasAgreedToLegal || !termsCheckbox.checked) return;
        event.preventDefault();
        termsCheckbox.checked = false;
        openLegalDialog('terms', termsCheckbox);
      });
      document.querySelectorAll('[data-legal-open]').forEach((button) => {
        button.addEventListener('click', () => {
          openLegalDialog(button.dataset.legalOpen || 'terms', button);
        });
      });
      document.querySelectorAll('[data-legal-tab]').forEach((tab) => {
        tab.addEventListener('click', () => renderLegalTab(tab.dataset.legalTab));
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          const tabs = getRequiredLegalTabs();
          const currentIndex = tabs.indexOf(activeLegalTab);
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
          if (!nextTab) return;
          renderLegalTab(nextTab);
          document.querySelector(`[data-legal-tab="${nextTab}"]`)?.focus();
        });
      });
      legalContent?.addEventListener('scroll', updateLegalScrollProgress, { passive: true });
      document.getElementById('auth-legal-dialog-agree')?.addEventListener('click', () => {
        hasAgreedToLegal = true;
        if (termsCheckbox) {
          termsCheckbox.checked = true;
          termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        suppressNextCloseSound = true;
        playLegalSound('uiSuccess', {
          priority: 'confirmation',
          interruptible: false
        });
        closeLegalDialog();
      });
      legalDialog.addEventListener('click', (event) => {
        if (event.target === legalDialog) closeLegalDialog();
      });
      legalDialog.addEventListener('close', () => {
        if (suppressNextCloseSound) {
          suppressNextCloseSound = false;
        } else {
          playLegalSound('containerClose');
        }
        if (legalContent) legalContent.scrollTop = 0;
        legalDialogTrigger?.focus?.();
        legalDialogTrigger = null;
      });

      updateLegalAgreementState();
      loadLegalSections();
    }

    return { initialiseLegalDialog };
  }

  window.createLoginLegalDialog = createLoginLegalDialog;
})();
