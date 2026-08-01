(function () {
  const BODYGUARD_BODY_PATH = '/images/protection/bodyguard/body.svg';
  const BODYGUARD_ONE_FACE = {
    colour: '/images/protection/bodyguard/bodyguard-one/colour.svg',
    hair: '/images/protection/bodyguard/bodyguard-one/hair.svg',
    eyes: '/images/protection/bodyguard/bodyguard-one/eyes.svg',
    mouth: '/images/protection/bodyguard/bodyguard-one/mouth.svg'
  };

  function getBodyguardMount() {
    return (
      document.querySelector(
        '.protected-access-page #splash-screen-container.protected-splash'
      ) || document.body
    );
  }

  function createBodyguardShell() {
    const existingBodyguard = document.querySelector('.oe-bodyguard');
    if (existingBodyguard) {
      let face = existingBodyguard.querySelector('.oe-bodyguard-face');
      if (!face) {
        face = document.createElement('div');
        face.className = 'oe-bodyguard-face';
        existingBodyguard.appendChild(face);
      }
      return { bodyguard: existingBodyguard, face };
    }

    const bodyguard = document.createElement('div');
    bodyguard.className = 'oe-bodyguard';
    bodyguard.setAttribute('aria-hidden', 'true');

    const body = document.createElement('img');
    body.className = 'oe-bodyguard-body';
    body.src = BODYGUARD_BODY_PATH;
    body.alt = '';
    body.decoding = 'async';

    const face = document.createElement('div');
    face.className = 'oe-bodyguard-face';

    bodyguard.append(body, face);
    getBodyguardMount().appendChild(bodyguard);
    return { bodyguard, face };
  }

  function renderBodyguardOneFace(face) {
    if (!face || face.querySelector('.image-stack')) return;
    const imageStack = document.createElement('div');
    imageStack.className = 'image-stack';

    Object.entries(BODYGUARD_ONE_FACE).forEach(([id, src]) => {
      const img = document.createElement('img');
      img.id = id;
      img.src = src;
      img.alt = '';
      imageStack.appendChild(img);
    });

    face.replaceChildren(imageStack);
  }

  async function initBodyguard() {
    if (!document.body?.classList.contains('protected-access-page')) {
      document.querySelector('.oe-bodyguard')?.remove();
      return;
    }

    if (typeof window.LoadStylesheet === 'function') {
      window.LoadStylesheet('/css/protection/bodyguard.css');
    }

    const { bodyguard, face } = createBodyguardShell();
    renderBodyguardOneFace(face);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBodyguard, { once: true });
  } else {
    initBodyguard();
  }
})();
