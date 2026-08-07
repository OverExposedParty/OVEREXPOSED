let allQuestions = [];
let currentQuestionIndex = 0;
let cardPackMap = []; // Maps cards to their respective packs

let numberOfQuestions = 0;
let numberOfTruthQuestions = 0;
let numberOfDareQuestions = 0;
let offlineQuestionAnalyticsState = null;

function getQuestionAnalyticsNow() {
  return typeof window.performance?.now === 'function'
    ? window.performance.now()
    : Date.now();
}

function finishOfflineQuestionAnalytics(outcome = 'next_question') {
  const state = offlineQuestionAnalyticsState;
  if (!state) return;

  const now = getQuestionAnalyticsNow();
  if (state.visibleStartedAt !== null) {
    state.activeMs += now - state.visibleStartedAt;
  }
  offlineQuestionAnalyticsState = null;
  window.OEAnalytics?.track(
    outcome === 'next_question'
      ? 'game.question_advanced'
      : 'game.question_abandoned',
    {
      questionId: state.questionId,
      packKey: state.packKey,
      questionType: state.questionType,
      displayedMs: now - state.startedAt,
      activeMs: state.activeMs,
      outcome
    },
    { gameMode: gamemode, playMode: 'offline' }
  );
}

function beginOfflineQuestionAnalytics(question) {
  if ((typeof partyCode === 'string' && partyCode) || !question?.questionId) {
    return;
  }
  finishOfflineQuestionAnalytics('next_question');
  const now = getQuestionAnalyticsNow();
  offlineQuestionAnalyticsState = {
    questionId: question.questionId,
    packKey: question.packKey || 'unknown-pack',
    questionType: question.questionType || 'question',
    startedAt: now,
    visibleStartedAt: document.hidden ? null : now,
    activeMs: 0
  };
  window.OEAnalytics?.track(
    'game.question_shown',
    {
      questionId: question.questionId,
      packKey: question.packKey || 'unknown-pack',
      questionType: question.questionType || 'question'
    },
    { gameMode: gamemode, playMode: 'offline' }
  );
}

document.addEventListener('visibilitychange', () => {
  const state = offlineQuestionAnalyticsState;
  if (!state) return;
  const now = getQuestionAnalyticsNow();
  if (document.hidden && state.visibleStartedAt !== null) {
    state.activeMs += now - state.visibleStartedAt;
    state.visibleStartedAt = null;
  } else if (!document.hidden && state.visibleStartedAt === null) {
    state.visibleStartedAt = now;
  }
});

window.addEventListener('pagehide', () => {
  finishOfflineQuestionAnalytics('page_exit');
  window.OEAnalytics?.flush({ beacon: true });
});

window.OEOfflineQuestionAnalytics = {
  beginQuestion: beginOfflineQuestionAnalytics,
  finishQuestion: finishOfflineQuestionAnalytics
};

function addPartyCodeToQuestionContentUrl(url) {
  const code = String(
    typeof partyCode === 'undefined' ? '' : partyCode
  ).trim();
  if (!code) return url;

  const separator = String(url).includes('?') ? '&' : '?';
  return `${url}${separator}partyCode=${encodeURIComponent(code)}`;
}

