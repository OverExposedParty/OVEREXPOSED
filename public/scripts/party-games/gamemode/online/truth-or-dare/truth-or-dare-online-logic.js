function GetQuestion({ cardTitle, currentPartyData }) {
  const config = currentPartyData.config;
  const deck = currentPartyData.deck;

  const questionType = deck.questionType;
  const shuffleSeed = config.shuffleSeed;

  if (questionType == "truth") {
    const index = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
    cardTitle.src = "/images/party-games/truth-or-dare/truth-text.svg";
    return getNextQuestion(index, "truth", shuffleSeed);
  } else if (questionType == "dare") {
    const index = deck.currentCardSecondIndex ?? currentPartyData.currentCardSecondIndex ?? 0;
    cardTitle.src = "/images/party-games/truth-or-dare/dare-text.svg";
    return getNextQuestion(index, "dare", shuffleSeed);
  } else {
    console.warn("Unknown questionType:", questionType);
    return;
  }
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }


  await UpdatePartyGameStatistics();
  const instructions = currentPartyData.config.userInstructions
  if (instructions.includes("DISPLAY_SELECT_QUESTION_TYPE")) {
    DisplaySelectQuestionType();
  }
  else if (instructions.includes("DISPLAY_COMPLETE_QUESTION")) {
    DisplayCompleteQuestion();
  }
  else if (instructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard();
  }
  else if (instructions.includes("DISPLAY_ANSWER_CARD")) {
    DisplayAnswerCard(instructions);
  }
  else if (instructions.includes("DISPLAY_CONFIRM_INPUT")) {
    DisplayConfirmInput(instructions);
  }
  else if (instructions.includes("CHOSE_PUNISHMENT")) {
    console.log(currentPartyData.state.playerTurn);
    ChosePunishment(currentPartyData.state.playerTurn);
  }
  else if (instructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment();
  }
  else if (instructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_QUESTION")) {
    if (instructions.includes("TIMER_EXPIRED:2")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: -2, byPassHost: false });
    }
    else if (instructions.includes("TIMER_EXPIRED")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: -1, byPassHost: false });
    }
    else {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, byPassHost: false });
    }
  }
  console.log(`FETCHING ${instructions}`);
}