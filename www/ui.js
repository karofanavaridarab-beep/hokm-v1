class HokmUI {
  constructor(engine) {
    this.engine = engine;

    this.startBtn = document.getElementById("startBtn");
    this.messageEl = document.getElementById("message");

    this.gameScore0 = document.getElementById("gameScore0");
    this.gameScore1 = document.getElementById("gameScore1");
    this.trickScore0 = document.getElementById("trickScore0");
    this.trickScore1 = document.getElementById("trickScore1");

    this.hakemText = document.getElementById("hakemText");
    this.dealerText = document.getElementById("dealerText");
    this.hokmText = document.getElementById("hokmText");
    this.turnText = document.getElementById("turnText");

    this.tableSlots = [
      document.getElementById("tableSlot0"),
      document.getElementById("tableSlot1"),
      document.getElementById("tableSlot2"),
      document.getElementById("tableSlot3")
    ];

    this.playerAreas = [
      document.getElementById("player0Area"),
      document.getElementById("player1Area"),
      document.getElementById("player2Area"),
      document.getElementById("player3Area")
    ];

    this.playerHands = [
      document.getElementById("player0Hand"),
      document.getElementById("player1Hand"),
      document.getElementById("player2Hand"),
      document.getElementById("player3Hand")
    ];

    this.playerLabels = [
      document.getElementById("player0Label"),
      document.getElementById("player1Label"),
      document.getElementById("player2Label"),
      document.getElementById("player3Label")
    ];

    this.revealSpots = [
      document.getElementById("revealSpot0"),
      document.getElementById("revealSpot1"),
      document.getElementById("revealSpot2"),
      document.getElementById("revealSpot3")
    ];

    this.cardClickHandler = null;
  }

  onCardClick(handler) {
    this.cardClickHandler = handler;
  }

  render() {
    const state = this.engine.getState();

    this.renderScores(state);
    this.renderTopInfo(state);
    this.updatePlayerStates(state);
    this.renderHands(state);
    this.renderTable(state);
    this.renderReveal(state);
    this.renderMessage(state);
    this.renderStartButton(state);
  }

  renderScores(state) {
    this.gameScore0.textContent = state.gameScores[0];
    this.gameScore1.textContent = state.gameScores[1];

    this.trickScore0.textContent = state.trickScores[0];
    this.trickScore1.textContent = state.trickScores[1];
  }

  renderTopInfo(state) {
    this.hakemText.textContent =
      state.hakem == null ? "-" : this.engine.playerName(state.hakem);

    this.dealerText.textContent =
      state.dealer == null ? "-" : this.engine.playerName(state.dealer);

    this.hokmText.textContent = state.hokm
      ? this.engine.suitName(state.hokm) + " " + this.engine.suitSymbol(state.hokm)
      : (state.awaitingHokmSelection ? "در انتظار انتخاب حکم" : "-");

    if (state.matchOver) {
      this.turnText.textContent = "پایان مسابقه";
    } else if (state.roundOver) {
      this.turnText.textContent = "پایان راند";
    } else if (state.awaitingHokmSelection) {
      this.turnText.textContent =
        state.currentPlayer == null
          ? "انتخاب حکم"
          : "انتخاب حکم: " + this.engine.playerName(state.currentPlayer);
    } else {
      this.turnText.textContent =
        state.currentPlayer == null ? "-" : this.engine.playerName(state.currentPlayer);
    }
  }

  updatePlayerStates(state) {
    for (let i = 0; i < this.playerAreas.length; i++) {
      const area = this.playerAreas[i];
      area.classList.remove("active", "hakem", "dealer");

      const isCurrentTurn =
        state.currentPlayer === i &&
        !state.roundOver &&
        !state.matchOver;

      if (isCurrentTurn) {
        area.classList.add("active");
      }

      if (state.hakem === i) {
        area.classList.add("hakem");
      }

      if (state.dealer === i) {
        area.classList.add("dealer");
      }

      const parts = [this.engine.playerName(i)];

      if (state.hakem === i) {
        parts.push("حاکم");
      }

      if (state.dealer === i) {
        parts.push("پخش‌کننده");
      }

      if (state.awaitingHokmSelection && state.currentPlayer === i && !state.roundOver && !state.matchOver) {
        parts.push("در حال انتخاب حکم");
      } else if (isCurrentTurn) {
        parts.push("نوبت");
      }

      this.playerLabels[i].textContent = parts.join(" | ");
    }
  }

  renderHands(state) {
    this.renderMyHand(state);
    this.renderOpponentHand(1, state);
    this.renderOpponentHand(2, state);
    this.renderOpponentHand(3, state);
  }

  renderMyHand(state) {
    const myHandEl = this.playerHands[0];
    myHandEl.innerHTML = "";

    const hand = state.hands[0];
    const spread = 18;
    const start = -((hand.length - 1) * spread) / 2;

    hand.forEach((card, i) => {
      const el = this.card(card);
      const angle = start + i * spread;

      el.style.transform = `rotate(${angle / 4}deg)`;

      if (i > 0) {
        el.style.marginRight = "-20px";
      }

      const isMyTurn = state.currentPlayer === 0;
      const gameActive = !state.roundOver && !state.matchOver;

      let clickable = false;

      if (gameActive && isMyTurn) {
        if (state.awaitingHokmSelection) {
          clickable = state.hakem === 0;
        } else {
          clickable = this.engine.canPlayCard(0, card);
        }
      }

      if (clickable) {
        el.classList.add("playable");
        el.onclick = () => {
          if (this.cardClickHandler) {
            this.cardClickHandler(0, card.id);
          }
        };
      } else {
        el.classList.add("disabled-card");
      }

      if (state.awaitingHokmSelection && state.hakem === 0 && isMyTurn) {
        el.title =
          "برای انتخاب خال حکم، روی یک کارت از خال دلخواهت کلیک کن";
      }

      myHandEl.appendChild(el);
    });
  }

  renderOpponentHand(playerIndex, state) {
    const container = this.playerHands[playerIndex];
    container.innerHTML = "";

    const handCount = state.hands[playerIndex].length;

    for (let i = 0; i < handCount; i++) {
      const cardBack = this.cardBack(true);

      if (playerIndex === 2) {
        cardBack.classList.add("top-stack-card");
        if (i > 0) {
          cardBack.style.marginRight = "-24px";
        }
      } else {
        cardBack.classList.add("side-stack-card");
        if (i > 0) {
          cardBack.style.marginTop = "-34px";
        }
      }

      container.appendChild(cardBack);
    }
  }

  renderTable(state) {
    this.tableSlots.forEach(slot => {
      slot.innerHTML = "";
      slot.classList.remove("winning-slot");
    });

    state.trickCards.forEach(t => {
      const cardEl = this.card(t.card);
      cardEl.classList.add("table-card");
      this.tableSlots[t.player].appendChild(cardEl);
    });

    if (state.trickCards.length === 4) {
      const leadSuit = state.trickCards[0].card.suit;
      let winning = state.trickCards[0];

      for (let i = 1; i < state.trickCards.length; i++) {
        const candidate = state.trickCards[i];
        if (this.engine.cardBeats(candidate.card, winning.card, leadSuit)) {
          winning = candidate;
        }
      }

      this.tableSlots[winning.player].classList.add("winning-slot");
    }
  }

  renderReveal(state) {
    const shouldShowReveal = !state.hokm;

    for (let i = 0; i < 4; i++) {
      const el = this.revealSpots[i];
      el.innerHTML = "";

      if (!shouldShowReveal) {
        continue;
      }

      const cards = state.initialRevealCards[i];

      if (!cards || !cards.length) {
        continue;
      }

      let best = cards[0];

      cards.forEach(card => {
        if (this.engine.rankPower[card.rank] > this.engine.rankPower[best.rank]) {
          best = card;
        }
      });

      const cardEl = this.card(best, true);

      if (i === state.hakem) {
        cardEl.classList.add("hakem-card");
      }

      el.appendChild(cardEl);
    }
  }

  renderMessage(state) {
    let text = state.message || "";

    if (state.matchOver) {
      text =
        state.winningTeam === 0
          ? "بازی تمام شد. تیم شما برنده مسابقه شد."
          : "بازی تمام شد. تیم حریف برنده مسابقه شد.";
    } else if (state.roundOver) {
      const teamText =
        state.roundWinnerTeam === 0 ? "تیم شما" : "تیم حریف";

      const pointText =
        state.roundPointsAwarded != null
          ? ` | امتیاز این راند: ${state.roundPointsAwarded}`
          : "";

      text = `${text} | ${teamText} برنده راند شد${pointText}`;

      if (!state.matchOver) {
        text += " | راند بعدی آماده می‌شود...";
      }
    } else if (state.awaitingHokmSelection) {
      if (state.currentPlayer === 0 && state.hakem === 0) {
        text =
          "شما حاکم هستید. برای تعیین حکم، روی یک کارت از خال دلخواه کلیک کنید.";
      } else if (state.currentPlayer != null) {
        text =
          this.engine.playerName(state.currentPlayer) +
          " در حال انتخاب حکم است.";
      } else {
        text = "در انتظار انتخاب حکم...";
      }
    } else if (!text && state.currentPlayer != null) {
      text = "نوبت " + this.engine.playerName(state.currentPlayer) + " است.";
    }

    this.messageEl.textContent = text;
  }

  renderStartButton(state) {
    const freshGame =
      state.hakem === null &&
      state.currentPlayer === null &&
      state.gameScores[0] === 0 &&
      state.gameScores[1] === 0;

    if (state.matchOver) {
      this.startBtn.textContent = "شروع بازی جدید";
      return;
    }

    if (freshGame) {
      this.startBtn.textContent = "شروع بازی";
      return;
    }

    this.startBtn.textContent = "در حال بازی";
  }

  card(card, small = false) {
    const el = document.createElement("div");
    el.className = "card";

    if (small) {
      el.classList.add("small");
    }

    if (card.suit === "H" || card.suit === "D") {
      el.classList.add("red");
    } else {
      el.classList.add("black");
    }

    el.innerHTML = `
      <div class="rank">${card.rank}</div>
      <div class="suit">${this.engine.suitSymbol(card.suit)}</div>
      <div class="rank bottom">${card.rank}</div>
    `;

    return el;
  }

  cardBack(small = false) {
    const el = document.createElement("div");
    el.className = "card back";

    if (small) {
      el.classList.add("small");
    }

    el.innerHTML = `<div class="back-pattern"></div>`;
    return el;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
