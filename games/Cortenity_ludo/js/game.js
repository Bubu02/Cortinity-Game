/* ====================================================
   Cortenity Gaming — Neon Ludo
   js/game.js
   ==================================================== */

(function () {
  'use strict';

  const PLAYER_CONFIG = [
    { id: 'red', label: 'You', kind: 'Human', colorClass: 'piece-red', startIndex: 0, isBot: false },
    { id: 'blue', label: 'Bot 1', kind: 'Bot', colorClass: 'piece-blue', startIndex: 13, isBot: true },
    { id: 'green', label: 'Bot 2', kind: 'Bot', colorClass: 'piece-green', startIndex: 39, isBot: true },
    { id: 'yellow', label: 'Bot 3', kind: 'Bot', colorClass: 'piece-yellow', startIndex: 26, isBot: true }
  ];

  const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const MAX_PROGRESS = 56;
  const TRACK_COORDS = buildTrackCoords();
  const HOME_COORDS = {
    red: buildLaneCoords(25, 25, 46, 46),
    blue: buildLaneCoords(75, 25, 54, 46),
    yellow: buildLaneCoords(75, 75, 54, 54),
    green: buildLaneCoords(25, 75, 46, 54)
  };

  const state = {
    mode: null,
    players: [],
    currentPlayerIndex: 0,
    diceValue: null,
    awaitingHumanMove: false,
    winner: null,
    gameStarted: false,
    logEntries: [],
    pendingTimeouts: []
  };

  const elements = {
    track: document.getElementById('board-track'),
    homeLanes: document.getElementById('board-home-lanes'),
    playerList: document.getElementById('player-list'),
    matchLog: document.getElementById('match-log'),
    rollButton: document.getElementById('roll-dice-btn'),
    turnLabel: document.getElementById('turn-label'),
    diceLabel: document.getElementById('dice-label'),
    statusMessage: document.getElementById('status-message'),
    modeLabel: document.getElementById('game-mode-label'),
    winnerBanner: document.getElementById('winner-banner'),
    gameShell: document.getElementById('game-shell'),
    modeSelector: document.getElementById('mode-selector'),
    modeFeedback: document.getElementById('mode-feedback'),
    playNowButton: document.getElementById('play-now-btn'),
    openModeButton: document.getElementById('open-mode-selector'),
    startBotMatch: document.getElementById('start-bot-match'),
    startMultiplayer: document.getElementById('start-multiplayer'),
    resetMatchButton: document.getElementById('reset-match-btn')
  };

  const containerRefs = {
    trackCells: new Map(),
    homeCells: new Map(),
    baseSlots: new Map(),
    playerCards: new Map()
  };

  initMarketingEffects();
  initBoard();
  bindGameEvents();
  renderGame();

  function initMarketingEffects() {
    function animateCounter(el, target, duration) {
      if (!el) return;
      const start = 0;
      const increment = target / (duration / 16);
      let current = start;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = Math.floor(current).toLocaleString();
      }, 16);
    }

    const counterEls = document.querySelectorAll('[data-counter]');
    if (counterEls.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.counter, 10);
            animateCounter(el, target, 1600);
            io.unobserve(el);
          }
        });
      }, { threshold: 0.5 });
      counterEls.forEach((el) => io.observe(el));
    }

    function cycleTokens() {
      const tokens = document.querySelectorAll('.token');
      tokens.forEach((token) => {
        const delay = Math.random() * 3000;
        setTimeout(() => {
          token.style.animation = 'none';
          token.style.filter = 'brightness(2)';
          setTimeout(() => {
            token.style.filter = '';
            token.style.animation = '';
          }, 300);
        }, delay);
      });
    }

    setInterval(cycleTokens, 4000);

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', function (event) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    document.querySelectorAll('.nav-links a').forEach((link) => {
      const href = link.getAttribute('href');
      if (href && window.location.href.includes(href.replace('../..', '').replace('./', ''))) {
        link.classList.add('active');
      }
    });

    document.querySelectorAll('.screenshot-card').forEach((card) => {
      card.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    });

    const orb1 = document.querySelector('.hero-orb-1');
    const orb2 = document.querySelector('.hero-orb-2');
    document.addEventListener('mousemove', (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 30;
      const y = (event.clientY / window.innerHeight - 0.5) * 20;
      if (orb1) orb1.style.transform = `translate(${x}px, ${y}px)`;
      if (orb2) orb2.style.transform = `translate(${-x}px, ${-y}px)`;
    });

    const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    document.querySelectorAll('.dice-icon').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        let count = 0;
        const roll = setInterval(() => {
          el.textContent = dieFaces[Math.floor(Math.random() * 6)];
          if (++count > 10) clearInterval(roll);
        }, 80);
      });
    });
  }

  function initBoard() {
    TRACK_COORDS.forEach((coord, index) => {
      const cell = document.createElement('div');
      const classes = ['track-cell'];
      if (SAFE_CELLS.has(index)) {
        classes.push('safe-cell');
      }
      const safePlayer = getSafeCellOwner(index);
      if (safePlayer) {
        classes.push(`safe-${safePlayer}`);
      }
      cell.className = classes.join(' ');
      cell.style.left = `${coord.x}%`;
      cell.style.top = `${coord.y}%`;
      cell.dataset.trackIndex = String(index);
      elements.track.appendChild(cell);
      containerRefs.trackCells.set(index, cell);
    });

    PLAYER_CONFIG.forEach((player) => {
      const laneCells = [];
      HOME_COORDS[player.id].forEach((coord, laneIndex) => {
        const cell = document.createElement('div');
        cell.className = `home-cell home-${player.id}`;
        cell.style.left = `${coord.x}%`;
        cell.style.top = `${coord.y}%`;
        elements.homeLanes.appendChild(cell);
        laneCells.push(cell);
      });
      containerRefs.homeCells.set(player.id, laneCells);

      const baseGrid = document.getElementById(`base-grid-${player.id}`);
      const slots = [];
      for (let index = 0; index < 4; index += 1) {
        const slot = document.createElement('div');
        slot.className = 'base-slot';
        baseGrid.appendChild(slot);
        slots.push(slot);
      }
      containerRefs.baseSlots.set(player.id, slots);

      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      playerCard.innerHTML = `
        <div class="player-name-row">
          <span class="player-chip ${player.colorClass}"></span>
          <span class="player-name">${player.label}</span>
          <span class="player-kind">${player.kind}</span>
        </div>
        <div class="progress-row">
          <div class="progress-pill">
            <span class="player-meta">Base</span>
            <strong data-stat="base">4</strong>
          </div>
          <div class="progress-pill">
            <span class="player-meta">Track</span>
            <strong data-stat="track">0</strong>
          </div>
          <div class="progress-pill">
            <span class="player-meta">Home</span>
            <strong data-stat="home">0</strong>
          </div>
          <div class="progress-pill">
            <span class="player-meta">Done</span>
            <strong data-stat="done">0</strong>
          </div>
        </div>
      `;
      elements.playerList.appendChild(playerCard);
      containerRefs.playerCards.set(player.id, playerCard);
    });
  }

  function bindGameEvents() {
    elements.playNowButton?.addEventListener('click', openModeSelector);
    elements.openModeButton?.addEventListener('click', openModeSelector);

    elements.startBotMatch?.addEventListener('click', () => {
      startMatch('bot');
    });

    elements.startMultiplayer?.addEventListener('click', () => {
      elements.modeFeedback.textContent = 'Multiplayer is not implemented yet. Use "With Bot" to start the current playable mode.';
    });

    elements.rollButton?.addEventListener('click', () => {
      if (!state.gameStarted || state.winner) return;
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer || currentPlayer.isBot || state.awaitingHumanMove) return;
      rollCurrentPlayer();
    });

    elements.resetMatchButton?.addEventListener('click', () => {
      if (state.mode === 'bot') {
        startMatch('bot');
        return;
      }
      openModeSelector();
    });
  }

  function openModeSelector(event) {
    if (event) event.preventDefault();
    document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elements.modeSelector.classList.add('visible');
    elements.modeFeedback.textContent = state.mode === 'bot'
      ? 'Restart the current bot match or keep playing.'
      : 'Pick a mode to launch the board.';
    if (!state.gameStarted) {
      elements.gameShell.classList.add('is-locked');
    }
  }

  function closeModeSelector() {
    elements.modeSelector.classList.remove('visible');
    if (state.gameStarted) {
      elements.gameShell.classList.remove('is-locked');
    }
  }

  function startMatch(mode) {
    clearPendingTimeouts();
    state.mode = mode;
    state.players = PLAYER_CONFIG.map((player) => ({
      ...player,
      tokens: Array.from({ length: 4 }, (_, index) => ({
        id: `${player.id}-${index}`,
        progress: -1
      }))
    }));
    state.currentPlayerIndex = 0;
    state.diceValue = null;
    state.awaitingHumanMove = false;
    state.winner = null;
    state.gameStarted = true;
    state.logEntries = [];

    elements.modeLabel.textContent = mode === 'bot' ? 'With Bot' : 'Waiting';
    addLog('Bot match started. You play as red and take the first turn.');
    setStatus('Your turn. Roll the dice to start the match.');
    closeModeSelector();
    renderGame();
    beginTurn();
  }

  function beginTurn() {
    if (!state.gameStarted || state.winner) {
      renderGame();
      return;
    }

    state.awaitingHumanMove = false;
    state.diceValue = null;
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    if (currentPlayer.isBot) {
      setStatus(`${currentPlayer.label} is thinking...`);
      renderGame();
      schedule(() => {
        rollCurrentPlayer();
      }, 800);
      return;
    }

    setStatus('Your turn. Roll the dice, then click one of the highlighted red tokens.');
    renderGame();
  }

  function rollCurrentPlayer() {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || state.winner) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    state.diceValue = roll;

    const movableIndexes = getMovableTokenIndexes(currentPlayer, roll);
    addLog(`${currentPlayer.label} rolled a ${roll}.`);

    if (!movableIndexes.length) {
      setStatus(`${currentPlayer.label} rolled ${roll} but has no legal move.`);
      renderGame();
      schedule(nextTurn, 1000);
      return;
    }

    if (currentPlayer.isBot) {
      setStatus(`${currentPlayer.label} rolled ${roll}.`);
      renderGame();
      schedule(() => {
        const choice = chooseBotMove(currentPlayer, roll, movableIndexes);
        moveToken(currentPlayer.id, choice);
      }, 900);
      return;
    }

    state.awaitingHumanMove = true;
    setStatus(`You rolled ${roll}. Choose a highlighted red token to move.`);
    renderGame();
  }

  function chooseBotMove(player, roll, movableIndexes) {
    let bestMove = movableIndexes[0];
    let bestScore = -Infinity;

    movableIndexes.forEach((tokenIndex) => {
      const token = player.tokens[tokenIndex];
      const targetProgress = token.progress === -1 ? 0 : token.progress + roll;
      let score = targetProgress;

      if (token.progress === -1) score += 18;
      if (targetProgress >= 52) score += 12;
      if (targetProgress === MAX_PROGRESS) score += 50;

      if (targetProgress < 52) {
        const absolutePosition = getAbsolutePosition(player, targetProgress);
        if (!SAFE_CELLS.has(absolutePosition)) {
          const captures = getCapturableOpponents(player.id, absolutePosition).length;
          score += captures * 30;
        } else {
          score += 6;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = tokenIndex;
      }
    });

    return bestMove;
  }

  function moveToken(playerId, tokenIndex) {
    const player = state.players.find((item) => item.id === playerId);
    if (!player || state.winner) return;

    const roll = state.diceValue;
    if (!roll) return;

    const movable = getMovableTokenIndexes(player, roll);
    if (!movable.includes(tokenIndex)) return;

    const token = player.tokens[tokenIndex];
    const previousProgress = token.progress;
    token.progress = previousProgress === -1 ? 0 : previousProgress + roll;

    let capturedCount = 0;
    if (token.progress >= 0 && token.progress < 52) {
      const absolutePosition = getAbsolutePosition(player, token.progress);
      if (!SAFE_CELLS.has(absolutePosition)) {
        const captured = getCapturableOpponents(player.id, absolutePosition);
        captured.forEach((opponentToken) => {
          opponentToken.progress = -1;
          capturedCount += 1;
        });
      }
    }

    const leftBase = previousProgress === -1 && token.progress === 0;
    const reachedHome = token.progress === MAX_PROGRESS;

    let message = `${player.label} moved token ${tokenIndex + 1}`;
    if (leftBase) message += ' out of base';
    if (capturedCount > 0) message += ` and captured ${capturedCount} token${capturedCount > 1 ? 's' : ''}`;
    if (reachedHome) message += ' into home';
    message += '.';
    addLog(message);

    if (player.tokens.every((item) => item.progress === MAX_PROGRESS)) {
      state.winner = player.id;
      state.awaitingHumanMove = false;
      setStatus(`${player.label} wins the match.`);
      renderGame();
      return;
    }

    const extraTurn = roll === 6;
    state.awaitingHumanMove = false;
    renderGame();

    if (extraTurn) {
      setStatus(`${player.label} rolled a 6 and gets another turn.`);
      addLog(`${player.label} earned an extra turn.`);
      schedule(beginTurn, 1000);
      return;
    }

    schedule(nextTurn, 900);
  }

  function nextTurn() {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    beginTurn();
  }

  function getCurrentPlayer() {
    return state.players[state.currentPlayerIndex] || null;
  }

  function getMovableTokenIndexes(player, roll) {
    return player.tokens.reduce((indexes, token, index) => {
      if (token.progress === MAX_PROGRESS) return indexes;
      if (token.progress === -1) {
        if (roll === 6) indexes.push(index);
        return indexes;
      }

      if (token.progress + roll <= MAX_PROGRESS) {
        indexes.push(index);
      }
      return indexes;
    }, []);
  }

  function getAbsolutePosition(player, progress) {
    return (player.startIndex + progress) % 52;
  }

  function getCapturableOpponents(playerId, absolutePosition) {
    const captured = [];
    state.players.forEach((player) => {
      if (player.id === playerId) return;
      player.tokens.forEach((token) => {
        if (token.progress >= 0 && token.progress < 52) {
          const position = getAbsolutePosition(player, token.progress);
          if (position === absolutePosition) {
            captured.push(token);
          }
        }
      });
    });
    return captured;
  }

  function renderGame() {
    renderTokens();
    renderSidebar();
  }

  function renderTokens() {
    clearBoardContainers();

    state.players.forEach((player) => {
      player.tokens.forEach((token, tokenIndex) => {
        if (token.progress === MAX_PROGRESS) return;

        const piece = document.createElement('button');
        piece.type = 'button';
        piece.className = `piece ${player.colorClass}`;

        const isCurrentHuman = !player.isBot && getCurrentPlayer()?.id === player.id && state.awaitingHumanMove;
        const isMovable = isCurrentHuman && getMovableTokenIndexes(player, state.diceValue || 0).includes(tokenIndex);

        if (isMovable) {
          piece.classList.add('movable');
          piece.addEventListener('click', () => moveToken(player.id, tokenIndex));
        } else {
          piece.disabled = true;
        }

        if (token.progress === -1) {
          containerRefs.baseSlots.get(player.id)[tokenIndex].appendChild(piece);
          return;
        }

        if (token.progress >= 52) {
          containerRefs.homeCells.get(player.id)[token.progress - 52].appendChild(piece);
          return;
        }

        const absolutePosition = getAbsolutePosition(player, token.progress);
        containerRefs.trackCells.get(absolutePosition).appendChild(piece);
      });
    });
  }

  function renderSidebar() {
    const currentPlayer = getCurrentPlayer();
    elements.turnLabel.textContent = state.winner
      ? `${getPlayerById(state.winner).label} won`
      : currentPlayer
        ? currentPlayer.label
        : 'Waiting';
    elements.diceLabel.textContent = state.diceValue ? String(state.diceValue) : '-';
    elements.winnerBanner.textContent = state.winner
      ? `${getPlayerById(state.winner).label} finished first`
      : 'No winners yet';

    elements.rollButton.disabled = !state.gameStarted || !!state.winner || !currentPlayer || currentPlayer.isBot || state.awaitingHumanMove;

    state.players.forEach((player) => {
      const playerCard = containerRefs.playerCards.get(player.id);
      if (!playerCard) return;
      playerCard.classList.toggle('active-player', !state.winner && currentPlayer?.id === player.id);

      const baseCount = player.tokens.filter((token) => token.progress === -1).length;
      const trackCount = player.tokens.filter((token) => token.progress >= 0 && token.progress < 52).length;
      const homeCount = player.tokens.filter((token) => token.progress >= 52 && token.progress < MAX_PROGRESS).length;
      const doneCount = player.tokens.filter((token) => token.progress === MAX_PROGRESS).length;

      playerCard.querySelector('[data-stat="base"]').textContent = String(baseCount);
      playerCard.querySelector('[data-stat="track"]').textContent = String(trackCount);
      playerCard.querySelector('[data-stat="home"]').textContent = String(homeCount);
      playerCard.querySelector('[data-stat="done"]').textContent = String(doneCount);
    });

    elements.matchLog.innerHTML = '';
    const entries = state.logEntries.length ? state.logEntries : ['Match events will appear here after you start a game.'];
    entries.forEach((entry) => {
      const node = document.createElement('div');
      node.className = 'log-entry';
      node.textContent = entry;
      elements.matchLog.appendChild(node);
    });
  }

  function clearBoardContainers() {
    containerRefs.trackCells.forEach((cell) => {
      cell.innerHTML = '';
    });

    containerRefs.homeCells.forEach((cells) => {
      cells.forEach((cell) => {
        cell.innerHTML = '';
      });
    });

    containerRefs.baseSlots.forEach((slots) => {
      slots.forEach((slot) => {
        slot.innerHTML = '';
      });
    });
  }

  function addLog(message) {
    state.logEntries.unshift(message);
    state.logEntries = state.logEntries.slice(0, 10);
  }

  function setStatus(message) {
    elements.statusMessage.textContent = message;
  }

  function schedule(callback, delay) {
    const timeoutId = window.setTimeout(() => {
      state.pendingTimeouts = state.pendingTimeouts.filter((item) => item !== timeoutId);
      callback();
    }, delay);
    state.pendingTimeouts.push(timeoutId);
  }

  function clearPendingTimeouts() {
    state.pendingTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    state.pendingTimeouts = [];
  }

  function getPlayerById(playerId) {
    return state.players.find((player) => player.id === playerId) || PLAYER_CONFIG.find((player) => player.id === playerId);
  }

  function buildTrackCoords() {
    const coords = [];
    const min = 18;
    const max = 82;
    const step = (max - min) / 13;

    for (let index = 0; index <= 13; index += 1) {
      coords.push({ x: min + step * index, y: min });
    }
    for (let index = 1; index <= 13; index += 1) {
      coords.push({ x: max, y: min + step * index });
    }
    for (let index = 12; index >= 0; index -= 1) {
      coords.push({ x: min + step * index, y: max });
    }
    for (let index = 12; index >= 1; index -= 1) {
      coords.push({ x: min, y: min + step * index });
    }

    return coords;
  }

  function buildLaneCoords(fromX, fromY, toX, toY) {
    return Array.from({ length: 5 }, (_, index) => {
      const fraction = (index + 1) / 5;
      return {
        x: fromX + (toX - fromX) * fraction,
        y: fromY + (toY - fromY) * fraction
      };
    });
  }

  function getSafeCellOwner(index) {
    const player = PLAYER_CONFIG.find((item) => item.startIndex === index);
    return player ? player.id : null;
  }
})();
