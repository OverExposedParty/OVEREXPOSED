const cardBoundsOption = document.createElement('div');
cardBoundsOption.className = 'settings-option';

const cardBoundsLabel = document.createElement('label');
cardBoundsLabel.setAttribute('for', 'settings-card-bounds');
cardBoundsLabel.textContent = 'Card Bounds';
cardBoundsOption.appendChild(cardBoundsLabel);

const cardBoundsToggleSwitch = document.createElement('label');
cardBoundsToggleSwitch.className = 'toggle-switch';

const cardBoundsCheckbox = document.createElement('input');
cardBoundsCheckbox.type = 'checkbox';
cardBoundsCheckbox.id = 'settings-card-bounds';
cardBoundsCheckbox.style.opacity = '0';
cardBoundsToggleSwitch.appendChild(cardBoundsCheckbox);

const cardBoundsSlider = document.createElement('span');
cardBoundsSlider.className = 'slider';
cardBoundsToggleSwitch.appendChild(cardBoundsSlider);

cardBoundsOption.appendChild(cardBoundsToggleSwitch);

const cardBoundsSettingsContent = document.querySelector('.settings-content');
cardBoundsSettingsContent.appendChild(cardBoundsOption);