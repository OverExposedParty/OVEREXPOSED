(function () {
  function getSampleHatchReceiptPreview() {
    const hatchedAt = new Date().toISOString();
    const oling = {
      id: 'preview-hatch-receipt-oling',
      name: 'Receipt Preview',
      eggKey: 'base',
      rarity: 'rare',
      collection: 'base',
      matchingSet: {
        key: 'moss',
        name: 'Moss Set'
      },
      build: {
        flight: 'moss-wings',
        body: 'moss-body',
        eyes: 'moss-eyes',
        mouth: 'moss-mouth'
      },
      buildRarities: {
        flight: 'rare',
        body: 'uncommon',
        eyes: 'rare',
        mouth: 'common'
      },
      traits: {
        flight: {
          key: 'moss-wings',
          name: 'Moss Wings',
          rarity: 'rare',
          flightType: 'wings',
          flightMotion: 'flutter',
          flightSpeed: 1,
          assets: {
            image: '/images/olings/builds/flight/base/moss-wings.svg'
          }
        },
        body: {
          key: 'moss-body',
          name: 'Moss Body',
          rarity: 'uncommon',
          assets: {
            image: '/images/olings/builds/body/base/moss-body.svg'
          }
        },
        eyes: {
          key: 'moss-eyes',
          name: 'Moss Eyes',
          rarity: 'rare',
          assets: {
            image: '/images/olings/builds/eyes/base/moss-eyes.svg'
          }
        },
        mouth: {
          key: 'moss-mouth',
          name: 'Moss Mouth',
          rarity: 'common',
          assets: {
            image: '/images/olings/builds/mouth/base/moss-mouth.svg'
          }
        }
      }
    };
    const receipt = {
      id: 'preview-hatch-receipt',
      eggKey: 'base',
      hatchedAt,
      createdAt: hatchedAt,
      source: 'Incubeta',
      matchingSet: 'Moss Set',
      rarity: 'Rare',
      influences: [
        {
          slotKey: 'hatch',
          itemKey: 'oling-blanket',
          itemName: 'Oling Blanket',
          itemRarity: 'uncommon',
          effect: { type: 'hatch_speed', amount: 25 },
          image:
            '/images/olings/lab/consumables/hatching/speed/oling-blanket.svg'
        },
        {
          slotKey: 'rarity',
          itemKey: 'lucky-clover',
          itemName: 'Lucky Clover',
          itemRarity: 'epic',
          effect: { type: 'rarity_chance', amount: 20 },
          image:
            '/images/olings/lab/consumables/hatching/rarity/lucky-clover.svg'
        }
      ],
      rolls: {
        flight: {
          rarityRolled: 'rare',
          traitKey: 'moss-wings'
        },
        body: {
          rarityRolled: 'uncommon',
          traitKey: 'moss-body'
        },
        eyes: {
          rarityRolled: 'rare',
          traitKey: 'moss-eyes'
        },
        mouth: {
          rarityRolled: 'common',
          traitKey: 'moss-mouth'
        }
      },
      eggOddsSnapshot: {
        common: 0.56,
        uncommon: 0.28,
        rare: 0.13,
        legendary: 0.03
      },
      inventoryChange: {
        eggKey: 'base',
        quantityBefore: 4,
        quantityAfter: 3
      }
    };
    return { oling, receipt };
  }

  window.getOlingLabSampleHatchReceiptPreview = getSampleHatchReceiptPreview;
})();
