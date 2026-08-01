(function () {
  function createOePanelActionFormFields(options) {
    const {  } = options;

  function createPackFormField(labelText, name, options = {}) {
    const field = document.createElement('label');
    field.className = 'oe-panel-social-edit-meta-field';
  
    const label = document.createElement('span');
    label.textContent = options.required ? `${labelText} *` : labelText;
  
    const input = document.createElement(
      options.options ? 'select' : 'input'
    );
    input.className = 'oe-panel-social-edit-meta-input';
    input.name = name;
    if (!options.options) input.type = 'text';
    if (options.required) input.required = true;
    if (options.pattern) input.pattern = options.pattern;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.inputMode) input.inputMode = options.inputMode;
    if (options.title) input.title = options.title;
  
    if (Array.isArray(options.options)) {
      options.options.forEach((optionConfig) => {
        const option = document.createElement('option');
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        input.appendChild(option);
      });
    }
  
    if (options.value !== undefined && options.value !== null) {
      input.value = options.value;
    }
  
    field.append(label, input);
    return { field, input };
  }
  
  function slugifyPackTitle(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  const packDifficultyOptions = [
    '',
    'chill',
    'funny',
    'creative',
    'cheeky',
    'deep',
    'flirty',
    'brutal',
    'chaotic',
    'fiery',
    'naughty',
    'sexual',
    'halloween',
    'imposter/words',
    'imposter/phrases',
    'imposter/people-and-characters',
    'imposter/media-and-entertainment',
    'imposter/culture-and-lifestyle',
    'imposter/objects-and-things',
    'imposter/actions-and-activities'
  ].map((value) => ({
    value,
    label: value ? value.replace(/[-/]/g, ' ') : 'None'
  }));
  

    return { createPackFormField, slugifyPackTitle, packDifficultyOptions };
  }

  window.createOePanelActionFormFields = createOePanelActionFormFields;
})();
