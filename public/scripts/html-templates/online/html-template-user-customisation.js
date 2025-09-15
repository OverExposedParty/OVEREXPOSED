const placeholderUserCustomisation = document.getElementById('user-customisation-placeholder');

let userCustomisationContainer;
let userCustomisationContainerSlotColour, userCustomisationContainerSlotHead, userCustomisationContainerSlotEyes, userCustomisationContainerSlotMouth;
let userCustomisationLabelColourSlot, userCustomisationLabelHeadSlot, userCustomisationLabelEyes, userCustomisationLabelMouth;
let userCustomisationImageColourSlot, userCustomisationImageHeadSlot, userCustomisationImageEyes, userCustomisationImageMouth;

const userCustomisationTasks = {
  userIcons: {
    taskCompleted: false
  },
  userCustomisation: {
    taskCompleted: false
  }
};

const cssFilesUserCustomisation = [
  '/css/general/online/user-customisation.css',
  '/css/general/online/user-customisation-icon.css'
];

cssFilesUserCustomisation.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

fetch('/html-templates/user-customisation.html')
  .then(response => response.text())
  .then(data => {
    return new Promise(resolve => {
      placeholderUserCustomisation.insertAdjacentHTML('beforeend', data);
      requestAnimationFrame(() => {
        resolve();
      });
    });
  })
  .then(() => {
    userCustomisationContainer = document.querySelector('.user-customisation-container');

    userCustomisationContainerSlotColour = userCustomisationContainer.querySelector('#colour');
    userCustomisationContainerSlotHead = userCustomisationContainer.querySelector('#head-slot');
    userCustomisationContainerSlotEyes = userCustomisationContainer.querySelector('#eyes-slot');
    userCustomisationContainerSlotMouth = userCustomisationContainer.querySelector('#mouth-slot');

    userCustomisationLabelColourSlot = userCustomisationContainerSlotColour.querySelector('.user-customisation-option-title');
    userCustomisationLabelHeadSlot = userCustomisationContainerSlotHead.querySelector('.user-customisation-option-title');
    userCustomisationLabelEyes = userCustomisationContainerSlotEyes.querySelector('.user-customisation-option-title');
    userCustomisationLabelMouth = userCustomisationContainerSlotMouth.querySelector('.user-customisation-option-title');

    userCustomisationImageColourSlot = userCustomisationContainer.querySelector('.user-customisation-character.layer-colour');
    userCustomisationImageHeadSlot = userCustomisationContainer.querySelector('.user-customisation-character.layer-head-slot');
    userCustomisationImageEyes = userCustomisationContainer.querySelector('.user-customisation-character.layer-eyes-slot');
    userCustomisationImageMouth = userCustomisationContainer.querySelector('.user-customisation-character.layer-mouth-slot');

    usercustomisationSaveButton = userCustomisationContainer.querySelector('#save-customisation');
    userCustomisationOptions = userCustomisationContainer.querySelectorAll('.user-customisation-option');

    const scriptUserCustomisationIcon = document.createElement('script');
    scriptUserCustomisationIcon.src = '/scripts/general/online/user-customisation-icon.js';
    document.body.appendChild(scriptUserCustomisationIcon);

    const scriptUserCustomisation = document.createElement('script');
    scriptUserCustomisation.src = '/scripts/general/online/user-customisation.js';
    scriptUserCustomisation.defer = true;
    document.body.appendChild(scriptUserCustomisation);

  }).then(() => {
    userCustomisationTasks.userCustomisation.taskCompleted = true;
    CheckUserCustomisationLoaded();
  })
  .catch(error => console.error('Error loading user customization:', error));

  function CheckUserCustomisationLoaded(){
    const tasksCompleted = Object.values(userCustomisationTasks).every((task) => task.taskCompleted);
    if(tasksCompleted){
      SetScriptLoaded('/scripts/html-templates/online/html-template-user-customisation.js');
    }
  }