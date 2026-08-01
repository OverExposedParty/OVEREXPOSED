(function () {
  function createHelpHubPageConfigs() {
    const HELP_HUB_TILE_LIMIT = 6;

    function createGameSettingsGuide(label, body, points = []) {
      return {
        label,
        detail: {
          title: label,
          body,
          points
        }
      };
    }

    function createGameSettingsTopic(label, body, guides) {
      return {
        label,
        section: {
          title: label,
          body,
          guides
        }
      };
    }

    function createPartyGameSettingsTopics({ mafia = false } = {}) {
      const packsOrRolesTopic = mafia
        ? createGameSettingsTopic(
            'Mafia Roles',
            'Mafia uses role counts instead of ordinary question packs. Use the role controls to build the setup for this lobby.',
            [
              createGameSettingsGuide(
                'Set each role count with the plus and minus controls.',
                'Each role has its own minimum, maximum, and increment. The displayed count is the number of players assigned to that role when the game starts.'
              ),
              createGameSettingsGuide(
                'Match the role setup to the number of players.',
                'Review the complete role total alongside the lobby player count so the selected roles produce a valid game.'
              ),
              createGameSettingsGuide(
                'Role counts are saved as you change them.',
                'Your selected counts are retained on this device and are synchronised with the active online lobby.'
              )
            ]
          )
        : createGameSettingsTopic(
            'Packs',
            'Packs decide which prompts, questions, or content pools can appear during the game.',
            [
              createGameSettingsGuide(
                'Select packs that suit the group.',
                'Select a pack to include its content. Select it again to remove it; at least one pack must remain enabled.'
              ),
              createGameSettingsGuide(
                'Some packs unlock related rules.',
                'A rule with a pack dependency remains unavailable until its associated pack is selected.'
              ),
              createGameSettingsGuide(
                'NSFW packs require NSFW content to be enabled.',
                'If an NSFW pack is unavailable, use the notification shortcut to open Settings and enable NSFW content.'
              )
            ]
          );

      return [
        createGameSettingsTopic(
          'Choose How to Play',
          'Choose whether everyone will share one device or join from their own devices before configuring the game.',
          [
            createGameSettingsGuide(
              'Offline keeps the game on this device.',
              'Choose Offline when everyone is playing together around one screen. No party lobby or ready state is required.'
            ),
            createGameSettingsGuide(
              'Online gives each player their own screen.',
              'Choose Online to create a shared lobby. Each player joins the party from their own device and receives the same live game state.'
            ),
            createGameSettingsGuide(
              mafia
                ? 'Mafia is online-only.'
                : 'An active online party can be managed here.',
              mafia
                ? 'Mafia automatically uses online play because its private roles and actions require separate player screens.'
                : 'When you already have an active party, the Online option shows its details and opens the party-management controls instead of creating another lobby.'
            )
          ]
        ),
        packsOrRolesTopic,
        createGameSettingsTopic(
          'Rules and Dependencies',
          'Rules change how the selected game operates. Their availability can depend on the selected packs and play mode.',
          [
            createGameSettingsGuide(
              'Toggle rules or adjust numeric values.',
              'Select toggle rules to enable or disable them. Use the plus and minus controls for numeric rules such as limits or timers.'
            ),
            createGameSettingsGuide(
              'Required rules remain enabled.',
              'Rules marked as required are part of the game mode and cannot be switched off.'
            ),
            createGameSettingsGuide(
              'Dependencies control when a rule is available.',
              'Some rules require a related pack, while online-only and offline-only rules are enabled automatically for the selected play mode.'
            )
          ]
        ),
        createGameSettingsTopic(
          'Content Access',
          'Some packs and rules are only available for particular audiences or play modes.',
          [
            createGameSettingsGuide(
              'NSFW controls follow the site-wide content setting.',
              'NSFW packs and rules are unavailable while SFW mode is active. Selecting a blocked control provides a shortcut to the relevant site setting.'
            ),
            createGameSettingsGuide(
              'Play-mode restrictions are automatic.',
              'Online-only rules are unavailable during offline play, and offline-only rules are unavailable during online play.'
            ),
            createGameSettingsGuide(
              'Unavailable controls preserve a valid setup.',
              'When content becomes unavailable, it is removed from the active game configuration rather than being sent to the game.'
            )
          ]
        ),
        createGameSettingsTopic(
          'Online Lobby',
          'The Online tab shows the players connected to the current party and the controls used to invite others.',
          [
            createGameSettingsGuide(
              'Invite players with the party link or QR code.',
              'Copy the party URL to share it directly, or display the QR code so nearby players can scan it.'
            ),
            createGameSettingsGuide(
              'Players must be ready before the host starts.',
              'Connected non-host players ready up from the waiting room. The host start control updates as their ready states change.'
            ),
            createGameSettingsGuide(
              'The game enforces its player range.',
              'The Online tab shows the current player count. If the count is outside the mode minimum or maximum, the start control explains what must change.'
            )
          ]
        ),
        createGameSettingsTopic(
          'Starting the Game',
          'Review the selected content and rules, then use Start Game when the group is ready.',
          [
            createGameSettingsGuide(
              'Offline games start on the current device.',
              'An offline game moves directly into play after any required NSFW content confirmation.'
            ),
            createGameSettingsGuide(
              'Online games require an eligible lobby.',
              'All non-host players must be ready and the current player count must be within the game mode limits.'
            ),
            createGameSettingsGuide(
              'Online games use a five-second countdown.',
              'Select the active Start control again to cancel the countdown. It also cancels automatically if player readiness or eligibility changes.'
            )
          ]
        )
      ];
    }

    const HELP_HUB_CONFIGS = {
      homepage: {
        title: 'Homepage',
        topics: [
          {
            label: 'What Is OVEREXPOSED?',
            size: 'primary',
            section: {
              title: 'What Is OVEREXPOSED?',
              body: 'OVEREXPOSED is a live social platform built around party games, custom OEs, account progression, and Oling systems.',
              guides: [
                {
                  label: 'Play live multiplayer party games with friends.',
                  detail: {
                    title: 'Live Multiplayer',
                    body: 'Party games are built around shared rooms where players join together, follow the same game flow, and see the same live state.',
                    points: [
                      'A host creates or starts the room, then other players join with the room code.',
                      'Each game mode controls its own turns, prompts, voting, scoring, and results.',
                      'Online rooms are meant for playing together in real time, so the most important information is kept visible during the round.'
                    ]
                  }
                },
                {
                  label:
                    'Customise your OE and build a persistent account identity.',
                  detail: {
                    title: 'Your OE Identity',
                    body: 'Your OE is the visual identity attached to your account across OVEREXPOSED.',
                    points: [
                      'Account customisation lets your profile feel recognisable when you play, shop, and use connected features.',
                      'Owned customisation items can be reused instead of being temporary one-page choices.',
                      'The more account systems you use, the more your OE becomes the consistent version of you across the platform.'
                    ]
                  }
                },
                {
                  label:
                    'Explore connected systems like the OE Library, Shop, and Olings Lab.',
                  detail: {
                    title: 'Connected Systems',
                    body: 'OVEREXPOSED is designed as a connected platform, so the main areas are meant to feed into each other rather than act like separate pages.',
                    points: [
                      'The Shop adds account-owned items and resources.',
                      'The OE Library manages the customisation side of your account.',
                      'Olings Lab uses eggs, rooms, furniture, care, and inventory to build a longer-term collection loop.'
                    ]
                  }
                }
              ]
            }
          },
          {
            label: 'Party Games',
            section: {
              title: 'Party Games',
              body: 'Party Games are the main live-play area, with each mode using its own rules, packs, and online room flow.',
              guides: [
                {
                  label: 'Choose a mode from the homepage.',
                  detail: {
                    title: 'Choosing A Mode',
                    body: 'Each party game mode has its own style of play, so the homepage acts as the launch point for deciding what kind of session you want.',
                    points: [
                      'Pick the mode that fits the group, such as prompts, voting, secrets, roles, or choices.',
                      'Some modes may support different setup options depending on how the game is designed.',
                      'The mode you choose decides which settings, packs, and runtime screens appear next.'
                    ]
                  }
                },
                {
                  label: 'Configure packs and rules before starting.',
                  detail: {
                    title: 'Packs And Rules',
                    body: 'Before a game starts, packs and rules shape what content appears and how strict or chaotic the session feels.',
                    points: [
                      'Packs control the pool of prompts, questions, or game content.',
                      'Rules change the behaviour of the session, such as scoring, restrictions, round flow, or extra mechanics.',
                      'Good setup makes the game match the group before anyone reaches the live room.'
                    ]
                  }
                },
                {
                  label: 'Host or join online rooms with a party code.',
                  detail: {
                    title: 'Online Rooms',
                    body: 'Online rooms let one player host a session while others join with a shared code.',
                    points: [
                      'The host usually controls setup, starting the game, and some room-level decisions.',
                      'Players use the party code to join the same room from their own device.',
                      'The waiting room keeps everyone together before the game moves into the live flow.'
                    ]
                  }
                }
              ]
            }
          },
          {
            label: 'OE Library',
            section: {
              title: 'OE Library',
              body: 'The OE Library is where you manage how your OE looks and which customisation packs are active.',
              guides: [
                {
                  label: 'Edit your OE appearance.',
                  detail: {
                    title: 'Editing Your OE',
                    body: 'The OE Library gives you control over the pieces that make up your account appearance.',
                    points: [
                      'You can adjust the visible parts of your OE so your account has a recognisable look.',
                      'Customisation choices are account-focused, so they are meant to follow you through the platform.',
                      'Editing your OE is the main way to make the account feel personal rather than generic.'
                    ]
                  }
                },
                {
                  label: 'Enable or disable available OE packs.',
                  detail: {
                    title: 'OE Packs',
                    body: 'OE packs group customisation options together so you can control which styles are available when editing or randomising.',
                    points: [
                      'Active packs can contribute items to the customisation experience.',
                      'Disabling a pack helps narrow the style pool if you do not want certain items appearing.',
                      'Pack control is useful when you own more content and want a cleaner customisation flow.'
                    ]
                  }
                },
                {
                  label: 'Use owned customisation items from your account.',
                  detail: {
                    title: 'Owned Items',
                    body: 'Owned customisation items are tied to your account so they can be used after purchase or unlock.',
                    points: [
                      'Items bought or unlocked through connected systems become part of your available account content.',
                      'The Library is where those owned options become usable for your OE.',
                      'This keeps purchases and unlocks meaningful beyond the screen where you first got them.'
                    ]
                  }
                }
              ]
            }
          },
          {
            label: 'Olings Lab',
            access: { type: 'feature', feature: 'olings.lab' },
            section: {
              title: 'Olings Lab',
              body: 'Olings Lab is where eggs, rooms, furniture, energy, and Oling care come together.',
              guides: [
                {
                  label: 'Incubate eggs and hatch Olings.',
                  detail: {
                    title: 'Eggs And Hatching',
                    body: 'Eggs are the start of the Oling collection loop, and incubation turns them into Olings over time.',
                    points: [
                      'An egg needs to be placed into the lab flow before it can hatch.',
                      'Hatching creates an Oling that becomes part of your account collection.',
                      'Different eggs can support different future possibilities as the Oling system grows.'
                    ]
                  }
                },
                {
                  label: 'Arrange rooms and furniture.',
                  detail: {
                    title: 'Rooms And Furniture',
                    body: 'Rooms give your Olings a place to live, while furniture gives the lab a more personal and functional feel.',
                    points: [
                      'Furniture can be placed into rooms to change how the space looks.',
                      'Room editing is the creative side of the Olings Lab.',
                      'As your collection grows, rooms help organise the care and identity of your Olings.'
                    ]
                  }
                },
                {
                  label: 'Manage energy, rest, and inventory.',
                  detail: {
                    title: 'Care And Inventory',
                    body: 'Olings Lab is also about managing resources, not just collecting creatures.',
                    points: [
                      'Energy and rest help make Olings feel like account companions with needs and limits.',
                      'Inventory stores usable items, furniture, eggs, and other lab-related resources.',
                      'Care systems give the lab a reason to be revisited instead of being a one-time unlock screen.'
                    ]
                  }
                }
              ]
            }
          },
          {
            label: 'Shop',
            access: { type: 'feature', feature: 'shop' },
            section: {
              title: 'Shop',
              body: 'The Shop lets you spend Opals on account-owned items used across OVEREXPOSED.',
              guides: [
                {
                  label: 'Buy eggs, consumables, furniture, and OE items.',
                  detail: {
                    title: 'Buying Items',
                    body: 'The Shop is where Opals turn into account-owned content for the wider platform.',
                    points: [
                      'Different item types belong to different feature areas, such as Olings Lab or OE customisation.',
                      'The product page should explain what the item is, what it costs, and where it will be used.',
                      'Buying an item should add it to the correct account inventory or ownership list.'
                    ]
                  }
                },
                {
                  label: 'Purchases stay connected to your account.',
                  detail: {
                    title: 'Account Ownership',
                    body: 'Shop purchases are intended to be durable account ownership, not temporary page state.',
                    points: [
                      'Owned items should still be available when you return later.',
                      'Account ownership makes purchases useful across the relevant connected systems.',
                      'This is why signing in matters for anything you want to keep.'
                    ]
                  }
                },
                {
                  label: 'Owned items appear in the relevant feature area.',
                  detail: {
                    title: 'Where Items Go',
                    body: 'After buying something, the item should appear in the part of OVEREXPOSED that knows how to use it.',
                    points: [
                      'OE customisation items belong in the OE Library.',
                      'Eggs, furniture, and care items belong in Olings Lab systems.',
                      'The Shop is the purchase point, while the connected feature area is where the item becomes useful.'
                    ]
                  }
                }
              ]
            }
          }
        ]
      },
      partyGameSettings: {
        title: 'Game Settings',
        topics: createPartyGameSettingsTopics()
      },
      mafiaGameSettings: {
        title: 'Mafia Settings',
        topics: createPartyGameSettingsTopics({ mafia: true })
      },
      waitingRoom: {
        title: 'Waiting Room',
        topics: [
          { label: 'Getting Ready', size: 'primary' },
          { label: 'Invite Friends' },
          { label: 'Host Controls' },
          { label: 'Joining Late' },
          { label: 'Party Errors' }
        ]
      },
      onlineGame: {
        title: 'Online Game',
        topics: [
          { label: 'How To Play', size: 'primary' },
          { label: 'Your Turn' },
          { label: 'Choices / Voting' },
          { label: 'Results' },
          { label: 'Rejoining' }
        ]
      },
      offlineGame: {
        title: 'Party Game',
        topics: [
          { label: 'How To Play', size: 'primary' },
          { label: 'Packs' },
          { label: 'Add-ons' },
          { label: 'Next Prompt' },
          { label: 'Game Flow' }
        ]
      },
      overexposure: {
        title: 'Overexposure',
        topics: [
          { label: 'Creating Posts', size: 'primary' },
          { label: 'Reading Posts' },
          { label: 'Delete Codes' },
          { label: 'Customising OE' },
          { label: 'Boundaries' }
        ]
      },
      oeLibrary: {
        title: 'OE Library',
        topics: [
          { label: 'Customising OE', size: 'primary' },
          { label: 'Active Packs' },
          { label: 'Disable OEs' },
          { label: 'Purchased OEs' },
          { label: 'Randomising' }
        ]
      },
      olingLab: {
        title: 'Olings Lab',
        topics: [
          { label: 'Eggs & Incubating', size: 'primary' },
          { label: 'Room Editing' },
          { label: 'Furniture' },
          { label: 'Energy / Rest' },
          { label: 'Inventory' }
        ]
      },
      battleOlings: {
        title: 'Battle Olings',
        topics: [
          { label: 'Battle Flow', size: 'primary' },
          { label: 'Choosing Oling' },
          { label: 'Moves' },
          { label: 'Energy' },
          { label: 'Rewards' }
        ]
      },
      shop: {
        title: 'Shop',
        topics: [
          { label: 'Buying Items', size: 'primary' },
          { label: 'Opals' },
          { label: 'Item Types' },
          { label: 'Ownership' },
          { label: 'Where Items Go' }
        ]
      },
      shopProduct: {
        title: 'Product',
        topics: [
          { label: 'This Item', size: 'primary' },
          { label: 'Price' },
          { label: 'Ownership' },
          { label: 'Where It Appears' },
          { label: 'Using It' }
        ]
      },
      oePanel: {
        title: 'OE Panel',
        topics: [
          { label: 'Dashboard' },
          { label: 'Users' },
          { label: 'Moderation' },
          { label: 'Shop' },
          { label: 'Party Games' },
          { label: 'System' }
        ]
      },
      auth: {
        title: 'Account',
        topics: [
          { label: 'Account Access', size: 'primary' },
          { label: 'Sign In' },
          { label: 'Guest Mode' },
          { label: 'Password Reset' },
          { label: 'Email Verification' }
        ]
      },
      protectedPage: {
        title: 'Access',
        topics: [
          { label: 'Access Required', size: 'primary' },
          { label: 'Why Locked' },
          { label: 'Required Account' },
          { label: 'Where To Go' },
          { label: 'Sign In' }
        ]
      },
      terms: {
        title: 'Terms',
        topics: [
          { label: 'Page Overview', size: 'primary' },
          { label: 'Rules' },
          { label: 'Privacy' },
          { label: 'Data Use' },
          { label: 'Your Choices' }
        ]
      },
      faqs: {
        title: 'FAQ',
        topics: [
          { label: 'Finding Answers', size: 'primary' },
          { label: 'Using Sections' },
          { label: 'Account Questions' },
          { label: 'Game Questions' },
          { label: 'Support' }
        ]
      },
      notFound: {
        title: 'Page',
        topics: [
          { label: 'Page Not Found', size: 'primary' },
          { label: 'Go Home' },
          { label: 'Use Menu' },
          { label: 'Try Again' },
          { label: 'Report Issue' }
        ]
      },
      default: {
        title: 'Page',
        topics: [
          { label: 'Page Overview', size: 'primary' },
          { label: 'Controls' },
          { label: 'Account' },
          { label: 'Navigation' },
          { label: 'Settings' }
        ]
      }
    };

    return { HELP_HUB_TILE_LIMIT, HELP_HUB_CONFIGS };
  }

  window.createHelpHubPageConfigs = createHelpHubPageConfigs;
})();
