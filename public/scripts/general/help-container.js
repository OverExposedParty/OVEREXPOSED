const helpContainer = document.querySelector('.help-container');
const helpTitle = document.querySelector('.help-title');
const helpText = document.querySelector('.help-text');
const helpContainerLeft = document.querySelector('.help-arrow.left-arrow');
const helpContainerRight = document.querySelector('.help-arrow.right-arrow');
const helpNumberCounter = document.querySelector('.help-number-counter');

let helpData = [];
let currentHelpIndex = 0;

// Function to fetch a help container JSON file and update UI

// Update help container with content
function FetchHelpContainer(helpContainerFile) {
  fetch(`/json-files/help-containers/${helpContainerFile}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      helpData = data;
      currentHelpIndex = 0;

      // Disable arrows if only 1 page
      if (helpData.length === 1) {
        document.querySelectorAll('.help-arrow').forEach(arrow => {
          arrow.classList.add('disabled');
        });
      } else {
        document.querySelectorAll('.help-arrow').forEach(arrow => {
          arrow.classList.remove('disabled');
        });
      }

      showHelpContainer(0);
    })
    .catch(err => {
      console.error('Failed to load help pages:', err);
      helpTitle.innerHTML = 'Error';
      helpText.innerHTML = 'Could not load help content.';
      helpNumberCounter.textContent = '';
    });
}

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


