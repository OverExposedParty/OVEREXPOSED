// Create the new setting option container
const cardBoundsOption = document.createElement('div');
cardBoundsOption.className = 'settings-option';

// Create and append the label
const cardBoundsLabel = document.createElement('label');
cardBoundsLabel.setAttribute('for', 'settings-card-bounds');
cardBoundsLabel.textContent = 'Card Bounds';
cardBoundsOption.appendChild(cardBoundsLabel);

// Create the toggle switch wrapper
const cardBoundsToggleSwitch = document.createElement('label');
cardBoundsToggleSwitch.className = 'toggle-switch';

// Create and append the checkbox input
const cardBoundsCheckbox = document.createElement('input');
cardBoundsCheckbox.type = 'checkbox';
cardBoundsCheckbox.id = 'settings-card-bounds';
cardBoundsCheckbox.style.opacity = '0';
cardBoundsToggleSwitch.appendChild(cardBoundsCheckbox);

// Create and append the slider
const cardBoundsSlider = document.createElement('span');
cardBoundsSlider.className = 'slider';
cardBoundsToggleSwitch.appendChild(cardBoundsSlider);

// Append the toggle switch to the setting option
cardBoundsOption.appendChild(cardBoundsToggleSwitch);

// Append the new setting to the settings content container
const cardBoundsSettingsContent = document.querySelector('.settings-content');
cardBoundsSettingsContent.appendChild(cardBoundsOption);

cardBoundsCheckbox.addEventListener('change', function () {
    if (cardBoundsCheckbox.checked) {
        CardBoundsToggle(true);
    }
    else {
        CardBoundsToggle(false);
    }
});
