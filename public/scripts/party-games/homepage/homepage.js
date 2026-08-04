const homepageHandlers = ['loadHomepageTiles', 'renderHomepageGrid'];
const missingHomepageHandlers = homepageHandlers.filter(
  (handler) => typeof window[handler] !== 'function'
);
if (missingHomepageHandlers.length > 0) {
  throw new Error(
    `Party-games homepage modules failed to load: ${missingHomepageHandlers.join(', ')}`
  );
}

function showHomepageAuthCompletion() {
  let completion = '';
  try {
    completion = sessionStorage.getItem('oe-auth-completion') || '';
    if (completion) sessionStorage.removeItem('oe-auth-completion');
  } catch {
    return;
  }
  if (completion !== 'email-verified') return;

  waitForFunction('showEmailVerificationSuccessPopup', () => {
    window.showEmailVerificationSuccessPopup();
  });
}

showHomepageAuthCompletion();

waitForFunction('playSoundEffect', () => {
  Promise.resolve(
    OEAudio.register({
      cardFlip: {
        src: '/sounds/homepage/card-flip.wav',
        group: 'party-games'
      }
    })
  ).finally(() => {
    if (typeof SetScriptLoaded === 'function') {
      SetScriptLoaded('/scripts/party-games/homepage/homepage.js');
    }
  });
});

loadHomepageTiles();

window.addEventListener('oe-account-state-changed', () => {
  loadHomepageTiles();
});
