(function initialiseReportContainer() {
  const reportReasons = [
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_or_abuse', label: 'Hate or abuse' },
    { value: 'violence_or_threats', label: 'Violence or threats' },
    { value: 'self_harm', label: 'Self harm' },
    { value: 'spam', label: 'Spam' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'inappropriate_content', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' }
  ];

  let activeReportContext = null;
  let reportContainer = null;
  let form = null;
  let reasonSelect = null;
  let reasonMenuButton = null;
  let reasonMenuList = null;
  let detailsInput = null;
  let submitButton = null;
  let statusText = null;
  let titleText = null;
  const reportStatusCache = new Map();

  function getStoredAccount() {
    try {
      return JSON.parse(localStorage.getItem('oe-account')) || null;
    } catch (error) {
      return null;
    }
  }

  function createReportClientId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getReportClientId() {
    const storageKey = 'oe-report-client-id';
    let clientId = localStorage.getItem(storageKey);

    if (!clientId) {
      clientId = createReportClientId();
      localStorage.setItem(storageKey, clientId);
    }

    return clientId;
  }

  function setStatus(message = '', type = '') {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.classList.toggle('error', type === 'error');
    statusText.classList.toggle('success', type === 'success');
  }

  function closeReportContainer() {
    activeReportContext = null;
    if (reportContainer) {
      hideContainer(reportContainer);
      removeElementIfExists(popUpClassArray, reportContainer);
    }
    setStatus();
  }

  function setSelectedReason(reasonValue) {
    const selectedReason =
      reportReasons.find((reason) => reason.value === reasonValue) ||
      reportReasons[0];

    reasonSelect.value = selectedReason.value;
    reasonMenuButton.textContent = selectedReason.label;
  }

  function setReasonMenuOpen(isOpen) {
    if (reasonMenuButton?.disabled) {
      isOpen = false;
    }

    reasonMenuList.hidden = !isOpen;
    reasonMenuButton.setAttribute('aria-expanded', String(isOpen));
  }

  function setReportFieldsLocked(isLocked) {
    reasonMenuButton.disabled = isLocked;
    detailsInput.readOnly = isLocked;
    submitButton.disabled = isLocked;
    submitButton.textContent = isLocked ? 'Already reported' : 'Submit report';

    if (isLocked) {
      setReasonMenuOpen(false);
    }
  }

  function getReportTargetKey(options = {}) {
    const targetType = options.target?.type || options.targetType;
    const targetId = options.target?.id || options.targetId;
    if (!targetType || !targetId) return null;
    return `${targetType}:${targetId}`;
  }

  async function lockExistingReportIfNeeded(options = {}) {
    const targetType = options.target?.type || options.targetType;
    const targetId = options.target?.id || options.targetId;
    if (!targetType || !targetId) return;

    const targetKey = getReportTargetKey(options);
    setStatus('Checking report status...');

    try {
      const params = new URLSearchParams({ targetType, targetId });
      const response = await fetch(`/api/reports/status?${params.toString()}`, {
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setStatus('Sign in to submit a report.', 'error');
        setReportFieldsLocked(true);
        return;
      }

      if (!response.ok) {
        setStatus('');
        return;
      }

      if (!result.report) {
        if (targetKey) {
          reportStatusCache.set(targetKey, null);
        }
        setStatus('');
        return;
      }

      if (targetKey) {
        reportStatusCache.set(targetKey, result.report);
      }
      options.existingReport = result.report;
      if (activeReportContext && getReportTargetKey(activeReportContext) === targetKey) {
        activeReportContext.existingReport = result.report;
      }
      setSelectedReason(result.report.reason);
      detailsInput.value = result.report.details || '';
      setReportFieldsLocked(true);
      setStatus('You have already submitted a report for this post.', 'error');
    } catch (error) {
      console.error('Failed to check report status:', error);
      setStatus('');
    }
  }

  function ensureReportContainer() {
    if (reportContainer) return;

    reportContainer = document.createElement('section');
    reportContainer.className = 'report-container';
    reportContainer.setAttribute('role', 'dialog');
    reportContainer.setAttribute('aria-modal', 'true');
    reportContainer.setAttribute('aria-labelledby', 'report-container-title');

    const header = document.createElement('div');
    header.className = 'report-container-header';

    titleText = document.createElement('h2');
    titleText.className = 'report-container-title';
    titleText.id = 'report-container-title';
    titleText.textContent = 'Report';

    form = document.createElement('form');
    form.className = 'report-container-form';

    const reasonField = document.createElement('label');
    reasonField.className = 'report-container-field';

    const reasonLabel = document.createElement('span');
    reasonLabel.className = 'report-container-label';
    reasonLabel.textContent = 'Reason';

    reasonSelect = document.createElement('input');
    reasonSelect.type = 'hidden';
    reasonSelect.name = 'reason';

    const reasonMenu = document.createElement('div');
    reasonMenu.className = 'report-container-reason-menu';

    reasonMenuButton = document.createElement('button');
    reasonMenuButton.type = 'button';
    reasonMenuButton.className = 'report-container-reason-button';
    reasonMenuButton.setAttribute('aria-haspopup', 'listbox');
    reasonMenuButton.setAttribute('aria-expanded', 'false');

    reasonMenuList = document.createElement('div');
    reasonMenuList.className = 'report-container-reason-options';
    reasonMenuList.setAttribute('role', 'listbox');
    reasonMenuList.hidden = true;

    reportReasons.forEach((reason) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'report-container-reason-option';
      option.dataset.reason = reason.value;
      option.textContent = reason.label;
      option.setAttribute('role', 'option');
      reasonMenuList.appendChild(option);
    });

    setSelectedReason(reportReasons[0].value);
    reasonMenu.append(reasonMenuButton, reasonMenuList, reasonSelect);

    const detailsField = document.createElement('label');
    detailsField.className = 'report-container-field';

    const detailsLabel = document.createElement('span');
    detailsLabel.className = 'report-container-label';
    detailsLabel.textContent = 'Details';

    detailsInput = document.createElement('textarea');
    detailsInput.className = 'report-container-details';
    detailsInput.name = 'details';
    detailsInput.maxLength = 3000;
    detailsInput.placeholder = 'Add anything that will help us review this.';

    submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'report-container-submit';
    submitButton.textContent = 'Submit report';

    statusText = document.createElement('p');
    statusText.className = 'report-container-status';
    statusText.setAttribute('role', 'status');

    header.appendChild(titleText);
    reasonField.append(reasonLabel, reasonMenu);
    detailsField.append(detailsLabel, detailsInput);
    form.append(reasonField, detailsField, submitButton, statusText);
    reportContainer.append(header, form);
    document.body.appendChild(reportContainer);

    reasonMenuButton.addEventListener('click', () => {
      setReasonMenuOpen(reasonMenuList.hidden);
    });
    reasonMenuList.addEventListener('click', (event) => {
      const option = event.target.closest('.report-container-reason-option');
      if (!option) return;
      setSelectedReason(option.dataset.reason);
      setReasonMenuOpen(false);
      reasonMenuButton.focus();
    });
    document.addEventListener('click', (event) => {
      if (!reasonMenu.contains(event.target)) {
        setReasonMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isContainerVisible(reportContainer)) {
        if (!reasonMenuList.hidden) {
          setReasonMenuOpen(false);
          return;
        }
        closeReportContainer();
      }
    });
    form.addEventListener('submit', submitReport);
  }

  function getErrorMessage(payload, fallback) {
    return payload?.error?.message || payload?.message || payload?.error || fallback;
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!activeReportContext || submitButton.disabled) return;

    const account = getStoredAccount();
    if (!account) {
      setStatus('Sign in to submit a report.', 'error');
      return;
    }

    const reporter = {
      accountId: account?.id || null,
      usernameSnapshot: account?.username || null,
      computerId: getReportClientId()
    };

    const payload = {
      ...activeReportContext,
      reporter,
      reason: reasonSelect.value,
      details: detailsInput.value.trim(),
      context: {
        ...(activeReportContext.context || {}),
        pageUrl: window.location.href
      }
    };

    submitButton.disabled = true;
    setStatus('Submitting report...');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(
          getErrorMessage(result, 'Failed to submit report.'),
          'error'
        );
        if (response.status === 409) {
          if (activeReportContext) {
            activeReportContext.existingReport = {
              reason: reasonSelect.value,
              details: detailsInput.value.trim(),
              status: 'open'
            };
          }
          setReportFieldsLocked(true);
        }
        return;
      }

      setStatus('Report submitted. Thank you.', 'success');
      setReportFieldsLocked(true);
      if (activeReportContext) {
        const targetKey = getReportTargetKey(activeReportContext);
        activeReportContext.existingReport = {
          reason: reasonSelect.value,
          details: detailsInput.value.trim(),
          status: 'open'
        };
        if (targetKey) {
          reportStatusCache.set(targetKey, activeReportContext.existingReport);
        }
      }

      if (typeof activeReportContext.onSubmitted === 'function') {
        activeReportContext.onSubmitted(result);
      }
    } catch (error) {
      console.error('Failed to submit report:', error);
      setStatus('Server error submitting report.', 'error');
    } finally {
      if (!activeReportContext?.existingReport) {
        submitButton.disabled = false;
      }
    }
  }

  function setReportContainerContext(options = {}) {
    ensureReportContainer();
    activeReportContext = options;
    titleText.textContent = options.title || 'Report';
    setSelectedReason(options.defaultReason || 'harassment');
    setReasonMenuOpen(false);
    detailsInput.value = '';
    setReportFieldsLocked(false);
    setStatus();

    const targetKey = getReportTargetKey(options);
    const existingReport =
      options.existingReport ||
      (targetKey && reportStatusCache.has(targetKey)
        ? reportStatusCache.get(targetKey)
        : null);

    if (existingReport) {
      options.existingReport = existingReport;
      setSelectedReason(existingReport.reason);
      detailsInput.value = existingReport.details || '';
      setReportFieldsLocked(true);
      setStatus('You have already submitted a report for this post.', 'error');
    }
  }

  window.prepareReportContainer = async function prepareReportContainer(options = {}) {
    setReportContainerContext(options);
    lockExistingReportIfNeeded(options);
  };

  window.openReportContainer = function openReportContainer(options = {}) {
    setReportContainerContext(options);
    showContainer(reportContainer);
    addElementIfNotExists(popUpClassArray, reportContainer);
    toggleOverlay(true);
    reasonMenuButton.focus();
  };

  window.closeReportContainer = closeReportContainer;
  window.getReportContainerElement = function getReportContainerElement() {
    ensureReportContainer();
    return reportContainer;
  };
})();
