var colourSlot = window.colourSlot || [];
var headSlot = window.headSlot || [];
var eyesSlot = window.eyesSlot || [];
var mouthSlot = window.mouthSlot || [];

LoadStylesheet('/css/general/online/user-customisation-icon.css');

var USER_ICON_DEFAULT_STRING =
  window.USER_ICON_DEFAULT_STRING || '0000:0100:0200:0300';
var blankUserCustomisation = window.blankUserCustomisation || {
  colour: '/images/user-customisation/colour/blank/blank-colour.svg',
  headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
  eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
  mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
};
const onlinePublicAchievementsConfigPath =
  '/api/achievements';
let onlinePublicAchievementsPromise = null;

window.colourSlot = colourSlot;
window.headSlot = headSlot;
window.eyesSlot = eyesSlot;
window.mouthSlot = mouthSlot;
window.USER_ICON_DEFAULT_STRING = USER_ICON_DEFAULT_STRING;
window.blankUserCustomisation = blankUserCustomisation;

