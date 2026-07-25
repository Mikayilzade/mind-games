(() => {
  const PARTS = [
    './app-v4.part-1.txt?v=1.5.0',
    './app-v4.part-2.txt?v=1.5.0',
    './app-v4.part-3.txt?v=1.5.0',
    './app-v4.part-4.txt?v=1.5.0'
  ];

  const screen = document.getElementById('screen');
  if (screen) screen.innerHTML = '<div class="empty-state"><strong>Загружаю тренировку…</strong>Подготавливаю задания и прогресс.</div>';

  function patch(source, before, after, label) {
    if (!source.includes(before)) throw new Error(`Не найден патч: ${label}`);
    return source.replace(before, after);
  }

  Promise.all(PARTS.map(async url => {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
    return response.text();
  })).then(parts => {
    let source = parts.join('\n');

    source = patch(
      source,
      `  function getAdaptiveLevel(gameId) {\n    const results = state.results.filter(r => r.gameId === gameId && !r.archived);\n    if (!results.length) return 1;\n    const last = results.slice(-4);\n    const avg = last.reduce((sum, r) => sum + r.accuracy, 0) / last.length;\n    const base = Math.min(7, 1 + Math.floor(results.length / 3));\n    return Math.max(1, Math.min(7, avg >= 86 ? base + 1 : avg < 60 ? base - 1 : base));\n  }`,
      `  function getAdaptiveLevel(gameId) {\n    const results = state.results.filter(r => r.gameId === gameId && !r.archived);\n    if (!results.length) return 1;\n    if (gameId === 'sudoku') {\n      const last = results[results.length - 1];\n      const current = Math.max(1, Math.min(7, Number(last.challengeSpec?.level) || 1));\n      const cleanSolve = last.accuracy >= 90 && (last.stats?.hintsUsed || 0) === 0;\n      const struggled = last.accuracy < 70 || (last.stats?.hintsUsed || 0) >= 2;\n      return Math.max(1, Math.min(7, current + (cleanSolve ? 1 : struggled ? -1 : 0)));\n    }\n    const last = results.slice(-4);\n    const avg = last.reduce((sum, r) => sum + r.accuracy, 0) / last.length;\n    const base = Math.min(7, 1 + Math.floor(results.length / 3));\n    return Math.max(1, Math.min(7, avg >= 86 ? base + 1 : avg < 60 ? base - 1 : base));\n  }`,
      'adaptive level'
    );

    source = patch(source, `      const length = Math.min(10, 3 + level);`, `      const length = Math.min(8, 2 + Math.ceil(level / 2));`, 'sequence length');
    source = patch(source,
      `  function difficultyLabel(level) { return ['Лёгкий', 'Лёгкий', 'Средний', 'Средний', 'Сложный', 'Сложный', 'Эксперт'][Math.max(0, Math.min(6, level - 1))]; }`,
      `  function difficultyLabel(level) { return ['Лёгкий', 'Лёгкий+', 'Средний', 'Средний+', 'Сложный', 'Сложный+', 'Эксперт'][Math.max(0, Math.min(6, level - 1))]; }`,
      'difficulty labels'
    );

    source = patch(source,
      `    let pencilMode = false;\n    let history = [];`,
      `    let pencilMode = false;\n    let lockedNumber = 0;\n    let history = [];`,
      'locked number state'
    );

    source = patch(source,
      `      const selectedValue = selected >= 0 ? values[selected] : 0;`,
      `      const selectedValue = lockedNumber || (selected >= 0 ? values[selected] : 0);`,
      'selected value highlight'
    );

    source = patch(source,
      `      pencilState.textContent = pencilMode ? 'Вкл' : 'Выкл';`,
      `      pencilState.textContent = pencilMode ? 'Вкл' : 'Выкл';\n      stage.querySelectorAll('[data-sudoku-number]').forEach(button => {\n        const number = Number(button.dataset.sudokuNumber);\n        const complete = values.filter(value => value === number).length >= 9;\n        if (complete && lockedNumber === number) lockedNumber = 0;\n        button.disabled = complete;\n        button.classList.toggle('is-active-number', !complete && lockedNumber === number);\n        button.setAttribute('aria-pressed', !complete && lockedNumber === number ? 'true' : 'false');\n        button.setAttribute('aria-label', complete ? \`Число \${number} уже заполнено\` : \`Выбрать число \${number}\`);\n      });`,
      'completed and locked sudoku numbers'
    );

    source = patch(source,
      `        setStatus(notes[selected].has(number) ? \`Кандидат \${number} добавлен.\` : \`Кандидат \${number} убран.\`, '');`,
      `        setStatus('', '');`,
      'quiet pencil status'
    );

    source = patch(source,
      `        setStatus(\`Число \${number} поставлено. Кандидат \${number} автоматически убран из связанных клеток.\`, '');`,
      `        setStatus('', '');`,
      'quiet value status'
    );

    source = patch(source,
      `    const boardClick = event => {\n      const cell = event.target.closest('[data-sudoku-cell]');\n      if (!cell) return;\n      selected = Number(cell.dataset.sudokuCell);\n      hintTarget = -1;\n      renderBoard();\n    };`,
      `    const boardClick = event => {\n      const cell = event.target.closest('[data-sudoku-cell]');\n      if (!cell) return;\n      selected = Number(cell.dataset.sudokuCell);\n      hintTarget = -1;\n      if (lockedNumber && spec.puzzle[selected] === 0 && !values[selected]) enterNumber(lockedNumber);\n      else renderBoard();\n    };`,
      'tap cell with locked number'
    );

    source = patch(source,
      `      const number = event.target.closest('[data-sudoku-number]');\n      if (number) { enterNumber(Number(number.dataset.sudokuNumber)); return; }`,
      `      const number = event.target.closest('[data-sudoku-number]');\n      if (number) {\n        const value = Number(number.dataset.sudokuNumber);\n        if (lockedNumber === value) { lockedNumber = 0; renderBoard(); return; }\n        lockedNumber = value;\n        if (selected >= 0 && spec.puzzle[selected] === 0 && !values[selected]) enterNumber(value);\n        else renderBoard();\n        return;\n      }`,
      'number as tool'
    );

    source = patch(source,
      `    saveState();\n    renderResult(result, newlyUnlocked);`,
      `    saveState();\n    render();\n    renderResult(result, newlyUnlocked);`,
      'daily progress refresh'
    );

    source = patch(source,
      `  function renderProfile() {`,
      `  function brainStatData() {\n    const live = state.results.filter(r => !r.archived);\n    const recent = live.slice(-12);\n    const byGame = id => live.filter(r => r.gameId === id).slice(-8);\n    const avg = (items, key, fallback = 0) => items.length ? items.reduce((sum, item) => sum + Number(key(item) || 0), 0) / items.length : fallback;\n    const difficulty = item => {\n      if (item.gameId === 'sudoku') return Number(item.challengeSpec?.level || 1) * 1.25;\n      if (item.gameId === 'sequence') return Math.max(1, Number(item.challengeSpec?.sequence?.length || 3) - 2) * 1.15;\n      if (item.gameId === 'pairs') return Math.max(1, Number(item.challengeSpec?.symbols?.length || 6) / 2 - 2);\n      if (item.gameId === 'grid') return Math.max(1, Number(item.challengeSpec?.targets?.length || 3) - 2);\n      return 1;\n    };\n    const skill = items => {\n      if (!items.length) return 1;\n      const accuracy = avg(items, r => r.accuracy) / 10;\n      const diff = avg(items, difficulty);\n      const volume = Math.min(3, items.length * .35);\n      return Math.max(1, Math.min(20, Math.round(accuracy + diff + volume)));\n    };\n    const memory = Math.round((skill(byGame('grid')) + skill(byGame('pairs'))) / 2);\n    const working = skill(byGame('sequence'));\n    const logic = skill(byGame('sudoku'));\n    const concentration = recent.length ? Math.max(1, Math.min(20, Math.round(avg(recent, r => r.accuracy) / 6))) : 1;\n    const improved = live.filter(r => r.comparison && r.durationMs < r.comparison.previousDurationMs).length;\n    const speed = Math.max(1, Math.min(20, 5 + improved * 2 + Math.round(avg(recent, r => r.accuracy) / 20)));\n    const repeats = live.filter(r => r.isRepeat && r.comparison);\n    const gains = repeats.filter(r => r.durationMs < r.comparison.previousDurationMs || r.accuracy > r.comparison.previousAccuracy).length;\n    const learning = Math.max(1, Math.min(20, 4 + gains * 2 + Math.min(6, repeats.length)));\n    const stats = [\n      ['Память', memory, 'Пары + Вспышка'],\n      ['Рабочая память', working, 'Цепочка'],\n      ['Логика', logic, 'Судоку'],\n      ['Концентрация', concentration, 'точность последних задач'],\n      ['Скорость', speed, 'улучшение времени'],\n      ['Обучаемость', learning, 'рост на повторениях']\n    ];\n    const strongest = [...stats].sort((a, b) => b[1] - a[1])[0];\n    const title = strongest[0] === 'Логика' ? 'Аналитик' : strongest[0] === 'Память' ? 'Мнемонист' : strongest[0] === 'Рабочая память' ? 'Навигатор' : strongest[0] === 'Скорость' ? 'Спринтер' : strongest[0] === 'Обучаемость' ? 'Адаптер' : 'Наблюдатель';\n    return { stats, title };\n  }\n\n  function brainStatsMarkup() {\n    const data = brainStatData();\n    return '<section class="brain-card"><div class="brain-card-head"><div><span class="brain-kicker">Игровой профиль</span><h2>' + data.title + '</h2><p>Статы строятся из твоих результатов и будут становиться точнее по мере тренировок.</p></div><div class="brain-level">🧠</div></div><div class="brain-stats">' + data.stats.map(stat => '<div class="brain-stat"><div class="brain-stat-row"><strong>' + stat[0] + '</strong><span>' + stat[1] + '/20</span></div><div class="brain-stat-track"><i style="--stat:' + (stat[1] / 20 * 100) + '%"></i></div><small>' + stat[2] + '</small></div>').join('') + '</div><p class="brain-disclaimer">Это игровые показатели прогресса, не IQ и не медицинская оценка.</p></section>';\n  }\n\n  function renderProfile() {`,
      'brain stat helper'
    );

    source = patch(source,
      `      <div class="section-head"><h2>Достижения</h2><span>\${unlocked.size}/\${ACHIEVEMENTS.length}</span></div>`,
      `      \${brainStatsMarkup()}\n      <div class="section-head"><h2>Достижения</h2><span>\${unlocked.size}/\${ACHIEVEMENTS.length}</span></div>`,
      'brain card profile'
    );

    source = source.replace('<div class="profile-row"><span>Версия</span><strong>1.3.0</strong></div>', '<div class="profile-row"><span>Версия</span><strong>1.5.0</strong></div>');

    const run = new Function(source);
    run();
  }).catch(error => {
    console.error(error);
    if (screen) screen.innerHTML = '<div class="empty-state"><strong>Не удалось обновить игру</strong>Закрой страницу, открой её снова и проверь подключение к интернету.</div>';
  });
})();