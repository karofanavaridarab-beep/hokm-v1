class HokmEngine {
  constructor() {
    this.playersCount = 4;
    this.humanPlayer = 0;

    this.suits = ["S", "H", "D", "C"];
    this.ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    this.rankPower = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
      "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14
    };

    this.resetMatch();
  }

  resetMatch() {
    this.gameScores = [0, 0];
    this.deuceMode = false;
    this.matchOver = false;
    this.winningTeam = null;

    this.hakem = null;
    this.dealer = null;
    this.needsInitialHakemSelection = true;

    this.resetRound();
  }

  resetRound() {
    this.deck = [];
    this.hands = [[], [], [], []];
    this.initialRevealCards = [[], [], [], []];

    this.hokm = null;
    this.hokmCard = null;
    this.awaitingHokmSelection = false;

    this.currentPlayer = null;
    this.trickCards = [];
    this.trickScores = [0, 0];

    this.roundOver = false;
    this.roundWinnerTeam = null;
    this.roundPointType = null;
    this.roundPointsAwarded = 0;

    this.locked = false;
    this.message = "";

    this.initAiMemory();
  }

  initAiMemory() {
    this.aiMemory = {
      playedCards: [],
      playedCardIds: new Set(),

      playerVoids: [
        { S: false, H: false, D: false, C: false },
        { S: false, H: false, D: false, C: false },
        { S: false, H: false, D: false, C: false },
        { S: false, H: false, D: false, C: false }
      ],

      trumpUsedByPlayer: [0, 0, 0, 0],
      leadHistory: [],
      trickHistory: [],

      highCardsPlayed: {
        S: { A: false, K: false, Q: false, J: false, "10": false },
        H: { A: false, K: false, Q: false, J: false, "10": false },
        D: { A: false, K: false, Q: false, J: false, "10": false },
        C: { A: false, K: false, Q: false, J: false, "10": false }
      }
    };
  }

  startNewMatch() {
    this.resetMatch();
    this.prepareRound();
  }

  prepareRound() {
    this.resetRound();

    this.deck = this.createDeck();
    this.shuffle(this.deck);

    if (this.needsInitialHakemSelection) {
      this.determineInitialHakem();
      this.needsInitialHakemSelection = false;
    }

    if (this.hakem === null) this.hakem = 0;

    this.dealer = this.leftOf(this.hakem);
    this.dealAllCardsFromDealer();

    this.awaitingHokmSelection = true;
    this.currentPlayer = this.hakem;

    this.sortAllHands();

    this.message =
      this.playerName(this.hakem) +
      " حاکم شد. حاکم باید یک کارت برای تعیین خال حکم انتخاب کند.";
  }

  createDeck() {
    const deck = [];
    for (const suit of this.suits) {
      for (const rank of this.ranks) {
        deck.push({ id: rank + suit, rank, suit });
      }
    }
    return deck;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  determineInitialHakem() {
    let bestPlayer = 0;
    let bestCard = null;

    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < 4; i++) {
        const card = this.deck.pop();
        this.initialRevealCards[p].push(card);

        if (!bestCard || this.rankPower[card.rank] > this.rankPower[bestCard.rank]) {
          bestCard = card;
          bestPlayer = p;
        }
      }
    }

    this.hakem = bestPlayer;

    for (let p = 0; p < 4; p++) {
      this.deck.push(...this.initialRevealCards[p]);
    }

    this.shuffle(this.deck);
  }

  dealAllCardsFromDealer() {
    const firstReceiver = this.rightOf(this.dealer);

    for (let i = 0; i < 52; i++) {
      const player = (firstReceiver + i) % 4;
      this.hands[player].push(this.deck.pop());
    }
  }

  sortAllHands() {
    for (let p = 0; p < 4; p++) {
      this.hands[p].sort((a, b) => {
        const suitDiff = this.suits.indexOf(a.suit) - this.suits.indexOf(b.suit);
        if (suitDiff !== 0) return suitDiff;
        return this.rankPower[b.rank] - this.rankPower[a.rank];
      });
    }
  }

  selectHokmCard(playerIndex, cardId) {
    if (this.matchOver || this.roundOver) {
      return { ok: false, reason: "بازی تمام شده است." };
    }

    if (!this.awaitingHokmSelection) {
      return { ok: false, reason: "الان زمان انتخاب حکم نیست." };
    }

    if (playerIndex !== this.hakem) {
      return { ok: false, reason: "فقط حاکم می‌تواند حکم را انتخاب کند." };
    }

    const card = this.findCardInHand(playerIndex, cardId);
    if (!card) {
      return { ok: false, reason: "کارت پیدا نشد." };
    }

    this.hokm = card.suit;
    this.hokmCard = card;
    this.awaitingHokmSelection = false;
    this.currentPlayer = this.hakem;

    this.message =
      "حکم " +
      this.suitName(this.hokm) +
      " " +
      this.suitSymbol(this.hokm) +
      " انتخاب شد. " +
      this.playerName(this.hakem) +
      " بازی را شروع می‌کند.";

    return { ok: true, selectedHokm: this.hokm, hokmCard: card };
  }

  playCard(playerIndex, cardId) {
    if (this.locked) return { ok: false, reason: "بازی قفل است." };
    if (this.matchOver || this.roundOver) return { ok: false, reason: "بازی تمام شده است." };
    if (this.awaitingHokmSelection) return { ok: false, reason: "اول باید حاکم حکم را مشخص کند." };
    if (playerIndex !== this.currentPlayer) return { ok: false, reason: "نوبت این بازیکن نیست." };

    const cardIndex = this.hands[playerIndex].findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { ok: false, reason: "کارت در دست بازیکن نیست." };

    const card = this.hands[playerIndex][cardIndex];

    if (!this.canPlayCard(playerIndex, card)) {
      return { ok: false, reason: "باید خال زمینه را بازی کنی." };
    }

    const leadSuitBeforePlay = this.trickCards.length > 0 ? this.trickCards[0].card.suit : null;

    this.hands[playerIndex].splice(cardIndex, 1);
    this.trickCards.push({ player: playerIndex, card });

    this.recordCardKnowledge(playerIndex, card, leadSuitBeforePlay);

    if (this.trickCards.length === 4) {
      const trickWinner = this.resolveTrick();
      const team = this.teamOf(trickWinner);

      this.trickScores[team]++;
      this.recordCompletedTrick(trickWinner);

      this.currentPlayer = trickWinner;

      if (this.trickScores[team] >= 7) {
        this.finishRound(team);
      } else {
        this.message = this.playerName(trickWinner) + " این دست را برد.";
      }

      return {
        ok: true,
        played: { player: playerIndex, card },
        trickComplete: true,
        trickWinner
      };
    }

    this.currentPlayer = this.rightOf(this.currentPlayer);

    return {
      ok: true,
      played: { player: playerIndex, card },
      trickComplete: false,
      nextPlayer: this.currentPlayer
    };
  }

  recordCardKnowledge(playerIndex, card, leadSuitBeforePlay) {
    this.aiMemory.playedCards.push({
      player: playerIndex,
      card: { ...card }
    });

    this.aiMemory.playedCardIds.add(card.id);

    if (this.aiMemory.highCardsPlayed[card.suit] && card.rank in this.aiMemory.highCardsPlayed[card.suit]) {
      this.aiMemory.highCardsPlayed[card.suit][card.rank] = true;
    }

    if (card.suit === this.hokm) {
      this.aiMemory.trumpUsedByPlayer[playerIndex]++;
    }

    if (leadSuitBeforePlay && card.suit !== leadSuitBeforePlay) {
      const stillHasLeadSuit = this.hands[playerIndex].some(c => c.suit === leadSuitBeforePlay);
      if (!stillHasLeadSuit) {
        this.aiMemory.playerVoids[playerIndex][leadSuitBeforePlay] = true;
      }
    }

    if (this.trickCards.length === 1) {
      this.aiMemory.leadHistory.push({
        player: playerIndex,
        suit: card.suit,
        isTrumpLead: card.suit === this.hokm
      });
    }
  }

  recordCompletedTrick(trickWinner) {
    const leadSuit = this.trickCards[0].card.suit;

    this.aiMemory.trickHistory.push({
      cards: this.trickCards.map(t => ({
        player: t.player,
        card: { ...t.card }
      })),
      leadSuit,
      winner: trickWinner,
      winnerTeam: this.teamOf(trickWinner)
    });
  }

  canPlayCard(playerIndex, card) {
    if (this.trickCards.length === 0) return true;

    const leadSuit = this.trickCards[0].card.suit;

    if (card.suit === leadSuit) return true;

    return !this.hands[playerIndex].some(c => c.suit === leadSuit);
  }

  resolveTrick() {
    let winner = this.trickCards[0];
    const leadSuit = this.trickCards[0].card.suit;

    for (let i = 1; i < this.trickCards.length; i++) {
      const candidate = this.trickCards[i];

      if (this.cardBeats(candidate.card, winner.card, leadSuit)) {
        winner = candidate;
      }
    }

    return winner.player;
  }

  cardBeats(cardA, cardB, leadSuit) {
    if (cardA.suit === this.hokm && cardB.suit !== this.hokm) return true;
    if (cardA.suit !== this.hokm && cardB.suit === this.hokm) return false;

    if (cardA.suit === cardB.suit) {
      return this.rankPower[cardA.rank] > this.rankPower[cardB.rank];
    }

    if (cardA.suit === leadSuit && cardB.suit !== leadSuit && cardB.suit !== this.hokm) {
      return true;
    }

    return false;
  }

  clearTrickCards() {
    this.trickCards = [];
  }

  finishRound(winnerTeam) {
    const loserTeam = winnerTeam === 0 ? 1 : 0;
    const hakemTeam = this.teamOf(this.hakem);
    const loserHadZero = this.trickScores[loserTeam] === 0;

    let points = 1;
    let type = "normal";

    if (loserHadZero && hakemTeam === loserTeam) {
      points = 3;
      type = "hakem-kot";
    } else if (loserHadZero) {
      points = 2;
      type = "kot";
    }

    this.roundOver = true;
    this.roundWinnerTeam = winnerTeam;
    this.roundPointType = type;
    this.roundPointsAwarded = points;
    this.gameScores[winnerTeam] += points;

    this.message = this.roundResultText(winnerTeam, points, type);

    this.updateHakemAfterRound(winnerTeam);
    this.checkMatchOver();
  }

  updateHakemAfterRound(winnerTeam) {
    const oldHakem = this.hakem;
    const hakemTeam = this.teamOf(oldHakem);

    if (winnerTeam === hakemTeam) {
      this.hakem = oldHakem;
      this.dealer = this.leftOf(this.hakem);
    } else {
      this.dealer = oldHakem;
      this.hakem = this.rightOf(oldHakem);
    }
  }

  checkMatchOver() {
    const a = this.gameScores[0];
    const b = this.gameScores[1];

    if (a >= 6 && b >= 6) this.deuceMode = true;

    if (!this.deuceMode) {
      if (a >= 7 || b >= 7) {
        this.matchOver = true;
        this.winningTeam = a > b ? 0 : 1;
      }
      return;
    }

    if ((a >= 7 || b >= 7) && Math.abs(a - b) >= 2) {
      this.matchOver = true;
      this.winningTeam = a > b ? 0 : 1;
    }
  }

  chooseAiHokmCard(playerIndex) {
    const hand = this.hands[playerIndex];
    const suitStats = this.getSuitStats(hand);

    let bestCard = hand[0];
    let bestScore = -Infinity;

    for (const card of hand) {
      const stat = suitStats[card.suit];
      const power = this.rankPower[card.rank];

      let score = 0;
      score += stat.count * 38;
      score += stat.highCount * 16;
      score += stat.topRank * 2;
      score += power;

      if (stat.count >= 5) score += 22;
      if (stat.count >= 6) score += 22;
      if (stat.count >= 7) score += 18;

      if (stat.highCount >= 2) score += 15;
      if (stat.highCount >= 3) score += 15;

      if (stat.hasA) score += 12;
      if (stat.hasK) score += 8;
      if (stat.hasQ) score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    return bestCard;
  }

  chooseAiCard(playerIndex) {
    const playable = this.hands[playerIndex].filter(card => this.canPlayCard(playerIndex, card));

    if (playable.length === 0) return null;

    if (this.trickCards.length === 0) {
      return this.chooseAiLeadCard(playerIndex, playable);
    }

    return this.chooseAiResponseCard(playerIndex, playable);
  }

  chooseAiLeadCard(playerIndex, playable) {
    const shouldPullTrump = this.shouldPullTrump(playerIndex);
    const trumpCards = playable.filter(c => c.suit === this.hokm);

    if (shouldPullTrump && trumpCards.length > 0) {
      return this.chooseTrumpLead(playerIndex, trumpCards);
    }

    let bestCard = playable[0];
    let bestScore = -Infinity;

    for (const card of playable) {
      const score = this.scoreLeadCard(playerIndex, card);

      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    return bestCard;
  }

  scoreLeadCard(playerIndex, card) {
    const hand = this.hands[playerIndex];
    const stats = this.getSuitStats(hand);
    const stat = stats[card.suit];
    const power = this.rankPower[card.rank];
    const unseen = this.unseenCardsBySuit(card.suit, playerIndex);
    const remainingHigher = this.countUnseenHigherCards(card, playerIndex);

    let score = 0;

    score += power;
    score += stat.count * 9;
    score += stat.highCount * 8;

    if (card.suit === this.hokm) score -= 30;

    if (remainingHigher === 0) score += 28;
    if (remainingHigher === 1 && power >= 13) score += 10;

    if (power === 14) score += 14;
    if (power === 13 && this.isHighCardPlayed(card.suit, "A")) score += 12;
    if (power === 12 && this.isHighCardPlayed(card.suit, "A") && this.isHighCardPlayed(card.suit, "K")) score += 10;

    if (stat.count >= 4) score += 8;
    if (stat.count === 1) score -= 12;

    score += this.leadSuitMemoryScore(playerIndex, card.suit);
    score += this.endgamePressureScore(playerIndex, card);

    if (unseen <= 3 && power >= 11) score += 8;

    return score;
  }

  chooseTrumpLead(playerIndex, trumpCards) {
    const sorted = [...trumpCards].sort((a, b) => this.rankPower[b.rank] - this.rankPower[a.rank]);

    const hasVeryStrongTrump = sorted.some(c => this.rankPower[c.rank] >= 13);
    if (hasVeryStrongTrump) return sorted[0];

    return sorted[sorted.length - 1];
  }

  shouldPullTrump(playerIndex) {
    if (!this.hokm) return false;

    const hand = this.hands[playerIndex];
    const trumpCards = hand.filter(c => c.suit === this.hokm);
    if (trumpCards.length < 3) return false;

    const team = this.teamOf(playerIndex);
    const oppTeam = 1 - team;

    const myTeamTricks = this.trickScores[team];
    const oppTricks = this.trickScores[oppTeam];

    const highTrumpCount = trumpCards.filter(c => this.rankPower[c.rank] >= 11).length;
    const unseenTrump = this.unseenCardsBySuit(this.hokm, playerIndex);

    if (highTrumpCount >= 2 && myTeamTricks >= oppTricks) return true;
    if (myTeamTricks >= 5 && trumpCards.length >= 2) return true;
    if (oppTricks >= 5 && highTrumpCount >= 1) return true;
    if (unseenTrump <= 4 && trumpCards.length >= 2) return true;

    return false;
  }

  chooseAiResponseCard(playerIndex, playable) {
    const leadSuit = this.trickCards[0].card.suit;
    const currentWinning = this.currentWinningTrickEntry();
    const partner = this.partnerOf(playerIndex);

    const partnerWinning = currentWinning.player === partner;

    const winningCards = playable.filter(card =>
      this.cardBeats(card, currentWinning.card, leadSuit)
    );

    if (partnerWinning) {
      return this.choosePartnerSupportCard(playerIndex, playable);
    }

    if (winningCards.length > 0) {
      return this.chooseLowestUsefulWinningCard(playerIndex, winningCards, currentWinning.card, leadSuit);
    }

    return this.chooseBestDiscard(playerIndex, playable, leadSuit);
  }

  choosePartnerSupportCard(playerIndex, playable) {
    const safeDiscard = playable.filter(c => c.suit !== this.hokm);
    const pool = safeDiscard.length > 0 ? safeDiscard : playable;

    return this.pickLowestStrategicCard(playerIndex, pool);
  }

  chooseLowestUsefulWinningCard(playerIndex, winningCards, currentWinningCard, leadSuit) {
    let best = winningCards[0];
    let bestCost = Infinity;

    for (const card of winningCards) {
      let cost = this.rankPower[card.rank];

      if (card.suit === this.hokm) cost += 42;

      if (card.suit === currentWinningCard.suit) cost -= 8;

      const higherUnseen = this.countUnseenHigherCards(card, playerIndex);
      if (higherUnseen === 0) cost -= 7;

      if (this.isEndgame()) cost -= 4;

      if (cost < bestCost) {
        bestCost = cost;
        best = card;
      }
    }

    return best;
  }

  chooseBestDiscard(playerIndex, playable, leadSuit) {
    const sameSuit = playable.filter(c => c.suit === leadSuit);

    if (sameSuit.length > 0) {
      return this.pickLowestStrategicCard(playerIndex, sameSuit);
    }

    const nonTrump = playable.filter(c => c.suit !== this.hokm);

    if (nonTrump.length > 0) {
      return this.pickBestThrowAway(playerIndex, nonTrump);
    }

    return this.pickLowestStrategicCard(playerIndex, playable);
  }

  pickLowestStrategicCard(playerIndex, cards) {
    const stats = this.getSuitStats(this.hands[playerIndex]);

    let best = cards[0];
    let bestScore = Infinity;

    for (const card of cards) {
      let score = this.rankPower[card.rank];

      if (card.suit === this.hokm) score += 38;

      if (stats[card.suit].count === 1) score -= 8;
      if (stats[card.suit].count === 2) score -= 3;

      if (this.countUnseenHigherCards(card, playerIndex) === 0) score += 10;

      if (score < bestScore) {
        bestScore = score;
        best = card;
      }
    }

    return best;
  }

  pickBestThrowAway(playerIndex, cards) {
    const stats = this.getSuitStats(this.hands[playerIndex]);

    let best = cards[0];
    let bestScore = Infinity;

    for (const card of cards) {
      let score = this.rankPower[card.rank] * 1.2;

      if (stats[card.suit].count === 1) score -= 14;
      if (stats[card.suit].count === 2) score -= 6;

      if (stats[card.suit].highCount >= 2) score += 8;

      if (this.countUnseenHigherCards(card, playerIndex) === 0) {
        score += 15;
      }

      if (this.isSuitDeadForOpponents(playerIndex, card.suit)) {
        score += 8;
      }

      if (score < bestScore) {
        bestScore = score;
        best = card;
      }
    }

    return best;
  }

  currentWinningTrickEntry() {
    let winner = this.trickCards[0];
    const leadSuit = this.trickCards[0].card.suit;

    for (let i = 1; i < this.trickCards.length; i++) {
      const candidate = this.trickCards[i];

      if (this.cardBeats(candidate.card, winner.card, leadSuit)) {
        winner = candidate;
      }
    }

    return winner;
  }

  countUnseenHigherCards(card, playerIndex) {
    let count = 0;

    for (const rank of this.ranks) {
      if (this.rankPower[rank] <= this.rankPower[card.rank]) continue;

      const id = rank + card.suit;

      if (this.aiMemory.playedCardIds.has(id)) continue;
      if (this.hands[playerIndex].some(c => c.id === id)) continue;

      count++;
    }

    return count;
  }

  unseenCardsBySuit(suit, playerIndex) {
    let count = 13;

    for (const entry of this.aiMemory.playedCards) {
      if (entry.card.suit === suit) count--;
    }

    for (const card of this.hands[playerIndex]) {
      if (card.suit === suit) count--;
    }

    return Math.max(0, count);
  }

  isHighCardPlayed(suit, rank) {
    return Boolean(this.aiMemory.highCardsPlayed[suit]?.[rank]);
  }

  leadSuitMemoryScore(playerIndex, suit) {
    let score = 0;

    const partner = this.partnerOf(playerIndex);
    const opp1 = this.rightOf(playerIndex);
    const opp2 = this.leftOf(playerIndex);

    if (this.aiMemory.playerVoids[opp1][suit]) score -= 12;
    if (this.aiMemory.playerVoids[opp2][suit]) score -= 12;

    if (this.aiMemory.playerVoids[partner][suit]) score += 7;

    if (suit === this.hokm) score -= 8;

    return score;
  }

  endgamePressureScore(playerIndex, card) {
    if (!this.isEndgame()) return 0;

    const team = this.teamOf(playerIndex);
    const myTricks = this.trickScores[team];
    const oppTricks = this.trickScores[1 - team];

    let score = 0;
    const power = this.rankPower[card.rank];

    if (myTricks >= 5 && power >= 11) score += 8;
    if (oppTricks >= 5 && power >= 12) score += 9;
    if (oppTricks >= 6 && card.suit === this.hokm) score += 12;

    return score;
  }

  isEndgame() {
    return this.trickScores[0] + this.trickScores[1] >= 8;
  }

  isSuitDeadForOpponents(playerIndex, suit) {
    const opp1 = this.rightOf(playerIndex);
    const opp2 = this.leftOf(playerIndex);

    return this.aiMemory.playerVoids[opp1][suit] && this.aiMemory.playerVoids[opp2][suit];
  }

  getSuitStats(hand) {
    const stats = {
      S: { count: 0, highCount: 0, topRank: 0, hasA: false, hasK: false, hasQ: false },
      H: { count: 0, highCount: 0, topRank: 0, hasA: false, hasK: false, hasQ: false },
      D: { count: 0, highCount: 0, topRank: 0, hasA: false, hasK: false, hasQ: false },
      C: { count: 0, highCount: 0, topRank: 0, hasA: false, hasK: false, hasQ: false }
    };

    for (const card of hand) {
      const power = this.rankPower[card.rank];
      const stat = stats[card.suit];

      stat.count++;

      if (power >= 11) stat.highCount++;
      if (power > stat.topRank) stat.topRank = power;

      if (card.rank === "A") stat.hasA = true;
      if (card.rank === "K") stat.hasK = true;
      if (card.rank === "Q") stat.hasQ = true;
    }

    return stats;
  }

  partnerOf(playerIndex) {
    return (playerIndex + 2) % 4;
  }

  findCardInHand(playerIndex, cardId) {
    return this.hands[playerIndex].find(card => card.id === cardId) || null;
  }

  teamOf(playerIndex) {
    return playerIndex % 2 === 0 ? 0 : 1;
  }

  rightOf(playerIndex) {
    return (playerIndex + 1) % 4;
  }

  leftOf(playerIndex) {
    return (playerIndex + 3) % 4;
  }

  playerName(playerIndex) {
    const names = ["شما", "راست", "بالا", "چپ"];
    return names[playerIndex];
  }

  suitName(suit) {
    const names = {
      S: "پیک",
      H: "دل",
      D: "خشت",
      C: "گشنیز"
    };

    return names[suit] || "-";
  }

  suitSymbol(suit) {
    const symbols = {
      S: "♠",
      H: "♥",
      D: "♦",
      C: "♣"
    };

    return symbols[suit] || "";
  }

  roundResultText(winnerTeam, points, type) {
    const teamName = winnerTeam === 0 ? "تیم شما" : "تیم حریف";

    if (type === "hakem-kot") {
      return teamName + " حاکم‌کوت کرد و " + points + " امتیاز گرفت.";
    }

    if (type === "kot") {
      return teamName + " کوت کرد و " + points + " امتیاز گرفت.";
    }

    return teamName + " راند را برد و " + points + " امتیاز گرفت.";
  }

  getState() {
    return {
      hands: this.hands,
      initialRevealCards: this.initialRevealCards,

      hokm: this.hokm,
      hokmCard: this.hokmCard,

      hakem: this.hakem,
      dealer: this.dealer,
      currentPlayer: this.currentPlayer,

      trickCards: this.trickCards,
      trickScores: this.trickScores,
      gameScores: this.gameScores,

      awaitingHokmSelection: this.awaitingHokmSelection,

      roundOver: this.roundOver,
      roundWinnerTeam: this.roundWinnerTeam,
      roundPointType: this.roundPointType,
      roundPointsAwarded: this.roundPointsAwarded,

      matchOver: this.matchOver,
      winningTeam: this.winningTeam,
      deuceMode: this.deuceMode,

      message: this.message
    };
  }
}
