(function () {
  const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cache = {
    adminLogs: null,
    achievements: null,
    dashboardActivity: null,
    dashboardOverview: null,
    emailTemplates: null,
    oeCustomisation: null,
    olings: null,
    overexposureDashboard: null,
    overexposurePosts: null,
    partyRooms: null,
    shopProducts: null,
    socialMedia: null,
    system: null,
    users: null
  };

  async function fetchJsonData(endpoint, options) {
    const response = await fetch(endpoint);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || options.errorMessage);
    }

    return options.resolve(payload);
  }

  function getCached(key, endpoint, options) {
    if (options.force) {
      cache[key] = null;
    }

    if (!cache[key]) {
      cache[key] = fetchJsonData(endpoint, options).catch((error) => {
        console.error(options.logMessage, error);
        return options.fallback;
      });
    }

    return cache[key];
  }

  function clear(key) {
    if (key in cache) {
      cache[key] = null;
    }
  }

  function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return dateTimeFormatter.format(date);
  }

  function formatMoney(price) {
    if (!price) return '-';

    const amount =
      typeof price === 'number'
        ? price
        : Number(price.amount ?? price.value ?? price.base);
    if (!Number.isFinite(amount)) return '-';

    const currency = price.currency || price.currencyCode || 'GBP';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency
      }).format(amount);
    } catch (error) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  function mapShopProductRow(product) {
    const identity = product.identity || {};
    const publishing = product.publishing || {};
    const system = product.system || {};
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const publishedAt = product.publishedAt || publishing.publishedAt;
    const status =
      publishing.status ||
      publishing.visibility ||
      (publishedAt ? 'Published' : '-');

    return {
      product: product.name || identity.name || '-',
      price: formatMoney(product.price),
      stock: variants.length
        ? `${variants.length} variant${variants.length === 1 ? '' : 's'}`
        : '-',
      status,
      productId: system.id || '-',
      sku: product.defaultVariantSku || '-',
      type: identity.type || '-',
      publishedAt: formatDateTime(publishedAt),
      updatedAt: formatDateTime(system.updatedAt),
      description: identity.shortDescription || identity.description || '-'
    };
  }

  function formatStatus(post) {
    const visibility = post.public?.visibility || post.visibility || 'public';
    if (post.lifecycle?.deletedAt || visibility === 'deleted') return 'Deleted';
    if (post.lifecycle?.hiddenAt || visibility === 'hidden') return 'Hidden';
    return 'Published';
  }

  function formatAuthor(post) {
    const author = post.author || {};
    if (!author.isAnonymous && author.usernameSnapshot) {
      return author.usernameSnapshot;
    }
    if (author.accountId && !author.isAnonymous) {
      return 'Account user';
    }
    return 'Anonymous';
  }

  function getOverexposurePostUrl(post) {
    const publicId = post.public?.id || post.id;
    const x = Number(post.placement?.x ?? post.x);
    const y = Number(post.placement?.y ?? post.y);
    const hasCoordinates = Number.isFinite(x) && Number.isFinite(y);
    const slug = hasCoordinates
      ? `${Math.round(x)}-${Math.round(y)}`
      : publicId;

    return slug
      ? `/overexposure/${encodeURIComponent(slug)}`
      : '/overexposure/';
  }

  function mapOverexposurePostRow(post) {
    const publicId = post.public?.id || post.id || '';
    const postedAt =
      post.lifecycle?.postedAt ||
      post.date ||
      post.system?.createdAt ||
      post.createdAt;
    const updatedAt = post.system?.updatedAt || post.updatedAt;
    const x = post.placement?.x ?? post.x ?? '-';
    const y = post.placement?.y ?? post.y ?? '-';

    return {
      date: formatDateTime(postedAt),
      dateKey: postedAt ? new Date(postedAt).toISOString().slice(0, 10) : '-',
      sortDate: postedAt,
      post: post.content?.title || post.title || 'Untitled post',
      postUrl: getOverexposurePostUrl(post),
      author: formatAuthor(post),
      status: formatStatus(post),
      tag: post.public?.tag || post.tag || '-',
      publicId,
      updatedAt: formatDateTime(updatedAt),
      coordinates: `${x}, ${y}`,
      visibility: post.public?.visibility || post.visibility || 'public',
      excerpt: String(post.content?.text ?? post.text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
    };
  }

  function formatPlatformLabel(platform) {
    const labels = {
      tiktok: 'TikTok',
      instagram: 'Instagram',
      'youtube-shorts': 'YouTube Shorts',
      x: 'X'
    };

    return labels[platform] || platform || '-';
  }

  function mapSocialMediaRow(item) {
    const platforms = Array.isArray(item.platforms) ? item.platforms : [];

    return {
      ...item,
      platforms,
      platformsLabel: platforms.length
        ? platforms.map(formatPlatformLabel).join(', ')
        : '-',
      updatedAtLabel: formatDateTime(item.updatedAt)
    };
  }

  function mapEmailTemplateRow(template) {
    const version = Number(template.version || 1);
    const status = String(template.status || 'draft');
    return {
      template: template.name || 'Untitled Email Template',
      category: template.category || 'transactional',
      version: `v${version}`,
      status: `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
      templateId: template.id || template._id || '',
      key: template.key || '-',
      subject: template.subject || '-',
      publishedVersion: template.publishedVersion
        ? `v${template.publishedVersion}`
        : '-',
      updatedAt: formatDateTime(template.updatedAt),
      publishedAt: formatDateTime(template.publishedAt)
    };
  }

  function fetchPartyRoomsData(options = {}) {
    return getCached('partyRooms', '/api/oe-panel/party-rooms', {
      force: options.force,
      errorMessage: 'Failed to load party rooms',
      fallback: { rooms: [], packs: [], rules: [], gamemodes: [], stats: {} },
      logMessage: 'Failed to load OE Panel party rooms:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchDashboardActivityData(options = {}) {
    return getCached('dashboardActivity', '/api/oe-panel/dashboard-activity', {
      force: options.force,
      errorMessage: 'Failed to load dashboard activity',
      fallback: {},
      logMessage: 'Failed to load OE Panel dashboard activity:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchDashboardOverviewData(options = {}) {
    return getCached('dashboardOverview', '/api/oe-panel/dashboard-overview', {
      force: options.force,
      errorMessage: 'Failed to load dashboard overview',
      fallback: {},
      logMessage: 'Failed to load OE Panel dashboard overview:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchAnalyticsData(options = {}) {
    return getCached('analytics', '/api/oe-panel/analytics', {
      force: options.force,
      errorMessage: 'Failed to load analytics panel data',
      fallback: {
        stats: {},
        popularPages: [],
        acquisitionSources: [],
        alerts: []
      },
      logMessage: 'Failed to load OE Panel analytics:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchSystemData(options = {}) {
    return getCached('system', '/api/oe-panel/system', {
      force: options.force,
      errorMessage: 'Failed to load system panel data',
      fallback: { status: {}, configRows: [], alerts: [] },
      logMessage: 'Failed to load OE Panel system data:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchModerationData(options = {}) {
    return getCached('moderation', '/api/oe-panel/moderation', {
      force: options.force,
      errorMessage: 'Failed to load moderation panel data',
      fallback: {
        stats: {},
        prioritySignals: [],
        repeatOffenders: [],
        recentDecisions: []
      },
      logMessage: 'Failed to load OE Panel moderation:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchAdminLogsData(options = {}) {
    return getCached('adminLogs', '/api/oe-panel/admin-logs', {
      force: options.force,
      errorMessage: 'Failed to load admin logs',
      fallback: { logs: [], stats: {}, alerts: [] },
      logMessage: 'Failed to load OE Panel admin logs:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchAchievementsData(options = {}) {
    return getCached('achievements', '/api/oe-panel/achievements', {
      force: options.force,
      errorMessage: 'Failed to load achievements',
      fallback: {
        stats: {},
        library: [],
        analytics: [],
        playerProgress: [],
        triggers: [],
        reviewAlerts: []
      },
      logMessage: 'Failed to load OE Panel achievements:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchOeCustomisationData(options = {}) {
    return getCached('oeCustomisation', '/api/oe-panel/oe-customisation', {
      force: options.force,
      errorMessage: 'Failed to load OE customisation panel data',
      fallback: { stats: {}, packs: [], images: [], galleryItems: [] },
      logMessage: 'Failed to load OE Panel customisation:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchOlingsData(options = {}) {
    return getCached('olings', '/api/oe-panel/olings', {
      force: options.force,
      errorMessage: 'Failed to load oLings panel data',
      fallback: {
        stats: {},
        eggs: [],
        traits: [],
        buildSets: [],
        hatchReceipts: [],
        playerOlings: [],
        rarityBalancer: [],
        warnings: []
      },
      logMessage: 'Failed to load OE Panel oLings:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchShopProductsData(options = {}) {
    return getCached('shopProducts', '/api/oe-panel/shop/products', {
      force: options.force,
      errorMessage: 'Failed to load shop products',
      fallback: { products: [], stats: {}, alerts: [] },
      logMessage: 'Failed to load OE Panel shop products:',
      resolve: (payload) => {
        const data = payload.data || {};
        const products = Array.isArray(data.products)
          ? data.products
          : Array.isArray(payload)
            ? payload.map(mapShopProductRow)
            : [];

        return {
          products,
          stats: data.stats || {},
          alerts: Array.isArray(data.alerts) ? data.alerts : []
        };
      }
    });
  }

  function fetchSocialMediaData(options = {}) {
    return getCached('socialMedia', '/api/oe-panel/social-media', {
      force: options.force,
      errorMessage: 'Failed to load social media panel data',
      fallback: { rows: [], stats: {}, alerts: [] },
      logMessage: 'Failed to load OE Panel social media data:',
      resolve: (payload) => ({
        rows: Array.isArray(payload.data?.rows)
          ? payload.data.rows.map(mapSocialMediaRow)
          : [],
        stats: payload.data?.stats || {},
        alerts: Array.isArray(payload.data?.alerts) ? payload.data.alerts : []
      })
    });
  }

  function fetchEmailTemplatesData(options = {}) {
    return getCached('emailTemplates', '/api/oe-panel/emails/templates', {
      force: options.force,
      errorMessage: 'Failed to load email templates',
      fallback: { templates: [] },
      logMessage: 'Failed to load OE Panel email templates:',
      resolve: (payload) => ({
        templates: Array.isArray(payload.data?.templates)
          ? payload.data.templates.map(mapEmailTemplateRow)
          : []
      })
    });
  }

  function fetchOverexposurePostsData(options = {}) {
    return getCached('overexposurePosts', '/api/overexposure-posts', {
      force: options.force,
      errorMessage: 'Failed to load Overexposure posts',
      fallback: [],
      logMessage: 'Failed to load OE Panel Overexposure posts:',
      resolve: (payload) => {
        const posts = Array.isArray(payload) ? payload : payload.data;
        if (!Array.isArray(posts)) return [];

        return posts.map(mapOverexposurePostRow).sort((left, right) => {
          const leftTime = new Date(left.sortDate || 0).getTime();
          const rightTime = new Date(right.sortDate || 0).getTime();
          return rightTime - leftTime;
        });
      }
    });
  }

  function fetchOverexposureDashboardData(options = {}) {
    return getCached('overexposureDashboard', '/api/oe-panel/overexposure', {
      force: options.force,
      errorMessage: 'Failed to load Overexposure panel data',
      fallback: { stats: {}, reportedContent: [] },
      logMessage: 'Failed to load OE Panel Overexposure data:',
      resolve: (payload) => payload.data || {}
    });
  }

  function fetchUsersData(options = {}) {
    return getCached('users', '/api/oe-panel/users', {
      force: options.force,
      errorMessage: 'Failed to load users',
      fallback: { users: [], signupCountByDate: {}, stats: {} },
      logMessage: 'Failed to load OE Panel users:',
      resolve: (payload) => ({
        users: Array.isArray(payload.data?.users) ? payload.data.users : [],
        accountFlags: Array.isArray(payload.data?.accountFlags)
          ? payload.data.accountFlags
          : [],
        signupCountByDate: payload.data?.signupCountByDate || {},
        stats: payload.data?.stats || {}
      })
    });
  }

  window.OE_PANEL_DATA = {
    clear,
    fetchAnalyticsData,
    fetchAchievementsData,
    fetchAdminLogsData,
    fetchDashboardActivityData,
    fetchDashboardOverviewData,
    fetchEmailTemplatesData,
    fetchModerationData,
    fetchOeCustomisationData,
    fetchOlingsData,
    fetchOverexposureDashboardData,
    fetchOverexposurePostsData,
    fetchPartyRoomsData,
    fetchShopProductsData,
    fetchSocialMediaData,
    fetchSystemData,
    fetchUsersData,
    formatDateTime
  };
})();
