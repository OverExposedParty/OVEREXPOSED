const cssFilesHeader = [
  '/css/general/settings.css',
  '/css/general/help-container.css',
  '/css/general/warning-message-style.css',
  '/css/general/rotate-device.css'
];

cssFilesHeader.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

fetch('/html-templates/header.html')
  .then(response => response.text())
  .then(data => {
    const placeholder = document.getElementById('header-placeholder');
    placeholder.innerHTML = data;

    const soundScript = document.createElement('script');
    soundScript.src = '/scripts/general/sound.js';
    soundScript.onload = () => {
      const headerScript = document.createElement('script');
      headerScript.src = '/scripts/general/header.js';
      document.body.appendChild(headerScript);

      const helpScript = document.createElement('script');
      helpScript.src = '/scripts/general/help-container.js';
      helpScript.id = 'help-script';
      document.body.appendChild(helpScript);
    };

    const rotateDeviceScript = document.createElement('script');
    rotateDeviceScript.src = '/scripts/general/rotate-device.js';
    rotateDeviceScript.id = 'help-script';
    document.body.appendChild(rotateDeviceScript);

    document.body.appendChild(soundScript);
  })
  .catch(error => console.error('Error loading header:', error));