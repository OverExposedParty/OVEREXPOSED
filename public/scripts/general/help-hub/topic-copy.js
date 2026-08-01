(function () {
  function createHelpHubTopicCopy() {
const HELP_HUB_TOPIC_COPY = {
  'Starting A Game': {
    body: 'Starting a game covers the steps between choosing settings and moving everyone into the first playable round.',
    points: ['Check the selected mode before starting.', 'Make sure packs and rules match the group.', 'Only start when the players who need to join are ready.']
  },
  Packs: {
    body: 'Packs control which prompts, questions, items, or content pools can appear during a game or feature flow.',
    points: ['Use packs to shape the tone of the session.', 'Disable packs that do not fit the group.', 'More active packs usually means more content variety.']
  },
  Rules: {
    body: 'Rules change how a page or game behaves, including limits, scoring, round flow, restrictions, and optional mechanics.',
    points: ['Review rules before committing to a session.', 'Small rule changes can affect the whole flow.', 'Use stricter rules when you want a more controlled experience.']
  },
  Online: {
    body: 'Online controls are for shared sessions where players connect from their own devices and stay synced through a room.',
    points: ['Use online when everyone needs their own screen.', 'Room state is shared between connected players.', 'Connection and host state matter more in online sessions.']
  },
  'Add-ons': {
    body: 'Add-ons are optional extras that change or extend a mode without replacing the main rules.',
    points: ['Enable add-ons when the group wants extra variety.', 'Some add-ons may make a game more chaotic.', 'Keep add-ons off when you want the cleanest default experience.']
  },
  Restrictions: {
    body: 'Restrictions limit what content or actions are allowed so the page fits the audience and situation.',
    points: ['Use restrictions to keep sessions comfortable.', 'Some restrictions affect content selection.', 'Restrictions are useful when playing with mixed groups.']
  },
  'Getting Ready': {
    body: 'Getting ready is the waiting-room step where players confirm they are present before the host starts.',
    points: ['Players should join before the game begins.', 'Ready state helps the host avoid starting too early.', 'The waiting room is the last check before live play.']
  },
  'Invite Friends': {
    body: 'Invite friends explains how other players join the same room and get into the session.',
    points: ['Share the room code with the people you want to invite.', 'Everyone needs to join the same room before starting.', 'If someone joins late, the room rules decide what they can do.']
  },
  'Host Controls': {
    body: 'Host controls are the actions reserved for the person managing the room or session.',
    points: ['The host usually starts the game.', 'Some room decisions are only available to the host.', 'Host controls keep the session from being changed by everyone at once.']
  },
  'Joining Late': {
    body: 'Joining late covers what happens when a player enters after the room or game has already begun.',
    points: ['Late joining may be limited by the current game state.', 'Some modes can add players more safely than others.', 'If joining fails, rejoining or waiting for the next round may be needed.']
  },
  'Party Errors': {
    body: 'Party errors explain room, connection, host, or join-code problems that can stop a session from continuing normally.',
    points: ['Check the room code first.', 'Connection issues can affect live state.', 'If the host leaves, the room may need recovery or a new session.']
  },
  'How To Play': {
    body: 'How to play gives the core rules for the current game mode or feature before you interact with it.',
    points: ['Read this first if the screen is unfamiliar.', 'Focus on the goal, turn order, and what input is expected.', 'Mode-specific rules matter more than general party-game assumptions.']
  },
  'Your Turn': {
    body: 'Your turn explains what you need to do when the live game is waiting for your input.',
    points: ['Look for the active prompt or decision.', 'Submit your choice before the round moves on.', 'If it is not your turn, wait for the current player or phase to finish.']
  },
  'Choices / Voting': {
    body: 'Choices and voting cover moments where players pick an option, choose someone, or decide a result together.',
    points: ['Your selection may affect scoring or reveals.', 'Some votes are public while others are hidden.', 'Wait for all required players before expecting results.']
  },
  Results: {
    body: 'Results show what happened after a round, vote, action, or final game state.',
    points: ['Use results to understand the outcome.', 'Scores or standings may update here.', 'Some modes reveal extra information only after everyone responds.']
  },
  Rejoining: {
    body: 'Rejoining explains how a player returns to a live session after refreshing, disconnecting, or leaving briefly.',
    points: ['Use the same account or guest identity where possible.', 'The room must still exist for rejoining to work.', 'Some game states may limit what a rejoined player can do.']
  },
  'Next Prompt': {
    body: 'Next prompt is the control or flow that moves an offline game to the next question, dare, or round.',
    points: ['Use it when the current prompt is finished.', 'Make sure the group has responded before moving on.', 'Prompt order depends on the active packs and mode rules.']
  },
  'Game Flow': {
    body: 'Game flow explains the order of screens, actions, rounds, and results inside the current mode.',
    points: ['Follow the current phase before jumping ahead.', 'Each mode has its own rhythm.', 'Flow is easier when players wait for the page to update.']
  },
  'Creating Posts': {
    body: 'Creating posts covers adding new Overexposure content for other users to read or react to.',
    points: ['Write content that fits the page rules.', 'Check the selected options before posting.', 'Some posts may need codes or moderation depending on the feature.']
  },
  'Reading Posts': {
    body: 'Reading posts is about browsing the visible Overexposure content and understanding what has been shared.',
    points: ['Use the visible controls to move through content.', 'Read context before reacting or deleting anything.', 'Unavailable posts may have been removed or filtered.']
  },
  'Delete Codes': {
    body: 'Delete codes are used to remove specific posted content when the page supports code-based deletion.',
    points: ['Keep the delete code if you may need to remove a post later.', 'Codes should be treated like ownership keys.', 'A missing or wrong code may prevent deletion.']
  },
  'Customising OE': {
    body: 'Customising OE is where you change how your account identity looks across OVEREXPOSED.',
    points: ['Pick the visual parts that fit your account.', 'Owned items and active packs affect what is available.', 'Your OE helps other players recognise you.']
  },
  Boundaries: {
    body: 'Boundaries explain the comfort and content limits that keep shared spaces usable for different groups.',
    points: ['Respect the tone of the page or room.', 'Use filters and restrictions when needed.', 'Avoid content that would make the session worse for others.']
  },
  'Active Packs': {
    body: 'Active packs are the customisation or content packs currently allowed to contribute items.',
    points: ['Enable packs you want included.', 'Disable packs you do not want appearing.', 'Active packs affect randomising and available choices.']
  },
  'Disable OEs': {
    body: 'Disabling OEs removes specific OE options from the active customisation pool.',
    points: ['Use this to hide styles you do not want.', 'Disabled options should stop appearing in randomised results.', 'You can keep ownership without keeping everything active.']
  },
  'Purchased OEs': {
    body: 'Purchased OEs are account-owned customisation items unlocked through the Shop or other reward paths.',
    points: ['Purchases should stay tied to your account.', 'Owned OEs can be reused after unlocking.', 'The Library is where purchased customisation becomes usable.']
  },
  Randomising: {
    body: 'Randomising creates a new OE combination from the items and packs currently available.',
    points: ['Randomising depends on active packs.', 'Disabled items should be avoided.', 'Use it when you want a quick new look without manual editing.']
  },
  'Eggs & Incubating': {
    body: 'Eggs and incubating cover the process of turning Oling eggs into hatched Olings.',
    points: ['Place an egg into the incubation flow.', 'Wait for the hatch requirements to complete.', 'Hatched Olings become part of your collection.']
  },
  'Room Editing': {
    body: 'Room editing lets you arrange the Olings Lab space and change how rooms are laid out.',
    points: ['Use editing when you want to place or move furniture.', 'Room layout affects the feel of your lab.', 'A clearer room makes Oling care easier to scan.']
  },
  Furniture: {
    body: 'Furniture is the set of room items you can place, collect, buy, or manage for Oling spaces.',
    points: ['Furniture can be decorative or functional depending on the item.', 'Owned furniture belongs to your account inventory.', 'Placed furniture changes the room presentation.']
  },
  'Energy / Rest': {
    body: 'Energy and rest explain Oling condition, availability, and recovery.',
    points: ['Energy can limit what an Oling is ready to do.', 'Rest is how an Oling recovers.', 'Care states make Olings feel persistent rather than temporary.']
  },
  Inventory: {
    body: 'Inventory stores account-owned items connected to the current feature area.',
    points: ['Check inventory when you cannot find a purchased item.', 'Different item types appear in different inventories.', 'Inventory is the bridge between buying, owning, and using.']
  },
  'Battle Flow': {
    body: 'Battle flow explains the sequence of choosing an Oling, taking turns, using moves, and seeing the outcome.',
    points: ['Start by choosing the Oling you want to use.', 'Follow the turn prompts during battle.', 'Rewards or results appear after the battle resolves.']
  },
  'Choosing Oling': {
    body: 'Choosing Oling is where you select which Oling represents you in a battle or activity.',
    points: ['Pick an Oling that is available.', 'Energy or state may affect the choice.', 'Different Olings may become better for different activities later.']
  },
  Moves: {
    body: 'Moves are the actions an Oling can use during a battle or challenge.',
    points: ['Choose moves based on the current situation.', 'Some moves may cost energy or have limits.', 'Move outcomes decide how the battle progresses.']
  },
  Energy: {
    body: 'Energy is a resource that controls how ready an Oling or account system is to act.',
    points: ['Low energy may block actions.', 'Energy usually recovers through rest or time.', 'Plan around energy when using repeated activities.']
  },
  Rewards: {
    body: 'Rewards are the items, currency, progress, or unlocks earned after completing an action.',
    points: ['Check where each reward is stored.', 'Some rewards affect account progression.', 'Rewards should connect back to the feature that can use them.']
  },
  'Buying Items': {
    body: 'Buying items explains how Shop products become account-owned content.',
    points: ['Check the item type before buying.', 'Make sure you have enough Opals.', 'Bought items should appear in the relevant feature area.']
  },
  Opals: {
    body: 'Opals are the account currency used for purchases and some reward loops.',
    points: ['Spend Opals on supported Shop items.', 'Your balance should stay connected to your account.', 'Check the price before confirming a purchase.']
  },
  'Item Types': {
    body: 'Item types explain what a product is and which system knows how to use it.',
    points: ['OE items belong to customisation.', 'Eggs and furniture belong to Oling systems.', 'Consumables should explain when and where they can be used.']
  },
  Ownership: {
    body: 'Ownership means an item, unlock, or purchase belongs to your account after you receive it.',
    points: ['Owned content should persist across visits.', 'Ownership decides what features can access the item.', 'Sign in when you want progress and purchases to be durable.']
  },
  'Where Items Go': {
    body: 'Where items go explains which page or inventory receives a purchase after it is bought.',
    points: ['OE items go to the OE Library.', 'Oling items go to Olings Lab systems.', 'The Shop is where items are bought, not always where they are used.']
  },
  'This Item': {
    body: 'This item explains the specific product you are viewing and what it is meant to do.',
    points: ['Read the item name and description first.', 'Check the type so you know where it will appear.', 'Only buy when the item matches what you need.']
  },
  Price: {
    body: 'Price shows how many Opals or resources the current item costs.',
    points: ['Compare the price with your balance.', 'Some items may be one-time purchases.', 'Confirming a purchase should deduct the listed cost.']
  },
  'Where It Appears': {
    body: 'Where it appears tells you which feature area will show the item after purchase or unlock.',
    points: ['Check the product type for the destination.', 'Some items appear in inventory first.', 'If an item is missing, check the matching feature area.']
  },
  'Using It': {
    body: 'Using it explains what to do after an item is owned.',
    points: ['Go to the feature that supports the item.', 'Some items need to be equipped, placed, or consumed.', 'Owned does not always mean automatically active.']
  },
  Dashboard: {
    body: 'Dashboard is the overview area for checking site state, useful signals, and important admin summaries.',
    points: ['Use it for a quick health check.', 'Look for warnings before deeper work.', 'Dashboard summaries should lead to more detailed admin areas.']
  },
  Users: {
    body: 'Users covers account records, player information, access state, and account-level admin actions.',
    points: ['Search for the account you need.', 'Check status before changing access.', 'User tools should be handled carefully because they affect real accounts.']
  },
  Moderation: {
    body: 'Moderation covers reviewing, controlling, or investigating content and behaviour that needs attention.',
    points: ['Use moderation tools when content breaks rules.', 'Review context before acting.', 'Good moderation keeps shared areas usable.']
  },
  Shop: {
    body: 'Shop covers the admin or product area connected to items, purchases, prices, and account-owned content.',
    points: ['Use Shop tools to understand product setup.', 'Check item type, cost, and ownership behaviour.', 'Shop changes can affect what users are able to buy or use.']
  },
  'Party Games': {
    body: 'Party Games covers the mode, room, rule, and live-play systems used by multiplayer sessions.',
    points: ['Check game modes and runtime state together.', 'Room and player issues often affect live play.', 'Use this area when a party-game feature needs inspection.']
  },
  System: {
    body: 'System covers technical site controls, configuration, diagnostics, and operational state.',
    points: ['Use system tools when site behaviour needs checking.', 'Be careful with controls that affect everyone.', 'System information should support maintenance and debugging.']
  },
  'Account Access': {
    body: 'Account access explains what signing in unlocks and why some actions require an account.',
    points: ['Accounts preserve ownership and progress.', 'Guest mode may not keep everything forever.', 'Sign in before buying or saving anything important.']
  },
  'Sign In': {
    body: 'Sign in connects your current session to an account so progress, ownership, and identity can persist.',
    points: ['Use the correct email and password.', 'Signed-in users can access account-owned content.', 'If sign in fails, check credentials or reset the password.']
  },
  'Guest Mode': {
    body: 'Guest mode lets you use parts of OVEREXPOSED without a full account.',
    points: ['Guest access is useful for quick entry.', 'Some progress or ownership may be limited.', 'Create or sign into an account for durable identity.']
  },
  'Password Reset': {
    body: 'Password reset is for regaining access when you cannot sign in with your current password.',
    points: ['Use the email connected to the account.', 'Follow the reset link or instructions carefully.', 'After resetting, sign in with the new password.']
  },
  'Email Verification': {
    body: 'Email verification confirms that the account email belongs to you.',
    points: ['Check your inbox for the verification message.', 'Some account actions may require verification.', 'Use the newest verification link if multiple were sent.']
  },
  'Access Required': {
    body: 'Access required means the page is locked until the correct account state or permission is present.',
    points: ['Sign in before trying again.', 'Some pages need special roles or ownership.', 'If access looks wrong, check the account being used.']
  },
  'Why Locked': {
    body: 'Why locked explains the reason a page or action is unavailable.',
    points: ['The page may require sign-in.', 'The feature may be limited to specific users.', 'The account may not have the needed permission yet.']
  },
  'Required Account': {
    body: 'Required account explains what kind of account state is needed to continue.',
    points: ['Some pages only need sign-in.', 'Admin or owner areas need stronger access.', 'Use the account that actually owns the relevant content or permission.']
  },
  'Where To Go': {
    body: 'Where to go points you toward the next page or action when the current page cannot continue.',
    points: ['Use the header or menu to navigate.', 'Sign in if the page asks for account access.', 'Return after the missing requirement is fixed.']
  },
  'Page Overview': {
    body: 'Page overview summarises what the current page is for and how its main sections fit together.',
    points: ['Start here when the page feels unfamiliar.', 'Use the overview to find the right control area.', 'Move into specific topics when you need more detail.']
  },
  Privacy: {
    body: 'Privacy explains how account, usage, and content information should be handled.',
    points: ['Read privacy sections before sharing sensitive information.', 'Account features may store data to work correctly.', 'Privacy choices explain what control you have over your information.']
  },
  'Data Use': {
    body: 'Data use explains why information is collected, stored, or processed by the platform.',
    points: ['Some data is needed for accounts and purchases.', 'Gameplay and site features may rely on saved state.', 'Policies should explain how data supports the service.']
  },
  'Your Choices': {
    body: 'Your choices explain the controls or decisions available to you in terms, privacy, account, or feature settings.',
    points: ['Review the options before agreeing or continuing.', 'Some choices affect account behaviour.', 'Use settings or account controls where available.']
  },
  'Finding Answers': {
    body: 'Finding answers helps you use FAQ sections to locate the information closest to your question.',
    points: ['Start with the topic that matches your problem.', 'Use sections to narrow broad questions.', 'If an answer is missing, support or feedback may be needed.']
  },
  'Using Sections': {
    body: 'Using sections explains how FAQ content is grouped so related questions stay together.',
    points: ['Open the section closest to your question.', 'Scan related entries before switching categories.', 'Sections make long FAQ pages easier to browse.']
  },
  'Account Questions': {
    body: 'Account questions cover sign-in, guest mode, ownership, verification, and saved progress.',
    points: ['Check account state first.', 'Ownership usually requires a real account.', 'Password and email issues should use the auth tools.']
  },
  'Game Questions': {
    body: 'Game questions cover party modes, rules, packs, rooms, and live-play behaviour.',
    points: ['Find the mode you are using.', 'Check settings before assuming a bug.', 'Online and offline games can behave differently.']
  },
  Support: {
    body: 'Support explains what to do when the page or FAQ does not answer the problem.',
    points: ['Collect the page, account state, and error context.', 'Try the obvious recovery steps first.', 'Report unclear or broken behaviour with enough detail to reproduce it.']
  },
  'Page Not Found': {
    body: 'Page not found means the address does not match a page the site can show.',
    points: ['Check for typos in the URL.', 'Use the menu to return to a known page.', 'The page may have moved or been removed.']
  },
  'Go Home': {
    body: 'Go home returns you to the main OVEREXPOSED entry point.',
    points: ['Use it when you are lost.', 'The homepage links to the major feature areas.', 'Returning home is usually the quickest reset.']
  },
  'Use Menu': {
    body: 'Use menu points you toward the header menu for navigation.',
    points: ['Open the menu from the header.', 'Choose the feature area you want.', 'The menu is safer than guessing a URL.']
  },
  'Try Again': {
    body: 'Try again covers retrying after a page load, route, or temporary state problem.',
    points: ['Refresh if the page did not load correctly.', 'Check the URL before retrying repeatedly.', 'If it still fails, use another navigation path.']
  },
  'Report Issue': {
    body: 'Report issue means the problem may need to be investigated or fixed.',
    points: ['Capture what page you were on.', 'Include what you clicked before the problem happened.', 'Error messages and account state make reports more useful.']
  },
  Controls: {
    body: 'Controls are the buttons, toggles, inputs, and panels used to interact with the current page.',
    points: ['Use visible controls before trying another route.', 'Disabled controls usually mean a requirement is missing.', 'Hover, labels, and active states explain what can be changed.']
  },
  Account: {
    body: 'Account covers identity, progress, ownership, and profile-related actions.',
    points: ['Sign in to keep important state.', 'Guest mode is lighter and may be limited.', 'Account panels show identity and saved information.']
  },
  Navigation: {
    body: 'Navigation explains how to move between major pages and return to known areas.',
    points: ['Use the header buttons and menu.', 'Back controls return within the current panel when available.', 'The homepage is the main reset point.']
  },
  Settings: {
    body: 'Settings control page or account preferences that change how the experience behaves.',
    points: ['Check settings when something feels filtered or muted.', 'Some settings affect comfort and presentation.', 'Settings may differ by page or account state.']
  },
  'Pick Truth/Dare': {
    body: 'Pick Truth/Dare is the choice point where a player decides which kind of prompt they want to receive.',
    points: ['Truth usually asks for an honest answer.', 'Dare usually asks the player to perform an action.', 'The choice shapes the rest of that player turn.']
  },
  'Answer Or Pass': {
    body: 'Answer or pass explains what a player can do after receiving a Truth or Dare prompt.',
    points: ['Answering completes the prompt normally.', 'Passing may trigger a penalty or alternate outcome.', 'The active rules decide how strict passing should be.']
  },
  Punishments: {
    body: 'Punishments are consequences used when a player passes, loses, is chosen, or triggers a mode-specific rule.',
    points: ['Punishments should match the group comfort level.', 'Rules decide when punishments apply.', 'Use restrictions if the group wants a softer session.']
  },
  Waiting: {
    body: 'Waiting explains what to do while another player, vote, reveal, or round phase is active.',
    points: ['Do not refresh or leave unless needed.', 'Watch the current prompt or status text.', 'The game will move forward when the required action is complete.']
  },
  Answering: {
    body: 'Answering covers the response a player gives when the current mode asks them a question.',
    points: ['Answer based on the prompt shown.', 'Some answers are private until results.', 'Submit once you are happy with the response.']
  },
  Choosing: {
    body: 'Choosing is the moment where you pick between options, people, or outcomes.',
    points: ['Read all visible options first.', 'Your choice may affect scores or reveals.', 'Some choices cannot be changed after submitting.']
  },
  'Round Flow': {
    body: 'Round flow explains how the mode moves from prompt to response to results.',
    points: ['Follow the current phase shown on screen.', 'Wait for all required players before results.', 'The next round starts after the current result resolves.']
  },
  Voting: {
    body: 'Voting is where players choose a person or option to decide the round outcome.',
    points: ['Vote based on the prompt or discussion.', 'Some votes may be hidden until the reveal.', 'Ties or missing votes may use mode-specific rules.']
  },
  'Being Chosen': {
    body: 'Being chosen means other players selected you as the answer or target for the round.',
    points: ['The mode decides whether being chosen is good, bad, or neutral.', 'Results may show who chose you.', 'Punishments or points can depend on being chosen.']
  },
  'Tie Breakers': {
    body: 'Tie breakers explain what happens when players or options receive the same result.',
    points: ['The mode may pick a winner automatically.', 'Some ties may require another vote.', 'Tie rules keep the round from getting stuck.']
  },
  'Secret Prompt': {
    body: 'Secret prompt covers information shown privately to one player before they choose someone.',
    points: ['Only the active player should see the secret prompt.', 'The chosen player may not know why they were picked.', 'Reveal rules decide whether the prompt becomes public.']
  },
  'Choosing Someone': {
    body: 'Choosing someone is where the active player selects another player as their answer or target.',
    points: ['Pick based on the prompt, not just randomly.', 'The chosen player may be involved in the reveal.', 'Some modes attach consequences to the choice.']
  },
  'Reveal / Pass': {
    body: 'Reveal or pass is the decision to show hidden information or avoid the reveal.',
    points: ['Revealing usually makes the round more dramatic.', 'Passing can protect secrecy but may carry a cost.', 'The active rules decide what happens after each choice.']
  },
  'Your Word': {
    body: 'Your word is the private clue or role information used during Imposter-style play.',
    points: ['Most players may share the same word.', 'The imposter may have different or missing information.', 'Protect your role while still contributing to discussion.']
  },
  Explaining: {
    body: 'Explaining is the discussion phase where players describe their word or position without giving too much away.',
    points: ['Give enough detail to seem credible.', 'Avoid exposing the word too directly.', 'Listen for answers that do not fit.']
  },
  'Finding Imposter': {
    body: 'Finding imposter is the goal of identifying who does not match the rest of the group.',
    points: ['Compare explanations carefully.', 'Vote when the group has enough suspicion.', 'The imposter wins or loses based on the mode rules.']
  },
  Roles: {
    body: 'Roles define what each player can do and what information they have in Mafia.',
    points: ['Read your role carefully before acting.', 'Different roles may have different night actions.', 'Do not reveal role information unless the strategy makes sense.']
  },
  'Day / Night': {
    body: 'Day and night are the main phases that organise Mafia actions and discussion.',
    points: ['Night is usually for hidden role actions.', 'Day is usually for discussion and voting.', 'The game outcome depends on how each phase resolves.']
  },
  Winning: {
    body: 'Winning explains the condition that ends the mode in favour of one player or team.',
    points: ['Each mode has its own win condition.', 'Team games may end when one side reaches its goal.', 'Results should make clear why the winner won.']
  }
};

    return { HELP_HUB_TOPIC_COPY };
  }

  window.createHelpHubTopicCopy = createHelpHubTopicCopy;
})();
