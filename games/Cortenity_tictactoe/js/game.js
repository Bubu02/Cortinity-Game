/* ====================================================
   Cortenity Gaming — Neon Tic-Tac-Toe
   js/game.js
   ==================================================== */

(function () {
  'use strict';

  /* ---- Constants ---- */
  const HUMAN = 'X';
  const BOT   = 'O';
  const WIN_COMBOS = [
    [0,1,2], [3,4,5], [6,7,8],   // rows
    [0,3,6], [1,4,7], [2,5,8],   // columns
    [0,4,8], [2,4,6]              // diagonals
  ];

  /* ---- State ---- */
  const state = {
    board: Array(9).fill(null),
    currentPlayer: HUMAN,
    mode: null,          // 'bot' | 'local'
    difficulty: 'medium', // 'easy' | 'medium' | 'hard'
    gameActive: false,
    gameStarted: false,
    winner: null,
    winCombo: null,
    scores: { X: 0, O: 0, draw: 0 },
    logEntries: [],
    pendingTimeout: null
  };

  /* ---- DOM Refs ---- */
  const $ = (id) => document.getElementById(id);

  const el = {
    board:           $('ttt-board'),
    turnLabel:       $('turn-label'),
    diceLabel:       $('round-label'),
    statusMessage:   $('status-message'),
    modeLabel:       $('game-mode-label'),
    newGameBtn:      $('new-game-btn'),
    gameShell:       $('game-shell'),
    modeSelector:    $('mode-selector'),
    modeFeedback:    $('mode-feedback'),
    playNowBtn:      $('play-now-btn'),
    openModeBtn:     $('open-mode-selector'),
    startBotBtn:     $('start-bot-match'),
    startLocalBtn:   $('start-local-match'),
    resetMatchBtn:   $('reset-match-btn'),
    matchLog:        $('match-log'),
    scoreX:          $('score-x'),
    scoreO:          $('score-o'),
    scoreDraw:       $('score-draw'),
    winLineOverlay:  $('win-line-overlay')
  };

  /* ---- Init ---- */
  initMarketingEffects();
  bindEvents();
  renderBoard();
  renderSidebar();

  /* ================= MARKETING EFFECTS ================= */
  function initMarketingEffects() {
    // Counter animation
    const counterEls = document.querySelectorAll('[data-counter]');
    if (counterEls.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = parseInt(entry.target.dataset.counter, 10);
            animateCounter(entry.target, target, 1600);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      counterEls.forEach((item) => io.observe(item));
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Parallax orbs
    const orb1 = document.querySelector('.hero-orb-1');
    const orb2 = document.querySelector('.hero-orb-2');
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      if (orb1) orb1.style.transform = `translate(${x}px, ${y}px)`;
      if (orb2) orb2.style.transform = `translate(${-x}px, ${-y}px)`;
    });

    // Hero board preview animation
    animatePreviewBoard();
  }

  function animateCounter(elem, target, duration) {
    const increment = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      elem.textContent = Math.floor(current).toLocaleString();
    }, 16);
  }

  function animatePreviewBoard() {
    const cells = document.querySelectorAll('.preview-cell');
    if (!cells.length) return;

    const sequence = [
      { index: 4, mark: 'x' },
      { index: 0, mark: 'o' },
      { index: 2, mark: 'x' },
      { index: 6, mark: 'o' },
      { index: 8, mark: 'x' },
      { index: 1, mark: 'o' },
      { index: 5, mark: 'x' },
      { index: 3, mark: 'o' },
      { index: 7, mark: 'x' }
    ];

    let step = 0;

    function playStep() {
      if (step >= sequence.length) {
        setTimeout(() => {
          cells.forEach((c) => {
            c.className = 'preview-cell';
            c.textContent = '';
          });
          step = 0;
          setTimeout(playStep, 800);
        }, 2000);
        return;
      }

      const { index, mark } = sequence[step];
      const cell = cells[index];
      cell.textContent = mark === 'x' ? '✕' : '○';
      cell.classList.add(mark === 'x' ? 'x-mark' : 'o-mark');
      step++;
      setTimeout(playStep, 600);
    }

    setTimeout(playStep, 1200);
  }

  /* ================= EVENT BINDING ================= */
  function bindEvents() {
    el.playNowBtn?.addEventListener('click', openModeSelector);
    el.openModeBtn?.addEventListener('click', openModeSelector);

    el.startBotBtn?.addEventListener('click', () => startMatch('bot'));
    el.startLocalBtn?.addEventListener('click', () => startMatch('local'));

    el.resetMatchBtn?.addEventListener('click', () => {
      if (state.mode) {
        startMatch(state.mode);
      } else {
        openModeSelector();
      }
    });

    el.newGameBtn?.addEventListener('click', () => {
      if (state.mode) {
        startNewRound();
      }
    });

    // Difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.difficulty = btn.dataset.difficulty;
        document.querySelectorAll('.difficulty-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        addLog(`Difficulty changed to ${state.difficulty}.`);
        renderSidebar();
      });
    });
  }

  /* ================= MODE SELECTOR ================= */
  function openModeSelector(e) {
    if (e) e.preventDefault();
    document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.modeSelector.classList.add('visible');
    el.modeFeedback.textContent = state.mode
      ? 'Start a fresh match or switch modes.'
      : 'Pick a mode to start playing.';
    if (!state.gameStarted) {
      el.gameShell.classList.add('is-locked');
    }
  }

  function closeModeSelector() {
    el.modeSelector.classList.remove('visible');
    if (state.gameStarted) {
      el.gameShell.classList.remove('is-locked');
    }
  }

  /* ================= MATCH FLOW ================= */
  function startMatch(mode) {
    clearPending();
    state.mode = mode;
    state.scores = { X: 0, O: 0, draw: 0 };
    state.logEntries = [];
    state.gameStarted = true;

    el.modeLabel.textContent = mode === 'bot' ? 'vs Bot' : 'Local 2P';

    addLog(`${mode === 'bot' ? 'Bot match' : 'Local match'} started. Good luck!`);
    closeModeSelector();
    startNewRound();
  }

  function startNewRound() {
    clearPending();
    state.board = Array(9).fill(null);
    state.currentPlayer = HUMAN;
    state.gameActive = true;
    state.winner = null;
    state.winCombo = null;

    // Clear win line
    if (el.winLineOverlay) el.winLineOverlay.innerHTML = '';

    setStatus(state.mode === 'bot'
      ? 'Your turn. Place your mark (✕) on the board.'
      : 'Player X\'s turn. Click a cell to place your mark.');

    renderBoard();
    renderSidebar();
  }

  /* ================= GAME LOGIC ================= */
  function handleCellClick(index) {
    if (!state.gameActive || state.board[index] !== null) return;
    if (state.mode === 'bot' && state.currentPlayer !== HUMAN) return;

    placeMove(index);
  }

  function placeMove(index) {
    state.board[index] = state.currentPlayer;
    const mark = state.currentPlayer;

    // Check win
    const winResult = checkWin(state.board, state.currentPlayer);
    if (winResult) {
      state.winner = state.currentPlayer;
      state.winCombo = winResult;
      state.gameActive = false;
      state.scores[state.currentPlayer]++;

      const winnerLabel = getPlayerLabel(state.currentPlayer);
      addLog(`${winnerLabel} wins! 🎉`);
      setStatus(`${winnerLabel} wins the round!`);
      renderBoard();
      renderSidebar();
      drawWinLine(winResult);
      return;
    }

    // Check draw
    if (state.board.every((cell) => cell !== null)) {
      state.winner = 'draw';
      state.gameActive = false;
      state.scores.draw++;
      addLog('It\'s a draw!');
      setStatus('It\'s a draw! No one wins this round.');
      renderBoard();
      renderSidebar();
      return;
    }

    // Switch player
    state.currentPlayer = state.currentPlayer === HUMAN ? BOT : HUMAN;

    const label = getPlayerLabel(state.currentPlayer);
    setStatus(`${label}'s turn.`);
    renderBoard();
    renderSidebar();

    // Bot move
    if (state.mode === 'bot' && state.currentPlayer === BOT && state.gameActive) {
      setStatus('Bot is thinking...');
      state.pendingTimeout = setTimeout(() => {
        if (!state.gameActive) return;
        const botIndex = getBotMove();
        placeMove(botIndex);
      }, 500 + Math.random() * 400);
    }
  }

  function checkWin(board, player) {
    for (const combo of WIN_COMBOS) {
      if (combo.every((i) => board[i] === player)) {
        return combo;
      }
    }
    return null;
  }

  /* ================= BOT AI ================= */
  function getBotMove() {
    switch (state.difficulty) {
      case 'easy':   return getBotMoveEasy();
      case 'medium': return getBotMoveMedium();
      case 'hard':   return getBotMoveHard();
      default:       return getBotMoveMedium();
    }
  }

  function getBotMoveEasy() {
    // Random move
    const empty = state.board.reduce((acc, v, i) => v === null ? [...acc, i] : acc, []);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function getBotMoveMedium() {
    // 60% chance to play optimal, 40% random
    if (Math.random() < 0.6) {
      return getBotMoveHard();
    }
    return getBotMoveEasy();
  }

  function getBotMoveHard() {
    // Minimax with alpha-beta pruning
    let bestScore = -Infinity;
    let bestMove = null;
    const board = [...state.board];

    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = BOT;
      const score = minimax(board, 0, false, -Infinity, Infinity);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }

    return bestMove;
  }

  function minimax(board, depth, isMaximizing, alpha, beta) {
    const botWin = checkWin(board, BOT);
    const humanWin = checkWin(board, HUMAN);

    if (botWin) return 10 - depth;
    if (humanWin) return depth - 10;
    if (board.every((cell) => cell !== null)) return 0;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] !== null) continue;
        board[i] = BOT;
        const evalScore = minimax(board, depth + 1, false, alpha, beta);
        board[i] = null;
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] !== null) continue;
        board[i] = HUMAN;
        const evalScore = minimax(board, depth + 1, true, alpha, beta);
        board[i] = null;
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /* ================= RENDERING ================= */
  function renderBoard() {
    if (!el.board) return;
    el.board.innerHTML = '';

    state.board.forEach((cell, index) => {
      const cellEl = document.createElement('button');
      cellEl.type = 'button';
      cellEl.className = 'ttt-cell';
      cellEl.dataset.index = index;

      if (cell === 'X') {
        cellEl.textContent = '✕';
        cellEl.classList.add('x-cell', 'taken');
      } else if (cell === 'O') {
        cellEl.textContent = '○';
        cellEl.classList.add('o-cell', 'taken');
      }

      if (!state.gameActive && cell === null) {
        cellEl.classList.add('disabled');
      }

      // Highlight win cells
      if (state.winCombo && state.winCombo.includes(index)) {
        cellEl.classList.add('win-cell');
      }

      // Click handler
      if (state.gameActive && cell === null) {
        cellEl.addEventListener('click', () => handleCellClick(index));
      }

      el.board.appendChild(cellEl);
    });
  }

  function renderSidebar() {
    // Turn label
    if (el.turnLabel) {
      if (state.winner === 'draw') {
        el.turnLabel.textContent = 'Draw';
      } else if (state.winner) {
        el.turnLabel.textContent = `${getPlayerLabel(state.winner)} Won`;
      } else if (state.gameActive) {
        el.turnLabel.innerHTML = '';
        const indicator = document.createElement('span');
        indicator.className = 'turn-indicator';
        const mark = document.createElement('span');
        mark.className = `turn-mark ${state.currentPlayer === 'X' ? 'x-turn' : 'o-turn'}`;
        mark.textContent = state.currentPlayer === 'X' ? '✕' : '○';
        const text = document.createElement('span');
        text.textContent = ` ${getPlayerLabel(state.currentPlayer)}`;
        indicator.appendChild(mark);
        indicator.appendChild(text);
        el.turnLabel.appendChild(indicator);
      } else {
        el.turnLabel.textContent = 'Waiting';
      }
    }

    // Round label
    if (el.diceLabel) {
      const totalPlayed = state.scores.X + state.scores.O + state.scores.draw;
      el.diceLabel.textContent = totalPlayed > 0 ? `Round ${totalPlayed}` : '-';
    }

    // Scores
    if (el.scoreX) el.scoreX.textContent = state.scores.X;
    if (el.scoreO) el.scoreO.textContent = state.scores.O;
    if (el.scoreDraw) el.scoreDraw.textContent = state.scores.draw;

    // Match log
    if (el.matchLog) {
      el.matchLog.innerHTML = '';
      const entries = state.logEntries.length
        ? state.logEntries
        : ['Match events will appear here after you start a game.'];
      entries.forEach((entry) => {
        const node = document.createElement('div');
        node.className = 'log-entry';
        node.textContent = entry;
        el.matchLog.appendChild(node);
      });
    }
  }

  function drawWinLine(combo) {
    if (!el.winLineOverlay) return;
    el.winLineOverlay.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = '100%';

    // Calculate line positions based on cell grid positions
    const getCenter = (index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        x: (col * 33.33) + 16.67,
        y: (row * 33.33) + 16.67
      };
    };

    const start = getCenter(combo[0]);
    const end = getCenter(combo[2]);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);

    svg.appendChild(line);
    el.winLineOverlay.appendChild(svg);
  }

  /* ================= HELPERS ================= */
  function getPlayerLabel(player) {
    if (state.mode === 'bot') {
      return player === 'X' ? 'You (✕)' : 'Bot (○)';
    }
    return player === 'X' ? 'Player ✕' : 'Player ○';
  }

  function addLog(message) {
    state.logEntries.unshift(message);
    state.logEntries = state.logEntries.slice(0, 15);
  }

  function setStatus(message) {
    if (el.statusMessage) el.statusMessage.textContent = message;
  }

  function clearPending() {
    if (state.pendingTimeout) {
      clearTimeout(state.pendingTimeout);
      state.pendingTimeout = null;
    }
  }
})();
