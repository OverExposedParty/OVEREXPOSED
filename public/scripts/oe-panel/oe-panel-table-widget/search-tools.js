(function () {
  function createOePanelTableSearchTools({
    gridConfig,
    columns,
    getVisibleDisplayRows
  }) {
    function normaliseSearchText(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
    }

    function normaliseSearchKey(value) {
      return normaliseSearchText(value).replace(/[^a-z0-9]/g, '');
    }

    function getSearchableFields() {
      const fields = new Map();
      const configuredFields = Array.isArray(gridConfig.expandedFields)
        ? gridConfig.expandedFields
        : [];

      [...columns, ...configuredFields].forEach((fieldConfig) => {
        const key = fieldConfig.key || fieldConfig.valueKey;
        if (!key) return;

        [key, fieldConfig.label].filter(Boolean).forEach((alias) => {
          fields.set(normaliseSearchKey(alias), key);
        });
      });

      getVisibleDisplayRows().forEach((rowConfig) => {
        Object.keys(rowConfig || {}).forEach((key) => {
          fields.set(normaliseSearchKey(key), key);
        });
      });

      return fields;
    }

    const searchableFields = getSearchableFields();

    function parseTableSearchQuery(query) {
      const filters = [];
      const plainParts = [];
      let cursor = 0;
      const filterPattern =
        /\[([^\]:]+)\s*:\s*([^\]]+)\]|\[([^\]]+)\]\s*:\s*\[([^\]]+)\]/g;
      let match;

      while ((match = filterPattern.exec(query)) !== null) {
        plainParts.push(query.slice(cursor, match.index));
        filters.push({
          field: normaliseSearchKey(match[1] || match[3]),
          value: normaliseSearchText(match[2] || match[4])
        });
        cursor = filterPattern.lastIndex;
      }

      plainParts.push(query.slice(cursor));

      return {
        filters,
        terms: normaliseSearchText(plainParts.join(' '))
          .split(' ')
          .filter(Boolean)
      };
    }

    function getRowValue(rowConfig, key) {
      return rowConfig[key] ?? rowConfig.details?.[key] ?? '';
    }

    function isDateField(fieldConfig) {
      const fieldName = `${fieldConfig.key || fieldConfig.valueKey || ''} ${
        fieldConfig.label || ''
      }`;

      return /date|created|updated|changed|time/i.test(fieldName);
    }

    function isEditableField(fieldConfig) {
      return (
        gridConfig.editable === true &&
        fieldConfig.editable === true &&
        !isDateField(fieldConfig)
      );
    }

    function getRowSaveEndpoint(rowConfig) {
      if (!gridConfig.saveEndpoint) return '';

      return String(gridConfig.saveEndpoint).replace(/\{([^}]+)\}/g, (_, key) =>
        encodeURIComponent(rowConfig[key] || '')
      );
    }

    function getRowActionEndpoint(action, rowConfig) {
      const endpoint =
        (gridConfig.actionEndpoints && gridConfig.actionEndpoints[action]) ||
        (action === 'delete' ? gridConfig.deleteEndpoint : '');

      if (!endpoint) return '';

      return String(endpoint).replace(/\{([^}]+)\}/g, (_, key) =>
        encodeURIComponent(rowConfig[key] || '')
      );
    }

    function getEditableRowKey(rowConfig, rowIndex) {
      const configuredKey = gridConfig.editKey || gridConfig.rowKey || 'key';
      const rowKey = rowConfig[configuredKey] || rowConfig.id || rowConfig._id;

      return rowKey ? String(rowKey) : `${gridConfig.id}-${rowIndex}`;
    }

    function getRowSearchHaystack(rowConfig) {
      return [
        ...columns.map((column) => getRowValue(rowConfig, column.key)),
        ...(Array.isArray(gridConfig.expandedFields)
          ? gridConfig.expandedFields.map((fieldConfig) =>
              getRowValue(rowConfig, fieldConfig.key || fieldConfig.valueKey)
            )
          : [])
      ]
        .map(normaliseSearchText)
        .join(' ');
    }

    function rowMatchesSearch(rowConfig, parsedQuery) {
      const haystack = getRowSearchHaystack(rowConfig);
      const hasTerms = parsedQuery.terms.every((term) =>
        haystack.includes(term)
      );
      if (!hasTerms) return false;

      return parsedQuery.filters.every((filter) => {
        const rowKey = searchableFields.get(filter.field);
        if (!rowKey) return false;

        return normaliseSearchText(getRowValue(rowConfig, rowKey)).includes(
          filter.value
        );
      });
    }

    return {
      parseTableSearchQuery,
      rowMatchesSearch,
      getEditableRowKey,
      getRowValue,
      getRowSaveEndpoint,
      getRowActionEndpoint,
      isEditableField
    };
  }

  window.createOePanelTableSearchTools = createOePanelTableSearchTools;
})();
