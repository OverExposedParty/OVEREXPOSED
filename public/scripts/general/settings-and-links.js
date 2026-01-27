instagramLink.href = instagramUrl;
tiktokLink.href = tiktokUrl;

if (localStorage.getItem('settings-sound') === null) {
    localStorage.setItem('settings-sound', 'true');
}
if (localStorage.getItem('settings-nsfw') === null) {
    localStorage.setItem('settings-nsfw', 'true');
}

nsfwCheckbox.checked = localStorage.getItem('settings-nsfw') === 'true';
settingsSoundCheckbox.checked = localStorage.getItem('settings-sound') === 'true';

settingsSoundCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-sound', settingsSoundCheckbox.checked);
    if (settingsSoundCheckbox.checked) {
        playSoundEffect('sliderEnabled');
    }
    else {
        playSoundEffect('sliderDisabled');
    }
});

nsfwCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-nsfw', nsfwCheckbox.checked);
    if (nsfwCheckbox.checked) {
        playSoundEffect('sliderEnabled');
    }
    else {
        playSoundEffect('sliderDisabled');
    }
    if (typeof isPlaying !== "undefined" && isPlaying === false) {
        SetGamemodeButtons();
        UpdateSettings();
    }
});

if (document.querySelector('#card-bounds-checkbox')) {
    if (localStorage.getItem('settings-card-bounds') === 'true') {
        cardBoundsCheckbox.checked = true;
    }

    cardBoundsCheckbox.addEventListener('change', function () {
        localStorage.setItem('settings-card-bounds', cardBoundsCheckbox.checked);
        if (cardBoundsCheckbox.checked) {
            playSoundEffect('sliderEnabled');
        }
        else {
            playSoundEffect('sliderDisabled');
        }
    });
}
