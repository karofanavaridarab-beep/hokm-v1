const engine = new HokmEngine();
const ui = new HokmUI(engine);

let busy = false;

ui.onCardClick(async (playerIndex, cardId) => {
  if (busy) return;
  if (playerIndex !== 0) return;

  busy = true;

  let result;

  if (engine.awaitingHokmSelection) {
    result = engine.selectHokmCard(playerIndex, cardId);
  } else {
    result = engine.playCard(playerIndex, cardId);
  }

  ui.render();

  if (!result.ok) {
    engine.message = result.reason;
    ui.render();
    busy = false;
    return;
  }

  await afterMoveFlow();

  busy = false;
});

ui.startBtn.addEventListener("click", async () => {
  if (busy) return;

  busy = true;
  ui.startBtn.disabled = true;

  engine.startNewMatch();
  ui.render();

  await ui.sleep(900);
  await aiFlow();

  busy = false;
});

async function afterMoveFlow() {
  await ui.sleep(450);

  if (engine.trickCards.length === 4) {
    await handleTrickComplete();
  }

  await aiFlow();
}

async function aiFlow() {
  while (
    !engine.matchOver &&
    !engine.roundOver &&
    engine.currentPlayer !== engine.humanPlayer
  ) {
    await ui.sleep(650);

    const player = engine.currentPlayer;

    if (engine.awaitingHokmSelection) {
      if (player !== engine.hakem) {
        break;
      }

      const card = engine.chooseAiHokmCard(player);
      if (!card) {
        engine.message = "هوش مصنوعی کارتی برای انتخاب حکم ندارد.";
        ui.render();
        break;
      }

      const result = engine.selectHokmCard(player, card.id);
      ui.render();

      if (!result.ok) {
        engine.message = result.reason;
        ui.render();
        break;
      }

      await ui.sleep(550);
      continue;
    }

    const card = engine.chooseAiCard(player);

    if (!card) {
      engine.message = "هوش مصنوعی کارت قابل بازی ندارد.";
      ui.render();
      break;
    }

    const result = engine.playCard(player, card.id);
    ui.render();

    if (!result.ok) {
      engine.message = result.reason;
      ui.render();
      break;
    }

    await ui.sleep(550);

    if (engine.trickCards.length === 4) {
      await handleTrickComplete();
    }
  }
}

async function handleTrickComplete() {
  ui.render();

  await ui.sleep(1200);

  engine.clearTrickCards();
  ui.render();

  if (engine.roundOver) {
    await handleRoundOver();
  }
}

async function handleRoundOver() {
  ui.render();

  if (engine.matchOver) {
    ui.startBtn.disabled = false;
    ui.startBtn.textContent = "شروع بازی جدید";
    return;
  }

  await ui.sleep(1800);

  engine.prepareRound();
  ui.render();

  await ui.sleep(900);
  await aiFlow();
}

ui.render();
