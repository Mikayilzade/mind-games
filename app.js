(() => {
  'use strict';

  const STORAGE_KEY = 'mind-games-state-v1';
  const VERSION = 1;
  const GAME_META = {
    grid: { name: 'Вспышка', icon: '✦', skill: 'Зрительная память', description: 'Запомни подсвеченные клетки и восстанови рисунок.' },
    pairs: { name: 'Пары', icon: '◫', skill: 'Память и скорость', description: 'Запомни расположение символов и открой все пары.' },
    sequence: { name: 'Цепочка', icon: '➜', skill: 'Рабочая память', description: 'Запомни порядок символов и повтори его без ошибки.' },
    sudoku: { name: 'Мини-судоку', icon: '▦', skill: 'Логика и концентрация', description: 'Реши компактное судоку 4×4 как можно быстрее.' },
    chess: { name: 'Шахматный мотив', icon: '♞', skill: 'Логика и шаблоны', description: 'Найди лучший ход и запомни название тактического приёма.' }
  };
  const SYMBOLS = ['●', '▲', '■', '◆', '★', '✿', '☂', '☀', '☾', '♬', '⚑', '⬟'];
  const SEQUENCE_SYMBOLS = ['●', '▲', '■', '◆', '★', '✿'];
  const SUDOKU_PUZZLES = [
    { puzzle: [1,0,0,4, 0,4,1,0, 0,1,4,0, 4,0,0,1], solution: [1,2,3,4, 3,4,1,2, 2,1,4,3, 4,3,2,1] },
    { puzzle: [0,2,0,4, 3,0,1,0, 0,1,0,3, 4,0,2,0], solution: [1,2,3,4, 3,4,1,2, 2,1,4,3, 4,3,2,1] },
    { puzzle: [2,0,4,0, 0,4,0,2, 1,0,3,0, 0,3,0,1], solution: [2,1,4,3, 3,4,1,2, 1,2,3,4, 4,3,2,1] },
    { puzzle: [0,3,0,1, 1,0,4,0, 0,1,0,3, 3,0,2,0], solution: [4,3,2,1, 1,2,4,3, 2,1,3,4, 3,4,2,1] }
  ];
  const CHESS_PUZZLES = [
    {
      id: 'back-rank-1', title: 'Мат по последней горизонтали', side: 'Ход белых',
      pieces: { g1:'♔', f1:'♖', g8:'♚', a8:'♜', f7:'♟', g7:'♟', h7:'♟' }, from: 'f1', to: 'f8',
      explanation: 'Ладья вторгается на f8. Королю некуда уйти из-за собственных пешек.'
    },
    {
      id: 'queen-mate-1', title: 'Поддержанный мат ферзём', side: 'Ход белых',
      pieces: { g1:'♔', h5:'♕', g8:'♚', f7:'♟', g7:'♟', h7:'♟', c4:'♗' }, from: 'h5', to: 'f7',
      explanation: 'Ферзь идёт на f7 с шахом и защищён слоном c4.'
    },
    {
      id: 'rook-skewer-1', title: 'Линейный удар', side: 'Ход белых',
      pieces: { g1:'♔', a1:'♖', g8:'♚', a8:'♛', a7:'♟', h7:'♟' }, from: 'a1', to: 'a8',
      explanation: 'Ладья забирает ферзя на открытой вертикали. Важно замечать дальнобойные линии.'
    },
    {
      id: 'knight-fork-1', title: 'Двойной удар конём', side: 'Ход белых',
      pieces: { g1:'♔', e5:'♘', g8:'♚', d8:'♛', f7:'♟', g7:'♟' }, from: 'e5', to: 'f7',
      explanation: 'Конь на f7 одновременно атакует короля и ферзя — классическая вилка.'
    },
    {
      id: 'bishop-pin-1', title: 'Связка', side: 'Ход белых',
      pieces: { g1:'♔', c1:'♗', g8:'♚', d7:'♞', e6:'♟', f7:'♟', g7:'♟' }, from: 'c1', to: 'g5',
      explanation: 'Слон связывает коня с королём: конь больше не может свободно двигаться.'
    }
  ];
  const ACHIEVEMENTS = [
    { id:'first', icon:'🌱', name:'Первый шаг', test:s => s.results.length >= 1 },
    { id:'five', icon:'🧠', name:'5 тренировок', test:s => s.results.length >= 5 },
    { id:'streak3', icon:'🔥', name:'Серия 3 дня', test:s => s.bestStreak >= 3 },
    { id:'streak7', icon:'⚡', name:'Неделя силы', test:s => s.bestStreak >= 7 },
    { id:'perfect', icon:'💎', name:'Без ошибки', test:s => s.results.some(r => r.accuracy === 100) },
    { id:'speed', icon:'⏱️', name:'Быстрее себя', test:s => hasImprovement(s, 20) },
    { id:'repeat', icon:'↻', name:'Память жива', test:s => s.results.some(r => r.isRepeat) },
    { id:'allgames', icon:'🏅', name:'Все режимы', test:s => Object.keys(GAME_META).every(id => s.results.some(r => r.gameId === id)) },
    { id:'level5', icon:'🚀', name:'Уровень 5', test:s => getPlayerLevel(s.xp) >= 5 }
  ];

  const screen = document.getElementById('screen');
  const screenTitle = document.getElementById('screenTitle');
  const todayLabel = document.getElementById('todayLabel');
  const streakValue = document.getElementById('streakValue');
  const modalRoot = document.getElementById('modalRoot');
  const toast = document.getElementById('toast');

  let state = loadState();
  let route = 'today';
  let activeGame = null;
  let timerInterval = null;
  let toastTimer = null;

  init();

  function init() {
    state = normalizeState(state);
    ensureDailyPlan();
    updateStreakDisplay();
    bindGlobalEvents();
    render();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
    }
  }

  function defaultState() {
    return {
      version: VERSION,
      createdAt: new Date().toISOString(),
      xp: 0,
      streak: 0,
      bestStreak: 0,
      lastTrainingDate: null,
      results: [],
      dailyPlans: {},
      unlockedAchievements: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultState();
    } catch {
      return defaultState();
    }
  }

  function normalizeState(input) {
    return { ...defaultState(), ...input, results: Array.isArray(input?.results) ? input.results : [], dailyPlans: input?.dailyPlans || {}, unlockedAchievements: input?.unlockedAchievements || [] };
  }

  function saveState() {
    pruneOldPlans();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function pruneOldPlans() {
    const keys = Object.keys(state.dailyPlans).sort().reverse();
    keys.slice(45).forEach(key => delete state.dailyPlans[key]);
  }

  function bindGlobalEvents() {
    document.querySelector('.bottom-nav').addEventListener('click', event => {
      const button = event.target.closest('[data-route]');
      if (!button) return;
      route = button.dataset.route;
      render();
    });
    document.getElementById('streakButton').addEventListener('click', () => { route = 'progress'; render(); });
    screen.addEventListener('click', handleScreenClick);
  }

  function handleScreenClick(event) {
    const task = event.target.closest('[data-task-id]');
    if (task) {
      const planTask = getTodayPlan().tasks.find(item => item.id === task.dataset.taskId);
      if (planTask) openGame(planTask.gameId, planTask);
      return;
    }
    const game = event.target.closest('[data-game-id]');
    if (game) {
      const gameId = game.dataset.gameId;
      const spec = makeChallenge(gameId, hashString(`${todayKey()}-${gameId}-${Date.now()}`), getAdaptiveLevel(gameId));
      openGame(gameId, { id:`free-${Date.now()}`, gameId, challengeId:`free-${Date.now()}`, spec, isRepeat:false, completed:false, source:'free' });
      return;
    }
    if (event.target.closest('[data-reset]')) {
      if (window.confirm('Удалить весь прогресс и начать заново? Это действие нельзя отменить.')) {
        state = defaultState();
        ensureDailyPlan();
        saveState();
        render();
        showToast('Прогресс очищен');
      }
    }
  }

  function render() {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.route === route));
    updateStreakDisplay();
    const titles = { today:'Тренировка', games:'Все игры', progress:'Мой прогресс', profile:'Профиль' };
    screenTitle.textContent = titles[route];
    todayLabel.textContent = formatDateLong(new Date());
    if (route === 'today') renderToday();
    if (route === 'games') renderGames();
    if (route === 'progress') renderProgress();
    if (route === 'profile') renderProfile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderToday() {
    const plan = getTodayPlan();
    const completed = plan.tasks.filter(task => task.completed).length;
    const progress = Math.round((completed / plan.tasks.length) * 100);
    const todayResults = state.results.filter(r => r.date === todayKey());
    const todayMinutes = Math.round(todayResults.reduce((sum, r) => sum + r.durationMs, 0) / 60000);
    const bestToday = todayResults.length ? Math.max(...todayResults.map(r => r.score)) : 0;

    screen.innerHTML = `
      <section class="hero-card">
        <div class="hero-row">
          <div>
            <h2>${completed === plan.tasks.length ? 'Тренировка завершена' : 'Разбуди свой мозг'}</h2>
            <p>${completed === plan.tasks.length ? 'Сегодня ты сделал всё. Завтра план обновится, а старые задачи вернутся для проверки памяти.' : `Сегодня ${plan.tasks.length} коротких задания — примерно ${plan.estimatedMinutes} минут.`}</p>
          </div>
          <div class="progress-ring" style="--progress:${progress}"><strong>${completed}/${plan.tasks.length}</strong></div>
        </div>
      </section>

      <div class="quick-stats">
        <div class="quick-stat"><strong>${state.streak}</strong><span>дней подряд</span></div>
        <div class="quick-stat"><strong>${todayMinutes || '—'}</strong><span>минут сегодня</span></div>
        <div class="quick-stat"><strong>${bestToday || '—'}</strong><span>лучший балл</span></div>
      </div>

      <div class="section-head"><h2>План на сегодня</h2><span>${completed}/${plan.tasks.length}</span></div>
      <div class="task-list">
        ${plan.tasks.map(task => taskCard(task)).join('')}
      </div>

      <div class="section-head"><h2>Зачем возвращаются задания?</h2></div>
      <div class="info-banner">Новая задача проверяет навык, а повтор старой — сохранилось ли знание. Через несколько дней приложение вернёт знакомое упражнение и сравнит результат с прошлым.</div>
    `;
  }

  function taskCard(task) {
    const meta = GAME_META[task.gameId];
    const result = task.resultId ? state.results.find(r => r.id === task.resultId) : null;
    return `
      <button class="task-card ${task.completed ? 'is-complete' : ''}" type="button" data-task-id="${task.id}">
        <span class="task-icon" aria-hidden="true">${meta.icon}</span>
        <span>
          <h3>${meta.name}</h3>
          <p>${task.completed && result ? `${result.score} баллов · ${formatDuration(result.durationMs)}` : describeChallenge(task)}</p>
          ${task.isRepeat ? '<span class="repeat-badge">↻ Проверка памяти</span>' : ''}
        </span>
        <span class="task-status" aria-hidden="true">${task.completed ? '✓' : '›'}</span>
      </button>`;
  }

  function describeChallenge(task) {
    const spec = task.spec;
    if (task.gameId === 'grid') return `Запомнить ${spec.targets.length} клеток`;
    if (task.gameId === 'pairs') return `${spec.symbols.length / 2} пар`;
    if (task.gameId === 'sequence') return `Цепочка из ${spec.sequence.length} символов`;
    if (task.gameId === 'sudoku') return 'Логическая сетка 4×4';
    if (task.gameId === 'chess') return spec.title;
    return GAME_META[task.gameId].description;
  }

  function renderGames() {
    screen.innerHTML = `
      <div class="info-banner">Играй свободно сколько угодно. В ежедневный план попадают сбалансированные задания и повторы для проверки долговременной памяти.</div>
      <div class="games-grid">
        ${Object.entries(GAME_META).map(([id, meta]) => {
          const results = state.results.filter(r => r.gameId === id);
          const best = results.length ? Math.max(...results.map(r => r.score)) : null;
          return `<button class="game-card" type="button" data-game-id="${id}">
            <span class="game-icon" aria-hidden="true">${meta.icon}</span>
            <h3>${meta.name}</h3>
            <p>${meta.description}</p>
            <span class="game-meta">${best ? `Рекорд: ${best}` : 'Ещё не сыграно'}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  function renderProgress() {
    const week = getLastDays(7);
    const weekResults = state.results.filter(r => week.includes(r.date));
    const totalMinutes = Math.round(state.results.reduce((sum, r) => sum + r.durationMs, 0) / 60000);
    const perfect = state.results.filter(r => r.accuracy === 100).length;
    const improvement = calculateOverallImprovement();
    const maxDaily = Math.max(1, ...week.map(date => state.results.filter(r => r.date === date).reduce((sum, r) => sum + r.xpEarned, 0)));
    const recent = [...state.results].reverse().slice(0, 8);

    screen.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card"><span>Тренировок</span><strong>${state.results.length}</strong><em>${weekResults.length} за 7 дней</em></div>
        <div class="metric-card"><span>Время</span><strong>${totalMinutes} мин</strong><em>в полезной практике</em></div>
        <div class="metric-card"><span>Идеально</span><strong>${perfect}</strong><em>без единой ошибки</em></div>
        <div class="metric-card"><span>Изменение</span><strong>${improvement > 0 ? '+' : ''}${improvement}%</strong><em>по повторным задачам</em></div>
      </div>

      <div class="section-head"><h2>Активность за 7 дней</h2><span>опыт</span></div>
      <div class="chart-card">
        <div class="bar-chart">
          ${week.map(date => {
            const value = state.results.filter(r => r.date === date).reduce((sum, r) => sum + r.xpEarned, 0);
            return `<div class="bar-col"><div class="bar-track"><div class="bar" style="--height:${Math.max(3, Math.round(value / maxDaily * 100))}%"></div></div><span>${shortWeekday(date)}</span></div>`;
          }).join('')}
        </div>
      </div>

      <div class="section-head"><h2>История развития</h2><span>последние результаты</span></div>
      ${recent.length ? `<div class="timeline">${recent.map(result => timelineItem(result)).join('')}</div>` : '<div class="empty-state"><strong>История пока пуста</strong>Пройди первую тренировку — здесь появятся конкретные результаты и сравнения.</div>'}
    `;
  }

  function timelineItem(result) {
    const meta = GAME_META[result.gameId];
    const old = result.comparison?.previousDurationMs;
    const comparison = old && old > result.durationMs ? `Быстрее прошлого раза на ${formatDuration(old - result.durationMs)}` : `${result.accuracy}% точности`;
    return `<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-body"><h3>${meta.icon} ${meta.name} · ${formatDateShort(result.date)}</h3><p>${result.score} баллов, ${formatDuration(result.durationMs)}. ${comparison}${result.isRepeat ? ' · повтор старой задачи' : ''}</p></div></div>`;
  }

  function renderProfile() {
    const level = getPlayerLevel(state.xp);
    const withinLevel = state.xp % 250;
    const unlocked = new Set(state.unlockedAchievements);
    screen.innerHTML = `
      <section class="profile-card">
        <div class="profile-head">
          <div class="avatar">🧠</div>
          <div><h2>Исследователь разума</h2><p>Уровень ${level} · ${state.xp} опыта</p></div>
        </div>
        <div class="level-track"><div class="level-fill" style="--width:${Math.round(withinLevel / 250 * 100)}%"></div></div>
      </section>

      <div class="section-head"><h2>Достижения</h2><span>${unlocked.size}/${ACHIEVEMENTS.length}</span></div>
      <div class="achievement-grid">
        ${ACHIEVEMENTS.map(a => `<div class="achievement ${unlocked.has(a.id) ? '' : 'is-locked'}"><span class="achievement-icon">${a.icon}</span><strong>${a.name}</strong></div>`).join('')}
      </div>

      <div class="section-head"><h2>О приложении</h2></div>
      <section class="profile-card">
        <div class="profile-row"><span>Данные</span><strong>Хранятся только на этом устройстве</strong></div>
        <div class="profile-row"><span>Работа без интернета</span><strong>Доступна после первого запуска</strong></div>
        <div class="profile-row"><span>Установка на iPhone</span><strong>Safari → Поделиться → На экран «Домой»</strong></div>
        <div class="profile-row"><span>Важно</span><strong>Это тренажёр, а не медицинская диагностика</strong></div>
        <div class="profile-row"><span>Версия</span><strong>1.0.0</strong></div>
      </section>

      <section class="profile-card">
        <div class="profile-row"><span>Начать с чистого листа</span><button class="danger-button" type="button" data-reset>Удалить прогресс</button></div>
      </section>`;
  }

  function ensureDailyPlan() {
    const date = todayKey();
    if (state.dailyPlans[date]) return;
    const seed = hashString(date);
    const rng = mulberry32(seed);
    const all = Object.keys(GAME_META);
    const due = findDueRepeat();
    const selected = [];
    if (due) selected.push(due.gameId);
    const shuffled = shuffle([...all], rng);
    for (const id of shuffled) {
      if (!selected.includes(id)) selected.push(id);
      if (selected.length === 3) break;
    }
    const tasks = selected.map((gameId, index) => {
      if (due && index === 0 && gameId === due.gameId) {
        return {
          id: `${date}-repeat-${due.challengeId}`,
          gameId,
          challengeId: due.challengeId,
          spec: due.challengeSpec,
          isRepeat: true,
          repeatSourceResultId: due.id,
          completed: false,
          source: 'daily'
        };
      }
      const challengeSeed = hashString(`${date}-${gameId}-${index}`);
      return {
        id: `${date}-${gameId}-${index}`,
        gameId,
        challengeId: `${date}-${gameId}-${index}`,
        spec: makeChallenge(gameId, challengeSeed, getAdaptiveLevel(gameId)),
        isRepeat: false,
        completed: false,
        source: 'daily'
      };
    });
    state.dailyPlans[date] = { date, estimatedMinutes: 8, tasks };
    saveState();
  }

  function getTodayPlan() { ensureDailyPlan(); return state.dailyPlans[todayKey()]; }

  function findDueRepeat() {
    const today = todayKey();
    const candidates = state.results.filter(result => {
      const age = dayDifference(result.date, today);
      if (age < 5 || age > 30) return false;
      const repeatedRecently = state.results.some(r => r.challengeId === result.challengeId && r.id !== result.id && dayDifference(r.date, today) < 5);
      return !repeatedRecently && result.challengeSpec;
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => Math.abs(dayDifference(a.date, today) - 8) - Math.abs(dayDifference(b.date, today) - 8));
    return candidates[0];
  }

  function getAdaptiveLevel(gameId) {
    const results = state.results.filter(r => r.gameId === gameId);
    if (!results.length) return 1;
    const last = results.slice(-4);
    const avg = last.reduce((sum, r) => sum + r.accuracy, 0) / last.length;
    const base = Math.min(7, 1 + Math.floor(results.length / 3));
    return Math.max(1, avg >= 85 ? base + 1 : avg < 60 ? base - 1 : base);
  }

  function makeChallenge(gameId, seed, level) {
    const rng = mulberry32(seed);
    if (gameId === 'grid') {
      const cols = level >= 5 ? 5 : 4;
      const total = cols * cols;
      const count = Math.min(total - 4, 3 + Math.floor(level * .8));
      return { seed, cols, targets: sampleIndices(total, count, rng), previewMs: Math.max(1100, 2300 - level * 130) };
    }
    if (gameId === 'pairs') {
      const pairCount = Math.min(8, 3 + Math.floor(level / 2));
      const chosen = shuffle([...SYMBOLS], rng).slice(0, pairCount);
      const symbols = shuffle([...chosen, ...chosen], rng);
      return { seed, cols: pairCount <= 4 ? 3 : 4, symbols, previewMs: Math.max(1800, 3400 - level * 160) };
    }
    if (gameId === 'sequence') {
      const length = Math.min(10, 3 + level);
      return { seed, sequence: Array.from({length}, () => SEQUENCE_SYMBOLS[Math.floor(rng() * SEQUENCE_SYMBOLS.length)]), paceMs: Math.max(360, 720 - level * 40) };
    }
    if (gameId === 'sudoku') {
      const index = Math.floor(rng() * SUDOKU_PUZZLES.length);
      return { seed, puzzleIndex:index, ...SUDOKU_PUZZLES[index] };
    }
    if (gameId === 'chess') {
      const index = Math.floor(rng() * CHESS_PUZZLES.length);
      return { seed, ...CHESS_PUZZLES[index] };
    }
    throw new Error(`Unknown game: ${gameId}`);
  }

  function openGame(gameId, task) {
    const meta = GAME_META[gameId];
    activeGame = { gameId, task, spec: task.spec, startTime:null, mistakes:0, score:0, accuracy:0, cleanup:null };
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="game-modal" role="dialog" aria-modal="true" aria-label="${meta.name}">
          <header class="game-header">
            <button class="icon-button" type="button" data-close-game aria-label="Закрыть">×</button>
            <h2>${meta.name}</h2>
            <span></span>
          </header>
          <div class="game-stage" id="gameStage">
            <div class="game-intro">
              <div class="big-icon" aria-hidden="true">${meta.icon}</div>
              <h3>${task.isRepeat ? 'Проверим, что осталось в памяти' : meta.skill}</h3>
              <p>${task.isRepeat ? 'Это точно такое же задание, которое уже встречалось раньше. Результаты будут сравнены.' : meta.description}</p>
              <button class="primary-button" type="button" data-start-game>Начать</button>
            </div>
          </div>
        </section>
      </div>`;
    modalRoot.querySelector('[data-close-game]').addEventListener('click', closeGame);
    modalRoot.querySelector('[data-start-game]').addEventListener('click', startActiveGame);
  }

  function closeGame() {
    if (activeGame?.cleanup) activeGame.cleanup();
    clearInterval(timerInterval);
    modalRoot.innerHTML = '';
    activeGame = null;
  }

  function startActiveGame() {
    if (!activeGame) return;
    activeGame.startTime = performance.now();
    const gameId = activeGame.gameId;
    if (gameId === 'grid') startGridGame();
    if (gameId === 'pairs') startPairsGame();
    if (gameId === 'sequence') startSequenceGame();
    if (gameId === 'sudoku') startSudokuGame();
    if (gameId === 'chess') startChessGame();
  }

  function startGridGame() {
    const { cols, targets, previewMs } = activeGame.spec;
    const stage = getGameStage();
    let selected = [];
    let canTap = false;
    stage.innerHTML = gameLayout('Запомни клетки', targets.length, Array.from({length:cols*cols}, (_, i) => `<button class="memory-cell ${targets.includes(i) ? 'is-lit' : ''}" data-cell="${i}" type="button" aria-label="Клетка ${i+1}"></button>`).join(''), 'memory-grid', cols);
    startHudTimer();
    const timeout = setTimeout(() => {
      stage.querySelectorAll('.memory-cell').forEach(cell => cell.classList.remove('is-lit'));
      stage.querySelector('.instruction').textContent = `Выбери ${targets.length} клеток`;
      canTap = true;
    }, previewMs);
    const click = event => {
      const cell = event.target.closest('[data-cell]');
      if (!cell || !canTap) return;
      const index = Number(cell.dataset.cell);
      if (selected.includes(index)) {
        selected = selected.filter(v => v !== index);
        cell.classList.remove('is-selected');
      } else if (selected.length < targets.length) {
        selected.push(index);
        cell.classList.add('is-selected');
      }
      if (selected.length === targets.length) {
        canTap = false;
        const correct = selected.filter(v => targets.includes(v)).length;
        const mistakes = targets.length - correct;
        stage.querySelectorAll('.memory-cell').forEach((node, i) => {
          if (targets.includes(i)) node.classList.add('is-correct');
          else if (selected.includes(i)) node.classList.add('is-wrong');
        });
        activeGame.mistakes = mistakes;
        activeGame.accuracy = Math.round(correct / targets.length * 100);
        activeGame.score = Math.max(100, Math.round(500 + targets.length * 100 - elapsedSeconds() * 8 - mistakes * 90));
        setTimeout(() => finishActiveGame(), 850);
      }
    };
    stage.addEventListener('click', click);
    activeGame.cleanup = () => { clearTimeout(timeout); stage.removeEventListener('click', click); };
  }

  function startPairsGame() {
    const { symbols, cols, previewMs } = activeGame.spec;
    const stage = getGameStage();
    let open = [];
    let matched = new Set();
    let canTap = false;
    let moves = 0;
    stage.innerHTML = gameLayout('Запомни расположение', symbols.length / 2, symbols.map((symbol, i) => `<button class="pair-card is-open" data-card="${i}" type="button"><span>${symbol}</span></button>`).join(''), 'pairs-grid', cols);
    startHudTimer();
    const timeout = setTimeout(() => {
      stage.querySelectorAll('.pair-card').forEach(card => card.classList.remove('is-open'));
      stage.querySelector('.instruction').textContent = 'Открой все пары';
      canTap = true;
    }, previewMs);
    const click = event => {
      const card = event.target.closest('[data-card]');
      if (!card || !canTap) return;
      const index = Number(card.dataset.card);
      if (matched.has(index) || open.includes(index)) return;
      card.classList.add('is-open');
      open.push(index);
      if (open.length === 2) {
        moves += 1;
        updateHudValue('moves', moves);
        canTap = false;
        const [a,b] = open;
        if (symbols[a] === symbols[b]) {
          matched.add(a); matched.add(b);
          stage.querySelector(`[data-card="${a}"]`).classList.add('is-matched');
          stage.querySelector(`[data-card="${b}"]`).classList.add('is-matched');
          open = [];
          canTap = true;
          if (matched.size === symbols.length) {
            const optimal = symbols.length / 2;
            activeGame.mistakes = Math.max(0, moves - optimal);
            activeGame.accuracy = Math.max(0, Math.round(optimal / moves * 100));
            activeGame.score = Math.max(100, Math.round(700 + optimal * 100 - elapsedSeconds() * 6 - activeGame.mistakes * 45));
            setTimeout(finishActiveGame, 500);
          }
        } else {
          activeGame.mistakes += 1;
          setTimeout(() => {
            stage.querySelector(`[data-card="${a}"]`)?.classList.remove('is-open');
            stage.querySelector(`[data-card="${b}"]`)?.classList.remove('is-open');
            open = [];
            canTap = true;
          }, 560);
        }
      }
    };
    stage.addEventListener('click', click);
    activeGame.cleanup = () => { clearTimeout(timeout); stage.removeEventListener('click', click); };
  }

  async function startSequenceGame() {
    const session = activeGame;
    const { sequence, paceMs } = session.spec;
    const stage = getGameStage();
    let input = [];
    let alive = true;
    session.cleanup = () => { alive = false; };
    stage.innerHTML = `
      <div class="game-hud"><div class="hud-chip"><span>Длина</span><strong>${sequence.length}</strong></div><div class="hud-chip"><span>Время</span><strong data-time>0:00</strong></div></div>
      <p class="instruction">Следи за последовательностью</p>
      <div class="sequence-display" data-sequence-display></div>
      <div class="sequence-pad" hidden>${SEQUENCE_SYMBOLS.map(symbol => `<button class="sequence-key" type="button" data-symbol="${symbol}">${symbol}</button>`).join('')}</div>`;
    startHudTimer();
    const display = stage.querySelector('[data-sequence-display]');
    for (let i = 0; i < sequence.length && alive && activeGame === session; i++) {
      display.innerHTML = `<span class="sequence-token">${sequence[i]}</span>`;
      await wait(paceMs);
      display.innerHTML = '';
      await wait(Math.max(150, paceMs * .35));
    }
    if (!alive || activeGame !== session) return;
    stage.querySelector('.instruction').textContent = 'Повтори цепочку';
    stage.querySelector('.sequence-pad').hidden = false;
    const click = event => {
      const key = event.target.closest('[data-symbol]');
      if (!key) return;
      const symbol = key.dataset.symbol;
      const expected = sequence[input.length];
      input.push(symbol);
      display.innerHTML = input.map(value => `<span class="sequence-token">${value}</span>`).join('');
      if (symbol !== expected) {
        activeGame.mistakes = 1;
        activeGame.accuracy = Math.round((input.length - 1) / sequence.length * 100);
        activeGame.score = Math.max(50, 250 + (input.length - 1) * 100);
        stage.querySelector('.instruction').textContent = `Нужен был символ ${expected}`;
        stage.querySelector('.sequence-pad').hidden = true;
        setTimeout(finishActiveGame, 750);
      } else if (input.length === sequence.length) {
        activeGame.accuracy = 100;
        activeGame.score = Math.max(100, Math.round(600 + sequence.length * 120 - elapsedSeconds() * 5));
        stage.querySelector('.sequence-pad').hidden = true;
        setTimeout(finishActiveGame, 450);
      }
    };
    stage.addEventListener('click', click);
    session.cleanup = () => { alive = false; stage.removeEventListener('click', click); };
  }

  function startSudokuGame() {
    const { puzzle, solution } = activeGame.spec;
    const stage = getGameStage();
    const values = [...puzzle];
    let selected = puzzle.findIndex(v => v === 0);
    stage.innerHTML = `
      <div class="game-hud"><div class="hud-chip"><span>Ошибки</span><strong data-mistakes>0</strong></div><div class="hud-chip"><span>Время</span><strong data-time>0:00</strong></div></div>
      <p class="instruction">В каждой строке, колонке и блоке должны быть числа 1–4</p>
      <div class="sudoku-board">${values.map((v,i) => `<button class="sudoku-cell ${v ? 'is-fixed' : ''} ${i === selected ? 'is-active' : ''}" type="button" data-sudoku-cell="${i}" ${v ? 'disabled' : ''}>${v || ''}</button>`).join('')}</div>
      <div class="sudoku-pad">${[1,2,3,4].map(n => `<button class="sudoku-key" type="button" data-number="${n}">${n}</button>`).join('')}</div>`;
    startHudTimer();
    const click = event => {
      const cell = event.target.closest('[data-sudoku-cell]');
      if (cell) {
        selected = Number(cell.dataset.sudokuCell);
        stage.querySelectorAll('.sudoku-cell').forEach(node => node.classList.toggle('is-active', Number(node.dataset.sudokuCell) === selected));
        return;
      }
      const key = event.target.closest('[data-number]');
      if (!key || selected < 0 || puzzle[selected] !== 0) return;
      const value = Number(key.dataset.number);
      const node = stage.querySelector(`[data-sudoku-cell="${selected}"]`);
      if (solution[selected] === value) {
        values[selected] = value;
        node.textContent = value;
        node.classList.remove('is-error');
        const next = values.findIndex(v => v === 0);
        if (next === -1) {
          const empties = puzzle.filter(v => v === 0).length;
          activeGame.accuracy = Math.max(0, Math.round(empties / (empties + activeGame.mistakes) * 100));
          activeGame.score = Math.max(100, Math.round(900 - elapsedSeconds() * 7 - activeGame.mistakes * 70));
          setTimeout(finishActiveGame, 450);
        } else {
          selected = next;
          stage.querySelectorAll('.sudoku-cell').forEach(n => n.classList.toggle('is-active', Number(n.dataset.sudokuCell) === selected));
        }
      } else {
        activeGame.mistakes += 1;
        updateHudValue('mistakes', activeGame.mistakes);
        node.classList.add('is-error');
        setTimeout(() => node.classList.remove('is-error'), 450);
      }
    };
    stage.addEventListener('click', click);
    activeGame.cleanup = () => stage.removeEventListener('click', click);
  }

  function startChessGame() {
    const spec = activeGame.spec;
    const stage = getGameStage();
    let selected = null;
    const squares = [];
    for (let rank = 8; rank >= 1; rank--) {
      for (let file = 0; file < 8; file++) {
        const coord = `${String.fromCharCode(97 + file)}${rank}`;
        const light = (file + rank) % 2 === 1;
        squares.push(`<button class="chess-square ${light ? 'is-light' : 'is-dark'}" type="button" data-square="${coord}" aria-label="${coord}">${spec.pieces[coord] || ''}</button>`);
      }
    }
    stage.innerHTML = `
      <div class="game-hud"><div class="hud-chip"><span>Попытки</span><strong data-attempts>0</strong></div><div class="hud-chip"><span>Время</span><strong data-time>0:00</strong></div></div>
      <span class="puzzle-tag">${spec.title}</span>
      <p class="instruction">${spec.side}. Нажми на фигуру, затем на поле назначения.</p>
      <div class="chess-board">${squares.join('')}</div>`;
    startHudTimer();
    const click = event => {
      const square = event.target.closest('[data-square]');
      if (!square) return;
      const coord = square.dataset.square;
      if (!selected) {
        if (!spec.pieces[coord]) return;
        selected = coord;
        square.classList.add('is-selected');
        return;
      }
      const from = selected;
      stage.querySelectorAll('.chess-square').forEach(node => node.classList.remove('is-selected'));
      selected = null;
      if (from === spec.from && coord === spec.to) {
        square.classList.add('is-target');
        activeGame.accuracy = Math.max(25, 100 - activeGame.mistakes * 25);
        activeGame.score = Math.max(100, Math.round(850 - elapsedSeconds() * 6 - activeGame.mistakes * 120));
        stage.querySelector('.instruction').textContent = spec.explanation;
        setTimeout(finishActiveGame, 1200);
      } else {
        activeGame.mistakes += 1;
        updateHudValue('attempts', activeGame.mistakes);
        stage.querySelector('.instruction').textContent = 'Не лучший ход. Посмотри на угрозы ещё раз.';
      }
    };
    stage.addEventListener('click', click);
    activeGame.cleanup = () => stage.removeEventListener('click', click);
  }

  function gameLayout(instruction, target, content, className, cols) {
    return `
      <div class="game-hud"><div class="hud-chip"><span>${className === 'pairs-grid' ? 'Ходы' : 'Цель'}</span><strong data-${className === 'pairs-grid' ? 'moves' : 'target'}>${className === 'pairs-grid' ? 0 : target}</strong></div><div class="hud-chip"><span>Время</span><strong data-time>0:00</strong></div></div>
      <p class="instruction">${instruction}</p>
      <div class="${className}" style="--cols:${cols}">${content}</div>`;
  }

  function startHudTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const node = modalRoot.querySelector('[data-time]');
      if (node && activeGame?.startTime) node.textContent = formatDuration(performance.now() - activeGame.startTime);
    }, 200);
  }

  function updateHudValue(key, value) {
    const node = modalRoot.querySelector(`[data-${key}]`);
    if (node) node.textContent = value;
  }

  function finishActiveGame() {
    if (!activeGame) return;
    clearInterval(timerInterval);
    if (activeGame.cleanup) activeGame.cleanup();
    const durationMs = Math.max(1000, performance.now() - activeGame.startTime);
    const task = activeGame.task;
    const previous = [...state.results].reverse().find(r => r.challengeId === task.challengeId);
    const xpEarned = Math.max(12, Math.round(20 + activeGame.accuracy * .35 + Math.min(30, activeGame.score / 40)));
    const result = {
      id: `result-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      date: todayKey(),
      createdAt: new Date().toISOString(),
      gameId: activeGame.gameId,
      challengeId: task.challengeId,
      challengeSpec: task.spec,
      durationMs: Math.round(durationMs),
      mistakes: activeGame.mistakes,
      accuracy: Math.round(activeGame.accuracy),
      score: Math.round(activeGame.score),
      xpEarned,
      isRepeat: Boolean(task.isRepeat),
      comparison: previous ? { previousResultId: previous.id, previousDurationMs: previous.durationMs, previousScore: previous.score, previousAccuracy: previous.accuracy } : null
    };
    state.results.push(result);
    state.xp += xpEarned;
    markDailyTaskComplete(task.id, result.id);
    updateTrainingStreak(result.date);
    const newlyUnlocked = updateAchievements();
    saveState();
    renderResult(result, newlyUnlocked);
  }

  function renderResult(result, newlyUnlocked) {
    const stage = getGameStage();
    const previous = result.comparison;
    let comparison = 'Первый результат сохранён. Когда задача вернётся, мы сравним скорость и точность.';
    if (previous) {
      const delta = previous.previousDurationMs - result.durationMs;
      const scoreDelta = result.score - previous.previousScore;
      comparison = `${delta > 0 ? `Ты быстрее на ${formatDuration(delta)}` : `В этот раз понадобилось на ${formatDuration(Math.abs(delta))} больше`}. ${scoreDelta >= 0 ? `Баллы: +${scoreDelta}` : `Баллы: ${scoreDelta}`}.`;
    }
    stage.innerHTML = `
      <div class="result-card">
        <div class="result-icon">${result.accuracy >= 85 ? '✓' : '↗'}</div>
        <h3>${result.accuracy >= 85 ? 'Отличная работа' : 'Мозг стал сильнее'}</h3>
        <p>${result.isRepeat ? 'Повтор завершён — теперь видно, что сохранилось в памяти.' : 'Результат добавлен в твою историю развития.'}</p>
        <div class="result-stats">
          <div class="result-stat"><strong>${result.score}</strong><span>баллов</span></div>
          <div class="result-stat"><strong>${result.accuracy}%</strong><span>точность</span></div>
          <div class="result-stat"><strong>${formatDuration(result.durationMs)}</strong><span>время</span></div>
        </div>
        <div class="comparison">${comparison}</div>
        ${newlyUnlocked.length ? `<div class="comparison">Новое достижение: ${newlyUnlocked.map(a => `${a.icon} ${a.name}`).join(', ')}</div>` : ''}
        <div class="button-stack">
          <button class="primary-button" type="button" data-result-close>Продолжить</button>
          <button class="secondary-button" type="button" data-result-again>Сыграть ещё раз</button>
        </div>
      </div>`;
    stage.querySelector('[data-result-close]').addEventListener('click', () => { closeGame(); render(); });
    stage.querySelector('[data-result-again]').addEventListener('click', () => {
      const gameId = result.gameId;
      const spec = makeChallenge(gameId, hashString(`${Date.now()}-${gameId}`), getAdaptiveLevel(gameId));
      closeGame();
      openGame(gameId, { id:`free-${Date.now()}`, gameId, challengeId:`free-${Date.now()}`, spec, isRepeat:false, completed:false, source:'free' });
    });
  }

  function markDailyTaskComplete(taskId, resultId) {
    const plan = state.dailyPlans[todayKey()];
    if (!plan) return;
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) { task.completed = true; task.resultId = resultId; }
  }

  function updateTrainingStreak(date) {
    if (state.lastTrainingDate === date) return;
    const previousDay = offsetDate(date, -1);
    state.streak = state.lastTrainingDate === previousDay ? state.streak + 1 : 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.lastTrainingDate = date;
  }

  function updateAchievements() {
    const before = new Set(state.unlockedAchievements);
    ACHIEVEMENTS.forEach(a => { if (a.test(state)) before.add(a.id); });
    const newly = ACHIEVEMENTS.filter(a => before.has(a.id) && !state.unlockedAchievements.includes(a.id));
    state.unlockedAchievements = [...before];
    return newly;
  }

  function updateStreakDisplay() { streakValue.textContent = state.streak || 0; }

  function calculateOverallImprovement() {
    const repeats = state.results.filter(r => r.comparison?.previousDurationMs);
    if (!repeats.length) return 0;
    const changes = repeats.map(r => (r.comparison.previousDurationMs - r.durationMs) / r.comparison.previousDurationMs * 100);
    return Math.round(changes.reduce((a,b) => a+b, 0) / changes.length);
  }

  function hasImprovement(s, threshold) {
    return s.results.some(r => r.comparison?.previousDurationMs && ((r.comparison.previousDurationMs - r.durationMs) / r.comparison.previousDurationMs * 100) >= threshold);
  }

  function getPlayerLevel(xp) { return 1 + Math.floor(xp / 250); }
  function getGameStage() { return document.getElementById('gameStage'); }
  function elapsedSeconds() { return activeGame?.startTime ? (performance.now() - activeGame.startTime) / 1000 : 0; }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parseDateKey(key) {
    const [y,m,d] = key.split('-').map(Number);
    return new Date(y, m-1, d, 12, 0, 0);
  }

  function offsetDate(key, amount) {
    const d = parseDateKey(key);
    d.setDate(d.getDate() + amount);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function dayDifference(from, to) {
    return Math.round((parseDateKey(to) - parseDateKey(from)) / 86400000);
  }

  function getLastDays(count) {
    return Array.from({length:count}, (_, i) => offsetDate(todayKey(), i - count + 1));
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat('ru-RU', { weekday:'long', day:'numeric', month:'long' }).format(date);
  }

  function formatDateShort(key) {
    return new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short' }).format(parseDateKey(key));
  }

  function shortWeekday(key) {
    return new Intl.DateTimeFormat('ru-RU', { weekday:'short' }).format(parseDateKey(key)).replace('.', '');
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${String(sec).padStart(2,'0')}`;
  }

  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(array, rng = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function sampleIndices(total, count, rng) {
    return shuffle(Array.from({length:total}, (_, i) => i), rng).slice(0, count);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }
})();
