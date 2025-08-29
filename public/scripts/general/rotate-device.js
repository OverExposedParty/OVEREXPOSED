const rotateMessage = document.querySelector('#landscape-message');

// Rotate Icon
const landscapeMessage = document.createElement('div');
landscapeMessage.classList.add('landscape-message');

const messageText = document.createTextNode('Please rotate your phone to continue');

let rotateIcon = document.createElement('div');
rotateIcon.setAttribute('id', 'rotate-icon');
rotateIcon.classList.add('rotate-icon');

landscapeMessage.appendChild(messageText);
landscapeMessage.appendChild(rotateIcon);

document.body.appendChild(landscapeMessage);