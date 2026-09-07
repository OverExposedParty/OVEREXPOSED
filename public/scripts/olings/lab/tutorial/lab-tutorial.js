(function () {
  const STORAGE_KEY = 'oe-oling-lab-tutorial-version';
  const TUTORIAL_VERSION = '2';
  let tutorial = null;

  const steps = [
    {
      id: 'welcome',
      eyebrow: 'LAB ORIENTATION',
      title: 'Welcome to your Lab!',
      copy: 'This is where your Olings will hatch, rest, and get ready for adventures. Let’s have a look around.',
      action: 'Let’s look around',
      modal: true
    },
    {
      id: 'explore',
      eyebrow: 'LOOK AROUND',
      title: 'Explore your Lab',
      copy: 'Drag the room to look around, or use the arrows at either side. Give it a try.',
      target: '#oling-lab-scroll-right',
      targetPadding: 10,
      actionRequired: true,
      advanceOn: 'oling-lab:tutorial-pan'
    },
    {
      id: 'incubator',
      eyebrow: 'HATCHING',
      title: 'Meet your incubator',
      copy: 'Select the incubator, then choose Check incubator. This is where every new Oling begins.',
      target: '[data-oling-lab-item-id="incubeta"]',
      targetPadding: 12,
      actionRequired: true,
      advanceOn: 'oling-lab:tutorial-incubator-opened',
      onEnter: ({ tutorial: currentTutorial }) => {
        window.setTimeout(currentTutorial.refreshTarget, 360);
      }
    },
    {
      id: 'egg-slot',
      eyebrow: 'INCUBATION',
      title: 'Eggs go here',
      copy: 'When this slot is empty, choose it and select an egg from your inventory. If an egg is already inside, you’re ready to continue.',
      action: 'Continue',
      target: '.oling-lab-egg-insertion-slot',
      targetPadding: 10,
      advanceOn: 'oling-lab:tutorial-egg-inserted'
    },
    {
      id: 'influences',
      eyebrow: 'EXPERIMENT',
      title: 'Shape what hatches',
      copy: 'The Influences tab holds hatch influences. The things you add can affect timing, rarity, and matching sets.',
      action: 'Got it',
      target: '[data-oling-lab-tab="Influences"]',
      targetPadding: 8
    },
    {
      id: 'edit-mode',
      eyebrow: 'MAKE IT YOURS',
      title: 'Customise your Lab',
      copy: 'Use Customise whenever you want to change the walls, add decorations, or arrange furniture.',
      target: '#oling-lab-edit-toggle',
      targetPadding: 10,
      actionRequired: true,
      advanceOn: {
        event: 'oling-lab:tutorial-edit-mode',
        predicate: (event) => event.detail?.enabled === true
      },
      onEnter: () => {
        window.dispatchEvent(new CustomEvent('oling-lab:tutorial-close-menu'));
      }
    },
    {
      id: 'place-furniture',
      eyebrow: 'FURNITURE',
      title: 'Fill an empty space',
      copy: 'Drag furniture from the side panel onto a + space. It will snap into place when it fits.',
      action: 'Continue',
      target: '.oling-lab-plus[type="button"]',
      targetPadding: 10,
      advanceOn: 'oling-lab:tutorial-furniture-placed'
    },
    {
      id: 'rest',
      eyebrow: 'OLING CARE',
      title: 'A place to recharge',
      copy: 'Beds let tired Olings rest and recover their energy. Select a bed whenever one of your Olings needs a break.',
      action: 'Continue',
      target: '[data-oling-lab-item-id="oling_bed"]',
      targetPadding: 12,
      when: () =>
        Boolean(document.querySelector('[data-oling-lab-item-id="oling_bed"]')),
      onEnter: () => {
        window.dispatchEvent(
          new CustomEvent('oling-lab:tutorial-exit-edit-mode')
        );
      }
    },
    {
      id: 'adventures',
      eyebrow: 'EXPLORATION',
      title: 'Adventures start here',
      copy: 'The Explorer Gateway sends Olings out on adventures. They’ll return with Account XP, Opals, and new discoveries.',
      action: 'Continue',
      target: '[data-oling-lab-item-id="explorer_gateway"]',
      targetPadding: 12,
      when: () =>
        Boolean(
          document.querySelector('[data-oling-lab-item-id="explorer_gateway"]')
        ),
      onEnter: ({ tutorial: currentTutorial }) => {
        document.getElementById('oling-lab-scroll-left')?.click();
        window.setTimeout(currentTutorial.refreshTarget, 360);
      }
    },
    {
      id: 'complete',
      eyebrow: 'ORIENTATION COMPLETE',
      title: 'That’s enough science for one day',
      copy: 'Hatch Olings, care for them, and keep experimenting with your Lab. You can hide this guide whenever you need more room.',
      action: 'Start exploring',
      modal: true,
      onEnter: () => {
        window.dispatchEvent(new CustomEvent('oling-lab:tutorial-close-menu'));
        window.dispatchEvent(
          new CustomEvent('oling-lab:tutorial-exit-edit-mode')
        );
      }
    }
  ];

  function startTutorial() {
    if (tutorial) return tutorial;
    const preview = window.OlingLabTutorialPreview || {
      isActive: false,
      tutorialOptions: null
    };

    tutorial = window.OETutorial.create({
      id: 'olings-lab',
      version: TUTORIAL_VERSION,
      storageKey: STORAGE_KEY,
      rememberCompletion: !preview.isActive,
      preview: preview.tutorialOptions,
      steps
    });
    window.OlingLabTutorial = tutorial;

    if (preview.isActive || !tutorial.hasCompleted()) tutorial.start();
    return tutorial;
  }

  window.addEventListener('oling-lab:ready', startTutorial);
})();
