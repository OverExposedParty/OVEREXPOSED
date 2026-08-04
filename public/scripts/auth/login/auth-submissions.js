(function () {
  const AUTH_NAVIGATION_SOUND_TIMEOUT_MS = 1600;

  function createLoginAuthSubmissions({ session, ui }) {
    function getAuthEntryPoint() {
      return typeof session.getAuthEntryPoint === 'function'
        ? session.getAuthEntryPoint()
        : 'direct_auth_url';
    }

    function trackAuthCompletion(properties) {
      window.OEAnalytics?.track('auth.completed', properties);
      if (properties.entryPoint !== 'account_notification') return;
      window.OEAnalytics?.track('notification.conversion', {
        notificationKey: 'create_account_prompt',
        notificationType: 'account-prompt',
        flow: properties.flow,
        provider: properties.provider
      });
    }

    function playAuthSound(soundKey, options) {
      if (!soundKey || typeof window.playSoundEffect !== 'function') {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(window.playSoundEffect(soundKey, options)).catch(
          () => null
        );
      } catch {
        return Promise.resolve(null);
      }
    }

    async function waitForAuthSound(playbackPromise) {
      const playback = await playbackPromise;
      const audio = playback?.source;
      if (
        !audio ||
        audio.ended ||
        typeof audio.addEventListener !== 'function'
      ) {
        return;
      }

      await new Promise((resolve) => {
        let settled = false;
        let timeoutId = null;
        const events = ['ended', 'error', 'pause'];
        const finish = () => {
          if (settled) return;
          settled = true;
          events.forEach((eventName) => {
            audio.removeEventListener?.(eventName, finish);
          });
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          resolve();
        };

        events.forEach((eventName) => {
          audio.addEventListener(eventName, finish, { once: true });
        });
        timeoutId = window.setTimeout(finish, AUTH_NAVIGATION_SOUND_TIMEOUT_MS);
      });
    }

    async function handleLoginSubmit(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const data = session.getFormData(form);
      if (!data.identifier || !data.password) {
        ui.setAuthStatus('Enter your email or username and password.', 'error');
        playAuthSound('uiError');
        return;
      }

      playAuthSound('uiSelect');
      ui.setSubmitting(form, true);
      ui.setAuthStatus('Signing in...');
      const analyticsProperties = {
        flow: 'signin',
        provider: 'email',
        entryPoint: getAuthEntryPoint()
      };
      window.OEAnalytics?.track('auth.attempted', analyticsProperties);
      try {
        const payload = await session.postJson('/api/accounts/login', {
          identifier: data.identifier.toLowerCase(),
          password: data.password,
          oeIcon: session.getLocalOeIcon()
        });
        session.storeAccount(payload.account);
        trackAuthCompletion({
          ...analyticsProperties,
          outcome: 'success'
        });
        ui.setAuthStatus('You are signed in.', 'success');
        const navigationSound = waitForAuthSound(
          playAuthSound('notificationSuccess')
        );
        const conflictShown = session.showActivePartyConflict?.(
          payload.activePartyConflict,
          {
            account: payload.account,
            navigationOptions: { beforeNavigate: navigationSound }
          }
        );
        if (!conflictShown) {
          session.redirectAfterLogin(payload.account, {
            beforeNavigate: navigationSound
          });
        }
      } catch (error) {
        window.OEAnalytics?.track('auth.failed', {
          ...analyticsProperties,
          outcome: 'error',
          reason: error.status === 429 ? 'rate_limited' : 'credentials'
        });
        ui.setAuthStatus(error.message, 'error');
        playAuthSound(
          error.status === 429 ? 'uiWarning' : 'notificationFailure'
        );
      } finally {
        ui.setSubmitting(form, false);
      }
    }

    async function handleSignupSubmit(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const data = session.getFormData(form);
      if (!document.getElementById('signup-terms')?.checked) {
        ui.setAuthStatus(
          'Accept the terms and privacy policy to continue.',
          'error'
        );
        playAuthSound('uiError');
        return;
      }
      if (
        !data.username ||
        !data.email ||
        !data.password ||
        !data.confirmPassword
      ) {
        ui.setAuthStatus(
          'Fill in username, email, password, and confirm password.',
          'error'
        );
        playAuthSound('uiError');
        return;
      }
      if (data.password !== data.confirmPassword) {
        ui.setAuthStatus('Passwords do not match.', 'error');
        playAuthSound('uiError');
        return;
      }

      playAuthSound('uiSelect');
      ui.setSubmitting(form, true);
      ui.setAuthStatus('Creating account...');
      const analyticsProperties = {
        flow: 'signup',
        provider: 'email',
        entryPoint: getAuthEntryPoint()
      };
      window.OEAnalytics?.track('auth.attempted', analyticsProperties);
      try {
        await session.postJson('/api/accounts', {
          username: data.username.toLowerCase(),
          email: data.email.toLowerCase(),
          confirmPassword: data.confirmPassword,
          password: data.password,
          termsAccepted: true,
          privacyPolicyAccepted: true,
          marketingEmailOptIn:
            document.getElementById('signup-marketing-email')?.checked === true,
          oeIcon: session.getLocalOeIcon(),
          signupReferrerPath: session.getReturnToPath()
        });
        const loginPayload = await session.postJson('/api/accounts/login', {
          identifier: data.email.toLowerCase(),
          password: data.password,
          oeIcon: session.getLocalOeIcon()
        });
        session.storeAccount(loginPayload.account);
        trackAuthCompletion({
          ...analyticsProperties,
          outcome: 'success'
        });
        ui.setAuthStatus('Account created. You are signed in.', 'success');
        const navigationSound = waitForAuthSound(
          playAuthSound('accountCreated')
        );
        const conflictShown = session.showActivePartyConflict?.(
          loginPayload.activePartyConflict,
          {
            account: loginPayload.account,
            navigationOptions: { beforeNavigate: navigationSound }
          }
        );
        if (!conflictShown) {
          session.redirectAfterLogin(loginPayload.account, {
            beforeNavigate: navigationSound
          });
        }
      } catch (error) {
        window.OEAnalytics?.track('auth.failed', {
          ...analyticsProperties,
          outcome: 'error',
          reason: error.status === 429 ? 'rate_limited' : 'validation'
        });
        ui.setAuthStatus(error.message, 'error');
        playAuthSound(
          error.status === 429 ? 'uiWarning' : 'notificationFailure'
        );
      } finally {
        ui.setSubmitting(form, false);
      }
    }

    async function handlePasswordResetRequestSubmit(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const data = session.getFormData(form);
      if (!data.identifier) {
        ui.setAuthStatus('Enter your email or username.', 'error');
        playAuthSound('uiError');
        return;
      }

      playAuthSound('uiSelect');
      ui.setSubmitting(form, true);
      ui.setAuthStatus('Sending reset link...');
      try {
        const payload = await session.postJson(
          '/api/accounts/password-reset/request',
          {
            identifier: data.identifier.toLowerCase()
          }
        );
        ui.setAuthStatus(
          payload.message || 'Check your email for a reset link.',
          'success'
        );
        playAuthSound('accountEmailSent');
        form.reset();
        ui.updateSubmitButtonState(form);
      } catch (error) {
        ui.setAuthStatus(error.message, 'error');
        playAuthSound(
          error.status === 429 ? 'uiWarning' : 'notificationFailure'
        );
      } finally {
        ui.setSubmitting(form, false);
      }
    }

    function bindSocialAuthButtons(buttons) {
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const provider = button.dataset.socialProvider;
          const form = button.closest('[data-auth-form]');
          const isSignup = form?.dataset.authForm === 'signup';
          const mode = isSignup ? 'signup' : 'sign-in';
          if (isSignup && !document.getElementById('signup-terms')?.checked) {
            ui.setAuthStatus(
              'Accept the terms and privacy policy to continue.',
              'error'
            );
            playAuthSound('uiError');
            return;
          }

          const params = new URLSearchParams({ mode });
          const entryPoint = getAuthEntryPoint();
          params.set('authEntryPoint', entryPoint);
          window.OEAnalytics?.track('auth.attempted', {
            flow: isSignup ? 'signup' : 'signin',
            provider,
            entryPoint
          });
          const returnToPath = session.getReturnToPath();
          if (returnToPath) params.set('returnTo', returnToPath);
          params.set('splashScreen', session.getReturnSplashScreen());
          if (isSignup) params.set('legalConsentAccepted', 'true');
          if (
            isSignup &&
            document.getElementById('signup-marketing-email')?.checked === true
          ) {
            params.set('marketingEmailOptIn', 'true');
          }
          window.location.href = `/api/auth/${provider}/start?${params.toString()}`;
        });
      });
    }

    return {
      bindSocialAuthButtons,
      handleLoginSubmit,
      handlePasswordResetRequestSubmit,
      handleSignupSubmit
    };
  }

  window.createLoginAuthSubmissions = createLoginAuthSubmissions;
})();
