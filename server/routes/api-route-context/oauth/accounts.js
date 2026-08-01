function createOAuthAccountTools({
  bcrypt,
  crypto,
  unlockAchievementByKey,
  formatReportLabel,
  Account,
  Achievement,
  accountSaltRounds
}) {
  function buildSocialUsername(profile, provider) {
    const base =
      profile.email?.split('@')[0] ||
      profile.displayName ||
      `${provider}-${profile.providerUserId}`;

    return String(base)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 24)
      .replace(/^[.-]+|[.-]+$/g, '');
  }

  async function reserveSocialUsername(profile, provider) {
    const base = buildSocialUsername(profile, provider) || `${provider}-user`;
    const safeBase = base.length >= 3 ? base : `${base}-user`;

    for (let index = 0; index < 20; index += 1) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const username = `${safeBase.slice(0, 30 - suffix.length)}${suffix}`;
      const existing = await Account.exists({ username });
      if (!existing) return username;
    }

    return `${safeBase.slice(0, 21)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  async function createSocialAccount(
    provider,
    profile,
    signupContext = null,
    legalConsent = null
  ) {
    const normalizedEmail = profile.email?.toLowerCase() || null;

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      const error = new Error(
        `${provider} did not provide a valid email address for account creation`
      );
      error.status = 400;
      error.code = 'social_email_required';
      throw error;
    }

    const username = await reserveSocialUsername(profile, provider);
    const passwordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('base64url'),
      accountSaltRounds
    );
    if (!legalConsent) {
      const error = new Error(
        'Accept the terms and privacy policy before creating an account.'
      );
      error.status = 400;
      error.code = 'legal_consent_required';
      throw error;
    }

    const account = await Account.create({
      username,
      email: normalizedEmail,
      passwordHash,
      profile: {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        emailVerified: Boolean(normalizedEmail),
        emailVerifiedAt: normalizedEmail ? new Date() : null,
        accountStatus: 'active',
        loginProviders: [
          { name: provider, providerUserId: profile.providerUserId }
        ]
      },
      legalConsent,
      analytics: signupContext ? { signupContext } : undefined
    });

    await unlockAchievementByKey({
      Achievement,
      account,
      key: 'welcome-to-the-party',
      source: 'social-account-created'
    });
    if (account.profile?.emailVerified) {
      await unlockAchievementByKey({
        Achievement,
        account,
        key: 'verified',
        source: 'social-email-verified'
      });
    }

    return account;
  }

  async function findOrCreateSocialAccount(
    provider,
    profile,
    signupContext = null,
    legalConsent = null
  ) {
    const accountByProvider = await Account.findOne({
      'profile.loginProviders': {
        $elemMatch: { name: provider, providerUserId: profile.providerUserId }
      }
    }).select('+security');

    if (accountByProvider) return accountByProvider;

    const accountByEmail = profile.email
      ? await Account.findOne({ email: profile.email.toLowerCase() }).select(
          '+security'
        )
      : null;

    if (accountByEmail) {
      const providers = accountByEmail.profile.loginProviders || [];
      const alreadyLinked = providers.some(
        (linkedProvider) =>
          linkedProvider.name === provider &&
          linkedProvider.providerUserId === profile.providerUserId
      );

      if (!alreadyLinked) {
        providers.push({
          name: provider,
          providerUserId: profile.providerUserId
        });
      }

      if (profile.displayName && !accountByEmail.profile.displayName) {
        accountByEmail.profile.displayName = profile.displayName;
      }
      if (profile.avatarUrl && !accountByEmail.profile.avatarUrl) {
        accountByEmail.profile.avatarUrl = profile.avatarUrl;
      }

      await accountByEmail.save();
      return accountByEmail;
    }

    return createSocialAccount(provider, profile, signupContext, legalConsent);
  }

  async function linkOAuthProviderToAccount(account, provider, profile) {
    const existingProviderAccount = await Account.findOne({
      _id: { $ne: account._id },
      'profile.loginProviders': {
        $elemMatch: { name: provider, providerUserId: profile.providerUserId }
      }
    });

    if (existingProviderAccount) {
      const error = new Error(
        `${formatReportLabel(provider)} is already linked to another account`
      );
      error.status = 409;
      error.code = 'provider_already_linked';
      throw error;
    }

    const providers = account.profile.loginProviders || [];
    const alreadyLinked = providers.some(
      (linkedProvider) =>
        linkedProvider.name === provider &&
        linkedProvider.providerUserId === profile.providerUserId
    );

    if (!alreadyLinked) {
      providers.push({
        name: provider,
        providerUserId: profile.providerUserId
      });
    }

    if (profile.displayName && !account.profile.displayName) {
      account.profile.displayName = profile.displayName;
    }
    if (profile.avatarUrl && !account.profile.avatarUrl) {
      account.profile.avatarUrl = profile.avatarUrl;
    }

    if (
      profile.email &&
      account.email &&
      profile.email.toLowerCase() === account.email.toLowerCase()
    ) {
      account.profile.emailVerified = true;
      account.profile.emailVerifiedAt =
        account.profile.emailVerifiedAt || new Date();
      if (account.profile.accountStatus === 'pending_verification') {
        account.profile.accountStatus = 'active';
      }
    }

    if (account.profile?.emailVerified) {
      await unlockAchievementByKey({
        Achievement,
        account,
        key: 'verified',
        source: 'social-email-verified',
        save: false
      });
    }

    await account.save();
    return account;
  }

  return {
    buildSocialUsername,
    reserveSocialUsername,
    createSocialAccount,
    findOrCreateSocialAccount,
    linkOAuthProviderToAccount
  };
}

module.exports = { createOAuthAccountTools };