async function loadJSONFiles(fetchPacks = null, seedShuffle = null) {
  try {
    debugLog(`[loadJSONFiles] gamemode=${gamemode}, shuffleSeed=`, seedShuffle);

    // Reset question state on every load so reconnects/re-inits don't duplicate
    // the deck differently per client.
    allQuestions = [];
    currentQuestionIndex = 0;
    cardPackMap = [];
    numberOfQuestions = 0;
    numberOfTruthQuestions = 0;
    numberOfDareQuestions = 0;

    const packsResponse = await fetch(
      addPartyCodeToQuestionContentUrl(`/api/party-game-packs/${gamemode}`)
    );
    if (!packsResponse.ok) {
      console.error(`Failed to fetch packs: ${packsResponse.statusText}`);
      return;
    }

    const packsPayload = await packsResponse.json();
    const packsData = packsPayload.data || packsPayload;
    const packs = packsData[`${gamemode}-packs`];

    let filesToFetch = [];

    if (fetchPacks === null) {
      filesToFetch = packs
        .filter(pack => {
          const key = pack["pack-name"];
          return localStorage.getItem(key) === "true";
        })
        .map(pack => pack["pack-path"]);
    } else {
      if (!Array.isArray(fetchPacks)) {
        console.error("fetchPacks must be an array of pack names");
        return;
      }

      filesToFetch = packs
        .filter(pack => fetchPacks.includes(pack["pack-name"]))
        .map(pack => pack["pack-path"]);
    }

    debugLog("Files to Fetch:", filesToFetch);

    const responses = await Promise.all(
      filesToFetch.map(file => fetch(addPartyCodeToQuestionContentUrl(file)))
    );

    const questionsArrays = await Promise.all(
      responses.map(async response => {
        if (!response.ok) {
          console.error(`Failed to fetch ${response.url}: ${response.statusText}`);
          return {};
        }
        const payload = await response.json();
        return payload.data || payload;
      })
    );

    questionsArrays.forEach(data => {
      Object.keys(data).forEach(packName => {
        const questions = data[packName];

        if (!Array.isArray(questions)) {
          console.error(`Invalid pack format for ${packName}`, questions);
          return;
        }

        const displayPackName = packName
          .replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(formattedGamemode, "")
          .trim();

        questions.forEach((question, questionIndex) => {
          const alts = question["question-alternatives"];

          if (alts === undefined || alts === null) {
            question["question-alternatives"] = [];
          } else if (!Array.isArray(alts)) {
            question["question-alternatives"] = [alts];
          }

          question.__packName = displayPackName;
          question.__packKey = packName;
          question.__questionId =
            question['question-id'] || `${packName}:${questionIndex + 1}`;
          allQuestions.push(question);
        });
      });
    });

    packs.forEach(pack => {
      const packName = pack["pack-name"].replace(/-/g, " ").replace(/^\w/, c => c.toUpperCase());
      const packColour = pack["pack-colour"];
      const packSecondaryColour = pack["pack-secondary-colour"];
      const packRestriction = pack["pack-restriction"] || null;
      cardPackMap.push({ packName, packColour, packSecondaryColour, packRestriction });
    });

    if (allQuestions.length > 0) {
      if (seedShuffle !== null && seedShuffle !== undefined) {
        shuffleQuestions(seedShuffle);
      } else {
        shuffleQuestions();
      }

      numberOfTruthQuestions = allQuestions.filter(q => q["question-type"] === "truth").length;
      numberOfDareQuestions = allQuestions.filter(q => q["question-type"] === "dare").length;
    } else {
      console.error("No questions available to shuffle.");
      const isOnlineParty =
        typeof partyCode !== 'undefined' && Boolean(String(partyCode).trim());

      if (
        isOnlineParty &&
        typeof ShowGameConfigurationErrorState === 'function'
      ) {
        ShowGameConfigurationErrorState();
      } else if (typeof addSettingsExtensionToCurrentURL === 'function') {
        window.location.href = addSettingsExtensionToCurrentURL();
      } else {
        const settingsPath =
          typeof gamemode === 'string' && gamemode
            ? `/${gamemode}/settings`
            : '/';
        window.location.href = settingsPath;
      }

      numberOfQuestions = 0;
      SetScriptLoaded("/scripts/party-games/general/load-questions.js");
      return false;
    }

    numberOfQuestions = allQuestions.length;
    debugLog(`Loaded ${numberOfQuestions} questions`);
    SetScriptLoaded("/scripts/party-games/general/load-questions.js");
    return true;

  } catch (error) {
    console.error("Failed to load JSON files:", error);
    return false;
  }
}


function shuffleQuestions(seed = null) {
    // Seedable random number generator (simple LCG)
    function seededRandom(seed) {
        let m = 0x80000000; // 2**31
        let a = 1103515245;
        let c = 12345;
        let state = seed !== null && seed !== undefined
            ? Number(seed)
            : Math.floor(Math.random() * m);

        return function () {
            state = (a * state + c) % m;
            return state / m;
        };
    }

    const random = seed !== null ? seededRandom(seed) : Math.random;

    for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
}

function getNextQuestion(index = null, questionType = null, seed = null) {
    let selectedQuestion;
    let cardType;
    let filteredQuestions = allQuestions;

    if (questionType !== null) {
        filteredQuestions = allQuestions.filter(q => q["question-type"] === questionType);
    }

    if (index == null) {
        if (currentQuestionIndex >= filteredQuestions.length) {
            shuffleQuestions();
            currentQuestionIndex = 0;
        }

        selectedQuestion = filteredQuestions[currentQuestionIndex];
        cardType = selectedQuestion?.__packName || 'Unknown Pack';
        currentQuestionIndex++;
    } else {
        selectedQuestion = filteredQuestions[index];
        cardType = selectedQuestion?.__packName || 'Unknown Pack';
    }

    const result = {
        question: selectedQuestion["question"],
        cardType: cardType,
        packKey: selectedQuestion.__packKey || 'unknown-pack',
        questionId: selectedQuestion.__questionId || null,
        questionType: selectedQuestion["question-type"] || 'question',
        punishment: selectedQuestion["punishment"] || null,
        // ✅ Now always an array in your JSON
        questionAlternatives: selectedQuestion["question-alternatives"] || []
    };
    beginOfflineQuestionAnalytics(result);
    return result;
}
