const helpContainer = document.querySelector('.help-container');
const helpTitle = document.querySelector('.help-title');
const helpText = document.querySelector('.help-text');
const helpContainerLeft = document.querySelector('.help-arrow.left-arrow');
const helpContainerRight = document.querySelector('.help-arrow.right-arrow');
const helpNumberCounter = document.querySelector('.help-number-counter');

let helpCounter = 0;
let helpData = [];
let currentHelpIndex = 0;

// Load JSON data
fetch(`/json-files/help-containers/${helpContainerFile}`)
  .then(res => res.json())
  .then(data => {
    helpData = data;
    if (helpData.length == 1) {
      document.querySelectorAll('.help-arrow').forEach(arrow => {
        arrow.classList.add('disabled');
      });
    }
    showHelpContainer(0);
  })
  .catch(err => console.error('Failed to load help pages:', err));

// Update help container with content
function showHelpContainer(index) {
  if (!helpData.length) return;
  currentHelpIndex = (index + helpData.length) % helpData.length;
  helpTitle.innerHTML = helpData[currentHelpIndex].title;
  helpText.innerHTML = helpData[currentHelpIndex].text;
  helpNumberCounter.textContent = `(${currentHelpIndex + 1}/${helpData.length})`;
}

function toggleHelp() {
  toggleClass(helpContainer, settingsElementClassArray);
}

helpContainerLeft.addEventListener('click', () => {
  showHelpContainer(currentHelpIndex - 1);
});

helpContainerRight.addEventListener('click', () => {
  showHelpContainer(currentHelpIndex + 1);
});
