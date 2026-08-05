(function () {
  function createOePanelCatalogHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'OE Customisation') {
        const customisationData = await panelData.fetchOeCustomisationData();
        const stats = customisationData.stats || {};
        const packs = Array.isArray(customisationData.packs)
          ? customisationData.packs
          : [];
        const images = Array.isArray(customisationData.images)
          ? customisationData.images
          : [];
        const issues = Array.isArray(customisationData.issues)
          ? customisationData.issues
          : [];
        const galleryItems = Array.isArray(customisationData.galleryItems)
          ? customisationData.galleryItems
          : images;
        window.OE_PANEL_PALETTES?.indexRows('oe-pack', packs, {
          keyField: 'pack'
        });
        const statTableColumns = [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ];

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'oe-customisation-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              const statMap = {
                'Total OE Packs': {
                  value: stats.totalPacks,
                  detail: `${stats.activePacks ?? 0} active`
                },
                'Total OE Images': {
                  value: stats.totalImages,
                  detail: `${stats.blacklistedImages ?? 0} blacklisted`
                },
                'OE Related Errors': {
                  value: stats.issueCount,
                  detail: issues.length ? 'validation issues' : 'clear'
                },
                'Blacklisted OEs': {
                  value: stats.blacklistedImages,
                  detail: 'hidden from selection'
                }
              };
              const statData = statMap[stat.label] || {};
              const value =
                statData.value === undefined ? '-' : String(statData.value);
              const detail = statData.detail || '-';
              const rows =
                stat.label === 'OE Related Errors'
                  ? issues.slice(0, 12).map((issue) => ({
                      label: `${issue.severity}: ${issue.item}`,
                      value: issue.issue
                    }))
                  : [
                      { label: stat.label, value },
                      { label: 'Detail', value: detail }
                    ];

              return {
                ...stat,
                value,
                detail,
                expanded: {
                  type: 'table',
                  title: stat.label,
                  columns: statTableColumns,
                  rows: rows.length ? rows : [{ label: 'Status', value: 'Clear' }]
                }
              };
            });
            return;
          }

          if (Array.isArray(gridConfig.tableSeries)) {
            gridConfig.tableSeries = gridConfig.tableSeries.map((series) => {
              if (series.dataSource === 'oeCustomisationPacks') {
                return { ...series, rows: packs };
              }
              if (series.dataSource === 'oeCustomisationImages') {
                return { ...series, rows: images };
              }
              return series;
            });
            return;
          }

          if (gridConfig.id === 'oe-customisation-grid-3') {
            gridConfig.items = galleryItems.map((item) => ({
              ...item,
              galleryStatus:
                item.blacklisted === 'Yes' ? 'Blacklisted' : item.status || '-'
            }));
          }

          if (gridConfig.id === 'oe-customisation-grid-4') {
            gridConfig.oeIssues = issues;
          }
        });

        return true;
      }

      if (sectionName === 'oLings') {
        const olingsData = await panelData.fetchOlingsData();
        const stats = olingsData.stats || {};
        const eggs = Array.isArray(olingsData.eggs) ? olingsData.eggs : [];
        const traits = Array.isArray(olingsData.traits) ? olingsData.traits : [];
        const buildSets = Array.isArray(olingsData.buildSets)
          ? olingsData.buildSets
          : [];
        const hatchReceipts = Array.isArray(olingsData.hatchReceipts)
          ? olingsData.hatchReceipts
          : [];
        const playerOlings = Array.isArray(olingsData.playerOlings)
          ? olingsData.playerOlings
          : [];
        const rarityBalancer = Array.isArray(olingsData.rarityBalancer)
          ? olingsData.rarityBalancer
          : [];
        const warnings = Array.isArray(olingsData.warnings)
          ? olingsData.warnings
          : [];
        const statTableColumns = [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ];

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'olings-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              const statMap = {
                'Eggs Opened': {
                  value: stats.totalEggsOpened,
                  detail: `${stats.openedToday ?? 0} today`
                },
                'oLings Hatched': {
                  value: stats.totalOlings,
                  detail: `${stats.favoritedOlings ?? 0} favorited`
                },
                'Active Eggs': {
                  value: stats.activeEggs,
                  detail: `${stats.totalEggs ?? 0} total`
                },
                'Build Sets': {
                  value: stats.totalBuildSets,
                  detail: `${stats.totalTraits ?? 0} traits`
                }
              };
              const statData = statMap[stat.label] || {};
              const value =
                statData.value === undefined ? '-' : String(statData.value);
              const detail = statData.detail || '-';
              return {
                ...stat,
                value,
                detail,
                expanded: {
                  type: 'table',
                  title: stat.label,
                  columns: statTableColumns,
                  rows: [
                    { label: stat.label, value },
                    { label: 'Detail', value: detail },
                    { label: 'Warnings', value: String(warnings.length) }
                  ]
                }
              };
            });
            return;
          }

          if (gridConfig.dataSource === 'olingEggs') {
            gridConfig.rows = eggs;
            return;
          }

          if (gridConfig.id === 'olings-grid-5') {
            gridConfig.items = buildSets;
            return;
          }

          if (Array.isArray(gridConfig.tableSeries)) {
            const rowsBySource = {
              olingEggs: eggs,
              olingBuildSets: buildSets,
              olingTraits: traits,
              olingHatchReceipts: hatchReceipts,
              playerOlings,
              olingRarityBalancer: rarityBalancer,
              olingWarnings: warnings
            };
            gridConfig.tableSeries = gridConfig.tableSeries.map(
              (seriesConfig) => ({
                ...seriesConfig,
                rows: rowsBySource[seriesConfig.dataSource] || []
              })
            );
          }

          if (gridConfig.id === 'olings-grid-4') {
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              olingWarnings: warnings.length
            };
          }
        });

        return true;
      }

      if (sectionName === 'Achievements') {
        const achievementsData = await panelData.fetchAchievementsData();
        const stats = achievementsData.stats || {};
        const rowsBySource = {
          achievementLibrary: Array.isArray(achievementsData.library)
            ? achievementsData.library
            : [],
          achievementAnalytics: Array.isArray(achievementsData.analytics)
            ? achievementsData.analytics
            : [],
          achievementPlayerProgress: Array.isArray(
            achievementsData.playerProgress
          )
            ? achievementsData.playerProgress
            : [],
          achievementTriggers: Array.isArray(achievementsData.triggers)
            ? achievementsData.triggers
            : []
        };
        const statTableColumns = [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ];

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'achievements-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              const statMap = {
                'Total Achievements': {
                  value: stats.totalAchievements,
                  detail: `${stats.activeAchievements ?? 0} active`,
                  rows: [
                    {
                      label: 'Active achievements',
                      value: stats.activeAchievements ?? 0
                    },
                    {
                      label: 'Draft achievements',
                      value: stats.draftAchievements ?? 0
                    },
                    {
                      label: 'Archived achievements',
                      value: stats.archivedAchievements ?? 0
                    }
                  ]
                },
                'Total Unlocks': {
                  value: stats.totalUnlocks,
                  detail: `${stats.unlocksToday ?? 0} today`,
                  rows: [
                    { label: 'All unlocks', value: stats.totalUnlocks ?? 0 },
                    { label: 'Unlocks today', value: stats.unlocksToday ?? 0 }
                  ]
                },
                'Players With Achievements': {
                  value: stats.playersWithAchievements,
                  detail: 'accounts',
                  rows: [
                    {
                      label: 'Players with achievements',
                      value: stats.playersWithAchievements ?? 0
                    }
                  ]
                },
                'Review Items': {
                  value: stats.reviewItems,
                  detail: 'needs attention',
                  rows: [
                    { label: 'Review queue items', value: stats.reviewItems ?? 0 }
                  ]
                }
              };
              const statData = statMap[stat.label];
              if (!statData) return stat;
              const value =
                statData.value === undefined ? '-' : String(statData.value);
              return {
                ...stat,
                value,
                detail: statData.detail || '-',
                expanded: {
                  type: 'table',
                  title: stat.label,
                  columns: statTableColumns,
                  rows: statData.rows || [{ label: stat.label, value }]
                }
              };
            });
            return;
          }

          if (Array.isArray(gridConfig.tableSeries)) {
            gridConfig.tableSeries = gridConfig.tableSeries.map(
              (seriesConfig) => {
                if (!seriesConfig.dataSource) return seriesConfig;
                return {
                  ...seriesConfig,
                  rows: rowsBySource[seriesConfig.dataSource] || []
                };
              }
            );
            return;
          }

          if (gridConfig.id === 'achievements-grid-3') {
            gridConfig.items = rowsBySource.achievementLibrary.map((item) => ({
              ...item,
              galleryStatus: `${item.rarity || '-'} / ${item.status || '-'}`
            }));
            return;
          }

          if (gridConfig.id === 'achievements-grid-4') {
            const reviewAlerts = Array.isArray(achievementsData.reviewAlerts)
              ? achievementsData.reviewAlerts
              : [];
            gridConfig.achievementReviewAlerts = reviewAlerts;
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              achievementReviewItems: reviewAlerts.length
            };
          }
        });

        return true;
      }

      if (sectionName === 'Shop') {
        const shopData = await panelData.fetchShopProductsData();
        const products = Array.isArray(shopData.products)
          ? shopData.products
          : [];
        const stats = shopData.stats || {};
        const alerts = Array.isArray(shopData.alerts) ? shopData.alerts : [];

        nextConfig.forEach((gridConfig) => {
          if (gridConfig.dataSource === 'shopProducts') {
            gridConfig.rows = products;
          }

          if (gridConfig.id === 'shop-grid-2') {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Money Revenue') {
                return {
                  ...stat,
                  value: stats.revenueToday || '-',
                  detail: 'today'
                };
              }

              if (stat.label === 'Money Orders') {
                return {
                  ...stat,
                  value: String(stats.ordersToday ?? 0),
                  detail: 'paid today'
                };
              }

              if (stat.label === 'Opals Received') {
                return {
                  ...stat,
                  value: String(stats.opalsReceivedToday ?? 0),
                  detail: 'today'
                };
              }

              if (stat.label === 'Opals Spent') {
                return {
                  ...stat,
                  value: String(stats.opalsSpentToday ?? 0),
                  detail: 'today'
                };
              }

              return stat;
            });
          }

          if (gridConfig.id === 'shop-grid-3') {
            gridConfig.items = products.map((product) => ({
              ...product,
              galleryStatus: `${product.status || '-'} / ${product.visibility || '-'}`
            }));
          }

          if (gridConfig.id === 'shop-grid-4') {
            gridConfig.shopIssueAlerts = alerts;
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              shopIssueItems: alerts.length
            };
          }
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelCatalogHydrator = createOePanelCatalogHydrator;
})();
