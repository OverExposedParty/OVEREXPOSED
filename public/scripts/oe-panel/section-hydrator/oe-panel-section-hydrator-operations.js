(function () {
  function createOePanelOperationsHydrator({ panelData }) {
      function createAccountFlagAlerts(accountFlags) {
        return accountFlags.map((account) => {
          const status = String(account.status || '').toLowerCase();
          const accountName = account.user || account.email || 'Account';
          const isBanned = status === 'banned';
          const flagLabel = isBanned
            ? 'banned'
            : status === 'suspended'
              ? 'suspended'
              : account.compromisedPassword === 'Flagged'
                ? 'password flagged'
                : account.suspiciousActivity === 'Flagged'
                  ? 'security flagged'
                  : 'flagged';

          return {
            title: `${accountName} is ${flagLabel}`,
            roomCode: account.email || account.accountId || '-',
            detail: [
              account.suspensionReason !== '-' ? account.suspensionReason : '',
              account.role,
              account.joined
            ]
              .filter(Boolean)
              .join(' - '),
            severity: isBanned ? 'high' : 'medium',
            containerType: 'account',
            'container-type': 'account',
            targetGridId: 'users-grid-2',
            query: account.accountId
              ? `[accountId:${account.accountId}]`
              : accountName,
            expandFirstMatch: true
          };
        });
      }
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'Admin Logs') {
        const adminLogsData = await panelData.fetchAdminLogsData();
        const stats = adminLogsData.stats || {};

        nextConfig.forEach((gridConfig) => {
          if (gridConfig.dataSource === 'adminLogs') {
            gridConfig.rows = Array.isArray(adminLogsData.logs)
              ? adminLogsData.logs
              : [];
            return;
          }

          if (
            gridConfig.id === 'admin-logs-grid-2' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];

            gridConfig.stats = gridConfig.stats.map((stat) => {
              const statMap = {
                'Logs Today': {
                  value: stats.logsToday,
                  detail: 'today'
                },
                'Admin Actions': {
                  value: stats.totalActions,
                  detail: 'all time'
                },
                'Critical Events': {
                  value: stats.criticalEvents,
                  detail: 'high or critical'
                },
                'Failed Actions': {
                  value: stats.failedActions,
                  detail: 'failed'
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
                    { label: 'Detail', value: detail }
                  ]
                }
              };
            });
            return;
          }

          if (gridConfig.id === 'admin-logs-grid-3') {
            gridConfig.counts = adminLogsData.logCountByDate || {};
            return;
          }

          if (gridConfig.id === 'admin-logs-grid-4') {
            const alerts = Array.isArray(adminLogsData.alerts)
              ? adminLogsData.alerts
              : [];
            gridConfig.alerts = alerts;
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              adminLogAlerts: alerts.length
            };
          }
        });

        return true;
      }

      if (sectionName === 'System') {
        const systemData = await panelData.fetchSystemData();
        const status = systemData.status || {};

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'system-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];

            gridConfig.stats = gridConfig.stats.map((stat) => {
              const key = stat.label.toLowerCase();
              const statusConfig = status[key] || {};
              const value = statusConfig.value || '-';
              const detail = statusConfig.detail || '-';
              const rows = Array.isArray(statusConfig.rows)
                ? statusConfig.rows
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
                  rows
                }
              };
            });
            return;
          }

          if (
            gridConfig.id === 'system-grid-2' &&
            Array.isArray(systemData.configRows)
          ) {
            gridConfig.rows = systemData.configRows.length
              ? systemData.configRows
              : gridConfig.rows;
            return;
          }

          if (gridConfig.id === 'system-grid-3') {
            gridConfig.alerts = Array.isArray(systemData.alerts)
              ? systemData.alerts
              : [];
          }
        });

        return true;
      }

      if (sectionName === 'Moderation') {
        const moderationData = await panelData.fetchModerationData();
        const stats = moderationData.stats || {};
        const prioritySignals = Array.isArray(moderationData.prioritySignals)
          ? moderationData.prioritySignals
          : [];
        const repeatOffenders = Array.isArray(moderationData.repeatOffenders)
          ? moderationData.repeatOffenders
          : [];
        const recentDecisions = Array.isArray(moderationData.recentDecisions)
          ? moderationData.recentDecisions
          : [];

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'moderation-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];

            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Open Queue') {
                const value = String(stats.openReports ?? 0);
                return {
                  ...stat,
                  value,
                  detail: 'open or reviewing',
                  expanded: {
                    type: 'table',
                    title: 'Open Queue',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Open or reviewing', value },
                      {
                        label: 'Created in last 24h',
                        value: String(stats.reportsLast24Hours ?? 0)
                      },
                      {
                        label: 'Room issues',
                        value: String(stats.roomIssues ?? 0)
                      },
                      {
                        label: 'Account flags',
                        value: String(stats.accountFlags ?? 0)
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Urgent Reports') {
                const value = String(stats.urgentReports ?? 0);
                return {
                  ...stat,
                  value,
                  detail: `${stats.repeatOffenders ?? 0} repeat offenders`,
                  expanded: {
                    type: 'table',
                    title: 'Urgent Reports',
                    columns: statTableColumns,
                    rows: [
                      { label: 'High or urgent', value },
                      {
                        label: 'Repeat offenders',
                        value: String(stats.repeatOffenders ?? 0)
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Oldest Waiting') {
                const value = stats.oldestWaiting || '0m';
                return {
                  ...stat,
                  value,
                  detail: 'oldest unresolved report',
                  expanded: {
                    type: 'table',
                    title: 'Oldest Waiting',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Oldest unresolved report', value },
                      {
                        label: 'Average resolution time',
                        value: stats.averageResolution || '0m'
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Resolved 7d') {
                const value = String(stats.resolvedLast7Days ?? 0);
                return {
                  ...stat,
                  value,
                  detail: `avg ${stats.averageResolution || '0m'}`,
                  expanded: {
                    type: 'table',
                    title: 'Resolved Reports',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Resolved in last 7 days', value },
                      {
                        label: 'Average resolution time (30d)',
                        value: stats.averageResolution || '0m'
                      }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.id === 'moderation-grid-3') {
            gridConfig.alerts = prioritySignals;
            gridConfig.visibleAlerts = 10;
            return;
          }

          if (gridConfig.id === 'moderation-grid-4') {
            gridConfig.repeatOffenderAlerts = repeatOffenders;
            gridConfig.recentDecisionAlerts = recentDecisions;
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              repeatOffenders: repeatOffenders.length,
              recentDecisions: recentDecisions.length
            };
          }
        });

        return true;
      }

      if (sectionName === 'Users') {
        const usersData = await panelData.fetchUsersData();
        const users = usersData.users || [];
        const accountFlags = Array.isArray(usersData.accountFlags)
          ? usersData.accountFlags
          : users.filter(
              (user) =>
                ['suspended', 'banned'].includes(
                  String(user.status || '').toLowerCase()
                ) ||
                user.suspiciousActivity === 'Flagged' ||
                user.compromisedPassword === 'Flagged'
            );
        const stats = usersData.stats || {};

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'users-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];

            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Total Users') {
                const value =
                  stats.totalUsers === undefined ? '-' : String(stats.totalUsers);
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'all accounts',
                  expanded: {
                    type: 'table',
                    title: 'Total Users',
                    columns: statTableColumns,
                    rows: [
                      { label: 'All accounts', value },
                      {
                        label: 'Email verified',
                        value: String(stats.verifiedUsers ?? 0)
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Online Now') {
                const value =
                  stats.onlineNow === undefined ? '-' : String(stats.onlineNow);
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'last 15m',
                  expanded: {
                    type: 'table',
                    title: 'Online Now',
                    columns: statTableColumns,
                    rows: [{ label: 'Seen in last 15m', value }]
                  }
                };
              }
              if (stat.label === 'New Today') {
                const value =
                  stats.newToday === undefined ? '-' : String(stats.newToday);
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'today',
                  expanded: {
                    type: 'table',
                    title: 'New Today',
                    columns: statTableColumns,
                    rows: [{ label: 'Accounts created today', value }]
                  }
                };
              }
              if (stat.label === 'Account Flags') {
                const value =
                  stats.flaggedAccounts === undefined
                    ? '-'
                    : String(stats.flaggedAccounts);
                const banned =
                  stats.banned === undefined ? '-' : String(stats.banned);
                const suspended =
                  stats.suspended === undefined ? '-' : String(stats.suspended);
                const securityFlagged =
                  stats.securityFlagged === undefined
                    ? '-'
                    : String(stats.securityFlagged);
                return {
                  ...stat,
                  value,
                  detail:
                    securityFlagged === '-' ? '-' : `${securityFlagged} security`,
                  expanded: {
                    type: 'table',
                    title: 'Account Flags',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Flagged accounts', value },
                      { label: 'Suspended', value: suspended },
                      { label: 'Banned', value: banned },
                      { label: 'Security flagged', value: securityFlagged }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.dataSource === 'users') {
            gridConfig.rows = users;
            return;
          }

          if (gridConfig.id === 'users-grid-3') {
            gridConfig.counts = usersData.signupCountByDate || {};
            return;
          }

          if (gridConfig.id === 'users-grid-4') {
            gridConfig.accountFlagAlerts = createAccountFlagAlerts(accountFlags);
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              accountFlags: gridConfig.accountFlagAlerts.length
            };
          }
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelOperationsHydrator = createOePanelOperationsHydrator;
})();
