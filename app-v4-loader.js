(() => {
  const PARTS = [
    './app-v4.part-1.txt?v=1.4.0',
    './app-v4.part-2.txt?v=1.4.0',
    './app-v4.part-3.txt?v=1.4.0',
    './app-v4.part-4.txt?v=1.4.0'
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

    source = patch(
      source,
      `      const length = Math.min(10, 3 + level);`,
      `      const length = Math.min(8, 2 + Math.ceil(level / 2));`,
      'sequence length'
    );

    source = patch(
      source,
      `  function difficultyLabel(level) { return ['Лёгкий', 'Лёгкий', 'Средний', 'Средний', 'Сложный', 'Сложный', 'Эксперт'][Math.max(0, Math.min(6, level - 1))]; }`,
      `  function difficultyLabel(level) { return ['Лёгкий', 'Лёгкий+', 'Средний', 'Средний+', 'Сложный', 'Сложный+', 'Эксперт'][Math.max(0, Math.min(6, level - 1))]; }`,
      'difficulty labels'
    );

    source = patch(
      source,
      `      pencilState.textContent = pencilMode ? 'Вкл' : 'Выкл';`,
      `      pencilState.textContent = pencilMode ? 'Вкл' : 'Выкл';\n      stage.querySelectorAll('[data-sudoku-number]').forEach(button => {\n        const number = Number(button.dataset.sudokuNumber);\n        const complete = values.filter(value => value === number).length >= 9;\n        button.disabled = complete;\n        button.setAttribute('aria-label', complete ? \`Число \${number} уже заполнено\` : \`Поставить число \${number}\`);\n      });`,
      'completed sudoku numbers'
    );

    source = patch(
      source,
      `    saveState();\n    renderResult(result, newlyUnlocked);`,
      `    saveState();\n    render();\n    renderResult(result, newlyUnlocked);`,
      'daily progress refresh'
    );

    const run = new Function(source);
    run();
  }).catch(error => {
    console.error(error);
    if (screen) screen.innerHTML = '<div class="empty-state"><strong>Не удалось обновить игру</strong>Закрой страницу, открой её снова и проверь подключение к интернету.</div>';
  });
})();