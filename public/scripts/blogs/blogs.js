const standaloneButton = document.getElementById('contents-table-button-standalone');
const containerButton = document.getElementById('contents-table-button-container');
const contentTableContainer = document.getElementById('contents-table-container');
const ttsButton = document.getElementById('tts-button');

standaloneButton.addEventListener('click', function () {
    standaloneButton.style.display = 'none';
    contentTableContainer.style.display = 'block';
});

containerButton.addEventListener('click', function () {
    contentTableContainer.style.display = 'none';
    standaloneButton.style.display = 'flex';
});

let isSpeaking = false;

function getSelectedVoice() {
    const voiceKeys = ['tts-voice-male1', 'tts-voice-male2', 'tts-voice-female1', 'tts-voice-female2'];
    voiceKeys.forEach(key => console.log(`${key}: ${localStorage.getItem(key)}`));

    const selectedVoiceKey = voiceKeys.find(key => localStorage.getItem(key) === 'true');

    console.log(`Selected Voice Key: ${selectedVoiceKey}`);

    switch (selectedVoiceKey) {
        case 'tts-voice-male1':
            return 'UK English Male';
        case 'tts-voice-male2':
            return 'US English Male';
        case 'tts-voice-female1':
            return 'UK English Female';
        case 'tts-voice-female2':
            return 'US English Female';
        default:
            return 'UK English Male';
    }
}

function readText(text) {
    if (isSpeaking) {
        responsiveVoice.cancel();
        isSpeaking = false;
        ttsButton.src = "/images/icons/grey/tts-icon.svg";
    } else {
        const selectedVoice = getSelectedVoice();
        responsiveVoice.speak(text, selectedVoice);

        isSpeaking = true;
        ttsButton.src = "/images/icons/blogs/green/tts-icon.svg";

        responsiveVoice.onend = () => {
            isSpeaking = false;
            ttsButton.src = "/images/icons/grey/tts-icon.svg";
        };
    }
}

ttsButton.addEventListener('click', () => {
    const selectedText = window.getSelection().toString().trim();

    if (selectedText) {
        readText(selectedText);
    } else {
        const contentText = document.getElementById('contents-container').innerText;
        readText(contentText);
    }
});

document.addEventListener("DOMContentLoaded", function () {

    const contentsItems = document.querySelectorAll('.contents-item');

    contentsItems.forEach(item => {
        item.addEventListener('click', function () {

            const contentIndex = this.id.split('-')[2];
            const paragraph = document.getElementById(`paragraph-${contentIndex}`);


            if (paragraph) {
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });
});