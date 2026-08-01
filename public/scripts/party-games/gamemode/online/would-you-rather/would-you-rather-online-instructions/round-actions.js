async function PartySkip({ nextPlayer = true } = {}) {
  if (!nextPlayer) {
    await ResetQuestion({
      nextPlayer: false,
      timer: Date.now() + getTimeLimit() * 1000
    });
    return;
  }

  await SendInstruction({
    instruction: "RESET_QUESTION:"
  });
}

function SplitQuestion(question) {
  const parts = question.split(" OR ");

  if (parts.length === 2) {
    const a = parts[0].trim().replace(/\.*$/, '').replace(/\?/g, '');
    const b = parts[1].trim().replace(/\.*$/, '').replace(/\?/g, '');
    return { a, b };
  } else {
    return {
      a: question.trim().replace(/\.*$/, '').replace(/\?/g, ''),
      b: ""
    };
  }
}
