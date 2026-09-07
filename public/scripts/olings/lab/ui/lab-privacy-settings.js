(function () {
  function createOlingLabPrivacySettings({
    state,
    elements,
    endpoint,
    parsePayload,
    setStatus,
    playSound = window.playSoundEffect
  }) {
    const visibilityOrder = ['private', 'friends-only', 'public'];
    const visibilityLabels = {
      private: 'Private',
      'friends-only': 'Friends Only',
      public: 'Public'
    };
    const visibilitySounds = {
      private: 'olingLabPrivacyPrivate',
      'friends-only': 'olingLabPrivacyFriendsOnly',
      public: 'olingLabPrivacyPublic'
    };
    let updating = false;

    function getVisibility() {
      const visibility =
        state.labPrivacy?.visibility || state.lab?.visibility || 'private';
      return visibilityOrder.includes(visibility) ? visibility : 'private';
    }

    function getVisibilityLabel(visibility = getVisibility()) {
      return visibilityLabels[visibility] || visibilityLabels.private;
    }

    function playVisibilitySound(visibility) {
      const soundKey = visibilitySounds[visibility];
      if (!soundKey || typeof playSound !== 'function') return;
      Promise.resolve(playSound(soundKey)).catch(() => {});
    }

    function sync() {
      const isVisitor = Boolean(state.visitorMode);
      elements.page?.classList.toggle('is-visitor-mode', isVisitor);

      if (elements.editToggle) elements.editToggle.hidden = isVisitor;
      if (elements.customiseTools && isVisitor) {
        elements.customiseTools.hidden = true;
      }

      if (elements.viewingLabel) {
        const owner =
          state.labOwner?.displayName || state.labOwner?.username || '';
        elements.viewingLabel.hidden = !isVisitor || !owner;
        elements.viewingLabel.textContent = owner ? `${owner}'s Oling Lab` : '';
        if (isVisitor && owner) {
          document.title = `${owner}'s Oling Lab | OVEREXPOSED`;
        }
      }
    }

    async function updateVisibility(visibility) {
      if (state.visitorMode || state.tutorialMode || updating) {
        return getVisibility();
      }
      const previous = getVisibility();
      updating = true;
      setStatus('Updating lab privacy...');
      try {
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ visibility })
        });
        const payload = await parsePayload(response);
        state.labPrivacy = payload.privacy || { visibility };
        if (state.lab) state.lab.visibility = state.labPrivacy.visibility;
        setStatus(payload.message || 'Lab privacy updated.');
        playVisibilitySound(state.labPrivacy.visibility);
        window.dispatchEvent(
          new CustomEvent('oling-lab:privacy-changed', {
            detail: { visibility: state.labPrivacy.visibility }
          })
        );
        return state.labPrivacy.visibility;
      } catch (error) {
        setStatus(error.message || 'Could not update lab privacy.');
        return previous;
      } finally {
        updating = false;
      }
    }

    function cycleVisibility() {
      const currentIndex = visibilityOrder.indexOf(getVisibility());
      const nextVisibility =
        visibilityOrder[(currentIndex + 1) % visibilityOrder.length];
      return updateVisibility(nextVisibility);
    }

    window.addEventListener('oling-lab:ready', sync);
    sync();

    return {
      cycleVisibility,
      getVisibility,
      getVisibilityLabel,
      isUpdating: () => updating,
      sync,
      updateVisibility
    };
  }

  window.createOlingLabPrivacySettings = createOlingLabPrivacySettings;
})();
